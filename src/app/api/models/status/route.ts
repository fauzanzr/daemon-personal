import { getModelHealthSnapshot } from '@/lib/model-health';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(getModelHealthSnapshot());
}
