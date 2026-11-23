import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  type UIMessage,
  type UIMessageChunk,
} from 'ai';
import {
  LONG_DOC_CHAR_LIMIT,
  LONG_DOC_MODEL,
  VISION_FALLBACK,
  VISION_MODEL,
  DEFAULT_FALLBACK,
  createGoogleClient,
  getModelInfo,
  getProvider,
  isRateLimitError,
  keysFromRequest,
  resolveModel,
  shouldFallbackError,
} from '@/lib/ai-providers';
import { formatSearchContext, searchWeb } from '@/lib/web-search';
import { markModelHealthy, markModelHighTraffic } from '@/lib/model-health';

export const maxDuration = 60;

interface ChatBody {
  messages?: UIMessage[];
  modelId?: string;
  systemPrompt?: string;
  slidingWindow?: boolean;
  webSearch?: boolean;
  mode?: 'revise';
  revise?: { originalQuestion: string; previousAnswer: string; previousModel: string };
}

const WINDOW_SIZE = 10;

function buildRevisePrompt(r: NonNullable<ChatBody['revise']>): string {
  return `<original_question>
${r.originalQuestion}
</original_question>

<previous_answer model="${r.previousModel}">
${r.previousAnswer}
</previous_answer>

Act as a senior technical reviewer. Audit the answer above for bugs, logical gaps, or suboptimal patterns, then provide a significantly improved and complete revision.`;
}

function lastUserMessage(messages: UIMessage[]): UIMessage | undefined {
  return [...messages].reverse().find((m) => m.role === 'user');
}

function hasImage(m?: UIMessage): boolean {
  return !!m?.parts.some((p) => p.type === 'file' && p.mediaType.startsWith('image/'));
}

function extractText(m?: UIMessage): string {
  return (m?.parts ?? []).map((p) => (p.type === 'text' ? p.text : '')).join('');
}

function textLength(m?: UIMessage): number {
  return extractText(m).length;
}

/** Starts a stream and waits for the first meaningful chunk so a 429/503 can trigger fallback. */
async function startStream(
  modelId: string,
  req: Request,
  messages: Awaited<ReturnType<typeof convertToModelMessages>>,
  baseSystem: string,
  webSearch: boolean,
  latestQuery: string,
  preferGoogleGrounding = true,
): Promise<{ stream: ReadableStream<UIMessageChunk>; searchMode: string }> {
  const keys = keysFromRequest(req);
  const provider = getProvider(modelId);

  let system = baseSystem;
  let searchMode = 'off';
  let tools: Record<string, ReturnType<ReturnType<typeof createGoogleClient>['tools']['googleSearch']>> | undefined;

  if (webSearch) {
    if (provider === 'google' && preferGoogleGrounding && !keys.tavily) {
      const google = createGoogleClient(keys);
      tools = { google_search: google.tools.googleSearch({}) };
      searchMode = 'google-grounding';
    } else if (keys.tavily) {
      const compact = provider === 'groq';
      const results = await searchWeb(latestQuery, keys.tavily, compact);
      const ctx = formatSearchContext(latestQuery, results, compact);
      if (ctx) {
        system = `${system}\n\n${ctx}`;
        searchMode = 'tavily';
      }
    } else if (provider === 'google' && preferGoogleGrounding) {
      const google = createGoogleClient(keys);
      tools = { google_search: google.tools.googleSearch({}) };
      searchMode = 'google-grounding';
    } else {
      searchMode = 'no-key';
    }
  }

  // Allow up to 15s for the first token; if a model stalls in queue, abort so fallback can take over.
  const firstTokenController = new AbortController();
  const onReqAbort = () => firstTokenController.abort(req.signal.reason);
  req.signal.addEventListener('abort', onReqAbort, { once: true });
  const firstTokenTimer = setTimeout(() => {
    firstTokenController.abort(new Error('503 Request timed out waiting for first token'));
  }, 15_000);

  let streamError: unknown;
  const result = streamText({
    model: resolveModel(modelId, keys),
    messages,
    system,
    tools,
    abortSignal: firstTokenController.signal,
    maxRetries: 0,
    onError: ({ error }) => {
      streamError = error;
    },
  });

  const reader = result.toUIMessageStream({ sendReasoning: true }).getReader();
  const buffered: UIMessageChunk[] = [];
  let done = false;

  try {
    while (!done) {
      const r = await reader.read();
      if (r.done) {
        done = true;
        break;
      }
      buffered.push(r.value);
      if (r.value.type === 'error') {
        throw streamError ?? new Error((r.value as { errorText?: string }).errorText);
      }
      if (r.value.type === 'text-delta' || r.value.type === 'reasoning-delta') break;
    }
    if (streamError) throw streamError;
  } catch (err) {
    if (firstTokenController.signal.aborted && !req.signal.aborted) {
      throw new Error('503 Model timed out waiting for first token');
    }
    throw err;
  } finally {
    clearTimeout(firstTokenTimer);
    req.signal.removeEventListener('abort', onReqAbort);
  }

  const stream = new ReadableStream<UIMessageChunk>({
    start(controller) {
      for (const c of buffered) controller.enqueue(c);
      if (done) controller.close();
    },
    async pull(controller) {
      if (done) return;
      const r = await reader.read();
      if (r.done) controller.close();
      else controller.enqueue(r.value);
    },
    cancel: (reason) => reader.cancel(reason),
  });

  return { stream, searchMode };
}

