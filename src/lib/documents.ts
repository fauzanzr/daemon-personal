export interface AttachedDocument {
  name: string;
  content: string;
  estimatedTokens: number;
}

export const OFFICE_EXTENSIONS = ['pdf', 'docx', 'pptx', 'xlsx'];
export const TEXT_EXTENSIONS = ['txt', 'md', 'py', 'ts', 'tsx', 'js', 'jsx', 'sql', 'json', 'csv', 'html', 'css', 'yml', 'yaml'];

export const ACCEPT_ATTR = [...OFFICE_EXTENSIONS, ...TEXT_EXTENSIONS].map((e) => `.${e}`).join(',');

export const estimateTokens = (text: string) => Math.ceil(text.length / 4);

export function wrapDocument(doc: AttachedDocument): string {
  return `<attached_document name="${doc.name}">\n${doc.content}\n</attached_document>`;
}

/** Text files are read in the browser; Office/PDF go through /api/extract. */
export async function readDocument(file: File): Promise<AttachedDocument> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (OFFICE_EXTENSIONS.includes(ext)) {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/extract', { method: 'POST', body: form });
    const data = (await res.json()) as { error?: string; fileName: string; content: string; estimatedTokens: number };
    if (!res.ok) throw new Error(data.error ?? 'Extraction failed');
    return { name: data.fileName, content: data.content, estimatedTokens: data.estimatedTokens };
  }

  if (TEXT_EXTENSIONS.includes(ext)) {
    const content = await file.text();
    return { name: file.name, content, estimatedTokens: estimateTokens(content) };
  }

  throw new Error(`Unsupported file type ".${ext}"`);
}
