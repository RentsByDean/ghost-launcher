import { NextRequest, NextResponse } from 'next/server';
import { verifySessionJwt } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { getLaunch } from '@/lib/db';
import { getOrCreatePlatformWallet } from '@/lib/user-wallet';
import { getConnection } from '@/lib/solana';
import { decryptSecret } from '@/lib/crypto';
import bs58 from 'bs58';
import { Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { createDepositForOwner, withdrawForOwner } from '@/lib/privacy-cash';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, 'job-reverse-privacy');
  if (!rl.allowed) return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  const user = await verifySessionJwt(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const rec = await getLaunch(id);
  if (!rec || rec.userSub !== user.sub) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!rec.launchWallet || !rec.launchWalletEnc) return NextResponse.json({ error: 'No launch wallet' }, { status: 400 });

  const connection = getConnection();
  const launchPubkey = new PublicKey(rec.launchWallet);
  const balanceLamports = await connection.getBalance(launchPubkey);
  // Keep a safer reserve for fees/rent while depositing
  const BASE_RESERVE = Math.floor(0.006 * LAMPORTS_PER_SOL); // 0.006 SOL
  let depositLamports = Math.max(0, balanceLamports - BASE_RESERVE);
  if (depositLamports <= 0) {
    return NextResponse.json({ error: 'insufficient_balance', balanceLamports }, { status: 400 });
  }

  const ownerSecretB58 = await decryptSecret(rec.launchWalletEnc, process.env.APP_JWT_SECRET!);
  // Deposit from launch wallet into privacy cash with step-down retries
  let lastErr: any;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await createDepositForOwner({ amountLamports: depositLamports, ownerSecretB58 });
      lastErr = null;
      break;
    } catch (e: any) {
      lastErr = e;
      // Reduce by 10% and retry
      depositLamports = Math.floor(depositLamports * 0.9);
      if (depositLamports < Math.floor(0.001 * LAMPORTS_PER_SOL)) break;
    }
  }
  if (lastErr) {
    return NextResponse.json({ error: 'deposit_failed', message: lastErr?.message, attemptedLamports: depositLamports, balanceLamports }, { status: 400 });
  }

  // Withdraw from privacy cash to platform wallet
  const { platformWallet } = await getOrCreatePlatformWallet(user.sub);
  try {
    const result = await withdrawForOwner({ ownerSecretB58, lamports: depositLamports, toAddress: platformWallet });
    return NextResponse.json({ ok: true, depositedLamports: depositLamports, to: platformWallet, result });
  } catch (e: any) {
    return NextResponse.json({ error: 'withdraw_failed', message: e?.message, to: platformWallet }, { status: 400 });
  }
}


