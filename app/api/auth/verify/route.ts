import { NextRequest, NextResponse } from 'next/server';
import { createSession, verifySignature, cookies, isSecureRequest } from '@/lib/auth';
import { redis } from '@/lib/db';

export async function POST(req: NextRequest) {
  const { address, signature, nonce } = await req.json();
  if (!address || !signature || !nonce) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  // Prevent nonce reuse
  const nonceKey = `auth:nonce:${nonce}`;
  const set = await redis.set(nonceKey, address, { nx: true, ex: 300 });
  if (set !== 'OK') return NextResponse.json({ error: 'Nonce used' }, { status: 400 });

  const message = new TextEncoder().encode(`Sign in to Pump Launcher: ${nonce}`);
  const sig = Buffer.from(signature, 'base64');
  const ok = verifySignature(address, message, sig);
  if (!ok) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });

  const token = await createSession(address);
  const res = NextResponse.json({ ok: true });
  const secure = isSecureRequest(req);
  res.cookies.set(cookies.SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}


