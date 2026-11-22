import { OfficeParser } from 'officeparser';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ALLOWED = ['pdf', 'docx', 'pptx', 'xlsx'] as const;
const MAX_BYTES = 4 * 1024 * 1024; // Vercel body limit is ~4.5 MB

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: 'Expected multipart/form-data' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return Response.json({ error: 'Missing "file" field' }, { status: 400 });
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!(ALLOWED as readonly string[]).includes(ext)) {
    return Response.json({ error: `Unsupported file type ".${ext}". Allowed: ${ALLOWED.join(', ')}` }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: 'File too large (max 4 MB)' }, { status: 413 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const ast = await OfficeParser.parseOffice(buffer, { fileType: ext as (typeof ALLOWED)[number] });
    const content = ast
      .toText()
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    const charCount = content.length;
    return Response.json({
      fileName: file.name,
      charCount,
      estimatedTokens: Math.ceil(charCount / 4),
      content,
    });
  } catch (err) {
    return Response.json(
      { error: `Failed to parse document: ${err instanceof Error ? err.message : String(err)}` },
      { status: 422 },
    );
  }
}
