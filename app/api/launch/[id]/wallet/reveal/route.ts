import { NextRequest, NextResponse } from 'next/server';
import { verifySessionJwt, verifySignature } from '@/lib/auth';
import { getLaunch } from '@/lib/db';
import { decryptSecret } from '@/lib/crypto';
import { rateLimit } from '@/lib/rate-limit';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const rl = await rateLimit(req, 'launch-wallet-reveal');
  if (!rl.allowed) return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  const user = await verifySessionJwt(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { nonce, signature } = await req.json();
  if (!nonce || !signature) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  const { id } = await params;
  const rec = await getLaunch(id);
  if (!rec || rec.userSub !== user.sub) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const message = new TextEncoder().encode(`Reveal launch wallet private key: ${nonce}`);
  const ok = verifySignature(user.sub, message, Buffer.from(signature, 'base64'));
  if (!ok) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });

  if (!rec.launchWalletEnc) return NextResponse.json({ error: 'No key stored' }, { status: 404 });
  const secretB58 = await decryptSecret(rec.launchWalletEnc, process.env.APP_JWT_SECRET!);
  return NextResponse.json({ privateKey: secretB58 });
}


