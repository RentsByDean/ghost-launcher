import { NextRequest, NextResponse } from 'next/server';
import { getLaunch } from '@/lib/db';
import { verifySessionJwt } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { env } from '@/lib/env';
import { getConnection } from '@/lib/solana';
import { decryptSecret } from '@/lib/crypto';
import bs58 from 'bs58';
import { Keypair, PublicKey, VersionedTransaction } from '@solana/web3.js';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, 'job-claim-rewards');
  if (!rl.allowed) return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  const user = await verifySessionJwt(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const rec = await getLaunch(id);
  if (!rec || rec.userSub !== user.sub) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!rec.launchWallet || !rec.launchWalletEnc) return NextResponse.json({ error: 'No launch wallet' }, { status: 400 });

  const launchSecretB58 = await decryptSecret(rec.launchWalletEnc, process.env.APP_JWT_SECRET!);
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
      publicKey: rec.launchWallet,
      action: 'collectCreatorFee',
      priorityFee: env.PUMPFUN_PRIORITY_FEE_SOL || 0.000001,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    return NextResponse.json({ error: 'portal_failed', status: res.status, body: txt }, { status: 400 });
  }

  // Deserialize, sign and send
  const ab = await res.arrayBuffer();
  const raw = new Uint8Array(ab);
  const vtx = VersionedTransaction.deserialize(raw);
  // Sign only with launch wallet key if required
  try { vtx.sign([launchKp]); } catch {}

  const connection = getConnection();
  // Optional simulate
  const sim = await connection.simulateTransaction(vtx, { sigVerify: true });
  if (sim.value.err) {
    return NextResponse.json({ error: 'simulate_failed', logs: sim.value.logs, details: sim.value.err }, { status: 400 });
  }
  const sig = await connection.sendRawTransaction(vtx.serialize(), { skipPreflight: false });
  const resultSend = await connection.confirmTransaction(sig, 'finalized');
  
  return NextResponse.json({ ok: true, txSig: sig });
}


