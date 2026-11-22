export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

/** Removes filler words / attached documents so the search engine gets a focused query. */
export function cleanQuery(raw: string): string {
  return raw
    .replace(/<attached_document[\s\S]*?<\/attached_document>/g, ' ')
    .replace(/\b(tolong|saya|ulangi|apakah|yakin|dong|deh|ya|kira-kira|kira kira|bisa|coba|please|could you|can you)\b/gi, ' ')
    .replace(/[?!.,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 250);
}

async function searchTavily(query: string, apiKey: string, maxResults = 6): Promise<WebSearchResult[]> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey, query, max_results: maxResults, search_depth: 'basic' }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Tavily error (${res.status})`);
  const data = (await res.json()) as { results?: { title?: string; url?: string; content?: string }[] };
  return (data.results ?? []).map((r) => ({ title: r.title ?? '', url: r.url ?? '', snippet: r.content ?? '' }));
}

/** Uses Tavily Search API when a key is available (no CAPTCHA scraping). */
export async function searchWeb(query: string, tavilyKey?: string | null): Promise<WebSearchResult[]> {
  const cleaned = cleanQuery(query);
  if (!cleaned || !tavilyKey) return [];
  try {
    return await searchTavily(cleaned, tavilyKey);
  } catch {
    return [];
  }
}

/** Plain-text context (no XML-like tags, so models never echo markup into their answer). */
export function formatSearchContext(query: string, results: WebSearchResult[]): string {
  if (results.length === 0) return '';
  const body = results.map((r, i) => `${i + 1}. ${r.title}\n   Source: ${r.url}\n   ${r.snippet}`).join('\n\n');
  return [
    `LIVE WEB SEARCH RESULTS (retrieved for "${cleanQuery(query)}"):`,
    body,
    'Instructions: use the results above to answer with up-to-date facts and cite sources as markdown links. If the results do not contain the answer, say so honestly instead of guessing. Never print raw search-result markup.',
  ].join('\n\n');
}
