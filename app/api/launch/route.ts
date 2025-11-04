import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { verifySessionJwt } from '@/lib/auth';
import { putLaunch, getUserLaunches } from '@/lib/db';
import type { LaunchRecord } from '@/lib/db';
import { encryptSecret } from '@/lib/crypto';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { createDepositForOwner } from '@/lib/privacy-cash';
import { rateLimit } from '@/lib/rate-limit';
import { Connection, PublicKey, clusterApiUrl, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { redis } from '@/lib/db';
import { decryptSecret } from '@/lib/crypto';
import { getOrCreatePlatformWallet } from '@/lib/user-wallet';
import { withdrawToLaunchWallet } from '@/lib/launch/withdraw';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const rl = await rateLimit(req, 'launch-list');
  if (!rl.allowed) return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  const user = await verifySessionJwt(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const launches = await getUserLaunches(user.sub);
  const res = launches.map((l) => ({ id: l.id, status: l.status, meta: l.meta, launchWallet: l.launchWallet }));
  return NextResponse.json(res);
}

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, 'launch-create');
  if (!rl.allowed) return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  const user = await verifySessionJwt(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const amountLamports = Number(body?.amountLamports || 0);
  console.log('[launch] request', { user: user.sub, amountLamports, meta: body?.meta });
  if (!Number.isFinite(amountLamports) || amountLamports <= 0) {
    console.warn('[launch] invalid amount', { user: user.sub, amountLamports });
    return NextResponse.json({ error: 'amountLamports must be > 0' }, { status: 400 });
  }
  // Enforce minimum required balance for pump launch flow
  const MIN_SOL = 0.05;
  const MIN_LAMPORTS = Math.floor(MIN_SOL * LAMPORTS_PER_SOL);
  if (amountLamports < MIN_LAMPORTS) {
    console.warn('[launch] below minimum', { user: user.sub, amountLamports, min: MIN_LAMPORTS });
    return NextResponse.json({ error: `Minimum amount is ${MIN_SOL} SOL` }, { status: 400 });
  }
  const meta = body?.meta || {};
  // Check the platform wallet has enough balance to fund the deposit
  try {
    const rpcUrl = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl('mainnet-beta');
    const connection = new Connection(rpcUrl, 'confirmed');
    const { platformWallet: platformWalletAddr } = await getOrCreatePlatformWallet(user.sub);
    const platformWallet = new PublicKey(platformWalletAddr);
    const balance = await connection.getBalance(platformWallet);
    if (balance < amountLamports) {
      console.warn('[launch] platform wallet insufficient funds', { user: user.sub, platformWallet: platformWalletAddr, balance, required: amountLamports });
      return NextResponse.json({ error: 'Platform wallet has insufficient funds to start the launch' }, { status: 400 });
    }
  } catch (e) {
    console.warn('[launch] platform balance check failed, continuing');
  }

  const id = randomUUID();
  // Decrypt the user's platform wallet secret and create deposit from that wallet
  console.log('[launch] creating deposit');
  const encKey = await redis.get<string>(`user:${user.sub}:platformWalletEnc`);
  if (!encKey) {
    console.warn('[launch] missing platform wallet secret');
    return NextResponse.json({ error: 'Platform wallet not initialized' }, { status: 400 });
  }
  const ownerSecretB58 = await decryptSecret(encKey, process.env.APP_JWT_SECRET!);
  const dep: any = await createDepositForOwner({ amountLamports, ownerSecretB58 });
  const depositId = dep?.depositId;
  const depositAddress = dep?.depositAddress;
  console.log('[launch] deposit created', { depositId, depositAddress });

  // Generate a normal launch wallet on the server
  const kp = Keypair.generate();
  const launchWallet = kp.publicKey.toBase58();
  const launchWalletEnc = await encryptSecret(bs58.encode(kp.secretKey), process.env.APP_JWT_SECRET!);

  const rec = {
    id,
    userSub: user.sub,
    amountLamports,
    platformWallet: (await (async () => {
      const { platformWallet } = await getOrCreatePlatformWallet(user.sub);
      return platformWallet;
    })()) || '',
    launchWallet,
    launchWalletEnc,
    meta,
    privacyCash: { depositId, depositAddress, status: 'deposit_pending' },
    pump: { status: 'pending' },
    status: 'deposit_pending',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await putLaunch(rec as any);
  console.log('[launch] record stored', { id, user: user.sub });

  // Attempt immediate withdraw to the launch wallet; if not ready, status will be updated accordingly
  try {
    const w = await withdrawToLaunchWallet({ userSub: user.sub, launchId: id });
    console.log('[launch] withdraw attempt result', { id, status: w?.status || (w?.ok ? 'ok' : 'unknown') });
  } catch (e: any) {
    console.warn('[launch] withdraw attempt failed', { id, message: e?.message });
  }

  return NextResponse.json({ id, depositAddress, launchWallet });
}


