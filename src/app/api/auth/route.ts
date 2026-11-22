import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'node:crypto';

const COOKIE = 'daemon_auth';
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

export async function POST(req: Request) {
  const { pin } = (await req.json().catch(() => ({}))) as { pin?: string };
  const expected = process.env.APP_PIN;
  if (!expected || typeof pin !== 'string') {
    return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
  }
  const a = Buffer.from(sha(pin));
  const b = Buffer.from(sha(expected));
  if (!timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, sha(expected), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE);
  return res;
}
