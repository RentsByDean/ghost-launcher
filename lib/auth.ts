import { NextRequest } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

const SESSION_COOKIE = 'session-token';

export async function createSession(address: string) {
  const secret = process.env.APP_JWT_SECRET!;
  const alg = 'HS256';
  const token = await new SignJWT({ sub: address })
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(new TextEncoder().encode(secret));
  return token;
}

export async function verifySessionJwt(req: NextRequest): Promise<{ sub: string } | null> {
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const auth = req.headers.get('authorization');
  const token = cookie || (auth?.startsWith('Bearer ') ? auth.slice(7) : undefined);
  return verifySessionToken(token);
}

export async function verifySessionToken(token?: string | null): Promise<{ sub: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.APP_JWT_SECRET!));
    const sub = String(payload.sub || '');
    if (!sub) return null;
    return { sub };
  } catch {
    return null;
  }
}

export function verifySignature(address: string, message: Uint8Array, signature: Uint8Array) {
  const pk = bs58ToUint8(address);
  return nacl.sign.detached.verify(message, signature, pk);
}

export function isSecureRequest(req: NextRequest) {
  const forwardedProto = req.headers.get('x-forwarded-proto');
  if (forwardedProto) {
    const first = forwardedProto.split(',')[0]?.trim().toLowerCase();
    if (first) return first === 'https';
  }
  return req.nextUrl.protocol === 'https:';
}

function bs58ToUint8(b58: string): Uint8Array {
  return bs58.decode(b58);
}

export const cookies = { SESSION_COOKIE };