export async function POST(req: Request) {
  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  let uiMessages = body.messages ?? [];
  if (body.mode === 'revise') {
    if (!body.revise) return Response.json({ error: 'Missing revise payload' }, { status: 400 });
    uiMessages = [
      { id: crypto.randomUUID(), role: 'user', parts: [{ type: 'text', text: buildRevisePrompt(body.revise) }] },
    ];
  }
  if (uiMessages.length === 0) return Response.json({ error: 'No messages' }, { status: 400 });

  if (body.slidingWindow && uiMessages.length > WINDOW_SIZE) {
    uiMessages = uiMessages.slice(-WINDOW_SIZE);
  }

  const latest = lastUserMessage(uiMessages);
  const latestQuery = body.mode === 'revise' ? (body.revise?.originalQuestion ?? '') : extractText(latest);
  let modelId = body.modelId ?? 'gemini-3.8-flash';
  let fallbackId = getModelInfo(modelId)?.fallback;

  // RULE 1: vision. RULE 2: long documents.
  if (hasImage(latest)) {
    modelId = VISION_MODEL;
    fallbackId = VISION_FALLBACK;
  } else if (textLength(latest) > LONG_DOC_CHAR_LIMIT) {
    modelId = LONG_DOC_MODEL;
    fallbackId = getModelInfo(LONG_DOC_MODEL)?.fallback;
  }

  const today = new Date().toISOString().slice(0, 10);
  const baseSystem = [
    `Current date: ${today}.`,
    body.systemPrompt?.trim() || 'You are Daemon Personal, a helpful, concise, and accurate AI assistant.',
  ].join('\n\n');

  const modelMessages = await convertToModelMessages(uiMessages);
  const webSearch = Boolean(body.webSearch);

  // RULE 3: try the selected model (with Google grounding if requested), then the same model with
  // universal web search, then the fallback chain, on 429 / 503 / provider errors.
  const attempts: { id: string; grounding: boolean }[] = [{ id: modelId, grounding: true }];
  if (webSearch && getProvider(modelId) === 'google') attempts.push({ id: modelId, grounding: false });
  const chain: string[] = [];
  let next = fallbackId;
  while (next && !chain.includes(next) && next !== modelId && chain.length < 3) {
    chain.push(next);
    next = getModelInfo(next)?.fallback;
  }
  if (!fallbackId && modelId !== DEFAULT_FALLBACK) chain.push(DEFAULT_FALLBACK);
  for (const id of chain) attempts.push({ id, grounding: false });

  let stream: ReadableStream<UIMessageChunk> | undefined;
  let used = modelId;
  let searchMode = 'off';
  let lastErr: unknown;
  const tried: string[] = [];

  for (const a of attempts) {
    tried.push(a.id);
    try {
      const out = await startStream(a.id, req, modelMessages, baseSystem, webSearch, latestQuery, a.grounding);
      stream = out.stream;
      searchMode = out.searchMode;
      used = a.id;
      markModelHealthy(a.id);
      break;
    } catch (err) {
      lastErr = err;
      if (shouldFallbackError(err)) {
        markModelHighTraffic(a.id, errMsg(err).slice(0, 80));
        continue;
      }
      break;
    }
  }

  if (!stream) {
    return Response.json(
      { error: errMsg(lastErr), modelTried: Array.from(new Set(tried)) },
      { status: isRateLimitError(lastErr) ? 429 : 502 },
    );
  }

  const headers: Record<string, string> = { 'X-Model-Used': used, 'X-Web-Search': searchMode };
  if (used !== modelId) {
    headers['X-Fallback-From'] = modelId;
    if (lastErr) headers['X-Fallback-Reason'] = errMsg(lastErr).replace(/[\r\n]+/g, ' ').slice(0, 140);
  }

  return createUIMessageStreamResponse({ stream, headers });
}
function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
