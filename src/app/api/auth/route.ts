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
  // Session cookie (no maxAge/expires): automatically cleared when the browser closes.
  res.cookies.set(COOKIE, sha(expected), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE);
  return res;
}
