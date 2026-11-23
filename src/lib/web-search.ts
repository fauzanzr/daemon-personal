export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchResponse {
  answer?: string;
  results: WebSearchResult[];
}

/** Removes filler words / attached documents so the search engine gets a focused query. */
export function cleanQuery(raw: string): string {
  return raw
    .replace(/<attached_document[\s\S]*?<\/attached_document>/g, ' ')
    .replace(
      /\b(tolong|saya|aku|ingin|mau|membuka|buka|kirimkan|kirim|berikan|kasih|kesini|ke sini|ulangi|apakah|yakin|dong|deh|ya|nya|kira-kira|kira kira|bisa|coba|please|could you|can you|send me|give me|i want to|open)\b/gi,
      ' ',
    )
    .replace(/[?!.,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 250);
}

async function searchTavily(query: string, apiKey: string, maxResults = 8): Promise<WebSearchResponse> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: maxResults,
      search_depth: 'basic',
      include_answer: true,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Tavily error (${res.status})`);
  const data = (await res.json()) as {
    answer?: string;
    results?: { title?: string; url?: string; content?: string }[];
  };
  return {
    answer: data.answer,
    results: (data.results ?? []).map((r) => ({ title: r.title ?? '', url: r.url ?? '', snippet: r.content ?? '' })),
  };
}

/** Uses Tavily Search API when a key is available (no CAPTCHA scraping). */
export async function searchWeb(query: string, tavilyKey?: string | null, compact = false): Promise<WebSearchResponse> {
  const cleaned = cleanQuery(query);
  if (!cleaned || !tavilyKey) return { results: [] };
  try {
    return await searchTavily(cleaned, tavilyKey, compact ? 4 : 8);
  } catch {
    return { results: [] };
  }
}

/** Plain-text context (no XML-like tags or tool syntax, so models never echo raw markup/JSON). */
export function formatSearchContext(query: string, data: WebSearchResponse, compact = false): string {
  if (data.results.length === 0 && !data.answer) return '';
  const maxSnippet = compact ? 360 : 900;
  const sections: string[] = [`LIVE WEB SEARCH RESULTS (already retrieved for "${cleanQuery(query)}"):`];
  if (data.answer) {
    sections.push(`Summary: ${data.answer.slice(0, compact ? 500 : 1200)}`);
  }
  if (data.results.length > 0) {
    const body = data.results
      .map((r, i) => `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet.slice(0, maxSnippet)}`)
      .join('\n\n');
    sections.push(body);
  }
  sections.push(
    'Instructions: Answer directly in natural language using the results above. Always format URLs as clickable Markdown links like [Page Title](https://example.com). NEVER output JSON tool calls such as {"tool": "google_search", ...} — you do not have callable tools; all search results are already provided above.',
  );
  return sections.join('\n\n');
}
