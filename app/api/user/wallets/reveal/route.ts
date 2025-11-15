import { NextRequest, NextResponse } from 'next/server';
import { verifySessionJwt, verifySignature } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { getRedis } from '@/lib/db';
import { decryptSecret } from '@/lib/crypto';
import { getOrCreatePlatformWallet } from '@/lib/user-wallet';

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, 'user-wallets-reveal');
  if (!rl.allowed) return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  const user = await verifySessionJwt(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { nonce, signature } = await req.json();
  if (!nonce || !signature) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  const message = new TextEncoder().encode(`Reveal platform wallet private key: ${nonce}`);
  const sigBytes = Buffer.from(signature, 'base64');
  const ok = verifySignature(user.sub, message, sigBytes);
  if (!ok) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });

  await getOrCreatePlatformWallet(user.sub);
  const redis = getRedis();
  const enc = await redis.get<string>(`user:${user.sub}:platformWalletEnc`);
  if (!enc) return NextResponse.json({ error: 'No key found' }, { status: 404 });

  const secretB58 = await decryptSecret(enc, process.env.APP_JWT_SECRET!);
  return NextResponse.json({ privateKey: secretB58 });
}


