import { NextRequest, NextResponse } from 'next/server';
import { verifySessionJwt } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { getLaunch } from '@/lib/db';
import { env } from '@/lib/env';
import { getConnection } from '@/lib/solana';
import { decryptSecret } from '@/lib/crypto';
import bs58 from 'bs58';
import { Keypair, PublicKey, VersionedTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getOrCreatePlatformWallet } from '@/lib/user-wallet';
import { createDepositForOwner, withdrawForOwner } from '@/lib/privacy-cash';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, 'job-rewards');
  if (!rl.allowed) return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  const user = await verifySessionJwt(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, action } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const rec = await getLaunch(id);
  if (!rec || rec.userSub !== user.sub) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // From here, rec is non-null
  const launchWallet = rec.launchWallet as string | undefined;
  const launchWalletEnc = rec.launchWalletEnc as string | undefined;

  // Only action: claim then return
  if (!launchWallet || !launchWalletEnc) return NextResponse.json({ error: 'No launch wallet' }, { status: 400 });
  // 1) Claim creator fee to launch wallet
  const launchSecretB58 = await decryptSecret(launchWalletEnc, process.env.APP_JWT_SECRET!);
  const launchKp = Keypair.fromSecretKey(bs58.decode(launchSecretB58));
  const portalUrl = (env.PUMPFUN_PORTAL_URL || 'https://pumpportal.fun/api') + '/trade-local';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (env.PUMPFUN_PORTAL_API_KEY) {
    headers['authorization'] = `Bearer ${env.PUMPFUN_PORTAL_API_KEY}`;
    headers['x-api-key'] = env.PUMPFUN_PORTAL_API_KEY;
  }
  const res = await fetch(portalUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      publicKey: launchWallet,
      action: 'collectCreatorFee',
      priorityFee: env.PUMPFUN_PRIORITY_FEE_SOL || 0.000001,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    return NextResponse.json({ error: 'portal_failed', stage: 'claim', status: res.status, body: txt }, { status: 400 });
  }
  const ab = await res.arrayBuffer();
  const raw = new Uint8Array(ab);
  const vtx = VersionedTransaction.deserialize(raw);
  try { vtx.sign([launchKp]); } catch {}
  const connection = getConnection();
  const sim = await connection.simulateTransaction(vtx, { sigVerify: true });
  if (sim.value.err) {
    return NextResponse.json({ error: 'simulate_failed', stage: 'claim', logs: sim.value.logs, details: sim.value.err }, { status: 400 });
  }
  const claimSig = await connection.sendRawTransaction(vtx.serialize(), { skipPreflight: false });
  await connection.confirmTransaction(claimSig, 'finalized');

  // 2) Return to platform via privacy cash (deposit from launch -> withdraw to platform)
  const launchPubkey = new PublicKey(launchWallet);
  const balanceLamports = await connection.getBalance(launchPubkey);
  const BASE_RESERVE = Math.floor(0.006 * LAMPORTS_PER_SOL);
  let depositLamports = Math.max(0, balanceLamports - BASE_RESERVE);
  if (depositLamports <= 0) {
    return NextResponse.json({ error: 'insufficient_balance', stage: 'return', balanceLamports }, { status: 400 });
  }
  const ownerSecretB58 = launchSecretB58;
  let lastErr: any;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await createDepositForOwner({ amountLamports: depositLamports, ownerSecretB58 });
      lastErr = null;
      break;
    } catch (e: any) {
      lastErr = e;
      depositLamports = Math.floor(depositLamports * 0.9);
      if (depositLamports < Math.floor(0.001 * LAMPORTS_PER_SOL)) break;
    }
  }
  if (lastErr) {
    return NextResponse.json({ error: 'deposit_failed', stage: 'return', message: lastErr?.message, attemptedLamports: depositLamports, balanceLamports }, { status: 400 });
  }
  const { platformWallet } = await getOrCreatePlatformWallet(user.sub);
  try {
    const result = await withdrawForOwner({ ownerSecretB58, lamports: depositLamports, toAddress: platformWallet });
    return NextResponse.json({ ok: true, claimSig, returnedLamports: depositLamports, to: platformWallet, result });
  } catch (e: any) {
    return NextResponse.json({ error: 'withdraw_failed', stage: 'return', message: e?.message, to: platformWallet }, { status: 400 });
  }
}