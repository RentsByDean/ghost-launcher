import { NextRequest, NextResponse } from 'next/server';
import { cookies, isSecureRequest } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  const secure = isSecureRequest(req);
  res.cookies.set(cookies.SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 0,
  });
  return res;
}