import { NextRequest, NextResponse } from 'next/server';
import { verifySessionJwt } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { getLaunch } from '@/lib/db';
import { env } from '@/lib/env';
import { getConnection } from '@/lib/solana';
import { decryptSecret } from '@/lib/crypto';
import bs58 from 'bs58';
import { Keypair, PublicKey, VersionedTransaction } from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, 'job-sell');
  if (!rl.allowed) return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  const user = await verifySessionJwt(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, percent, mint: mintOverride } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const pct = Number(percent);
  if (!pct || pct <= 0 || pct > 100) return NextResponse.json({ error: 'invalid_percent' }, { status: 400 });

  const rec = await getLaunch(id);
  if (!rec || rec.userSub !== user.sub) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!rec.launchWallet || !rec.launchWalletEnc) return NextResponse.json({ error: 'No launch wallet' }, { status: 400 });

  const mintBase58 = rec.pump?.mint || mintOverride;
  if (!mintBase58) return NextResponse.json({ error: 'No mint set' }, { status: 400 });

  const connection = getConnection();
  const owner = new PublicKey(rec.launchWallet);
  const mint = new PublicKey(mintBase58);

  // Aggregate token balance across accounts (Token + Token-2022)
  let total = 0;
  let decimals: number | null = null;
  const addAmount = (amt: any) => {
    const d = typeof amt?.decimals === 'number' ? amt.decimals : null;
    const str = (amt?.uiAmountString ?? (typeof amt?.amount === 'string' && d !== null ? (Number(amt.amount) / Math.pow(10, d)).toString() : '0')) as string;
    const num = parseFloat(str || '0');
    if (!Number.isNaN(num)) total += num;
    if (d !== null) decimals = d;
  };
  
  try {
    const res = await connection.getParsedTokenAccountsByOwner(owner, { mint });
    for (const a of res.value) {
      const info: any = a.account.data.parsed.info;
      if (info.mint === mint.toBase58()) addAmount(info.tokenAmount);
    }
  } catch {}
  try {
    const res22 = await connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_2022_PROGRAM_ID });
    for (const a of res22.value) {
      const info: any = a.account.data.parsed.info;
      if (info.mint === mint.toBase58()) addAmount(info.tokenAmount);
    }
  } catch {}

  const balanceUi = total;
  const sellUiRaw = Math.max(0, (balanceUi * pct) / 100);
  const dec = typeof decimals === 'number' ? decimals : 6;
  const factor = Math.pow(10, Math.min(6, dec));
  const sellUi = Math.floor(sellUiRaw * factor) / factor; // truncate to safe precision
  if (sellUi <= 0) return NextResponse.json({ error: 'no_tokens_to_sell', balanceUi }, { status: 400 });

  // Build trade via Pump Portal
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
      action: 'sell',
      mint: mintBase58,
      denominatedInSol: 'false',
      amount: sellUi,
      slippage: 10,
      priorityFee: env.PUMPFUN_PRIORITY_FEE_SOL || 0.00001,
      pool: 'auto',
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    return NextResponse.json({ error: 'portal_failed', status: res.status, body: txt }, { status: 400 });
  }

  // Deserialize, sign and send with launch wallet
  const launchSecretB58 = await decryptSecret(rec.launchWalletEnc!, process.env.APP_JWT_SECRET!);
  const launchKp = Keypair.fromSecretKey(bs58.decode(launchSecretB58));

  let raw: Uint8Array;
  try {
    const ab = await res.arrayBuffer();
    raw = new Uint8Array(ab);
  } catch {
    const j = await res.json();
    const first = Array.isArray(j) ? j[0] : (Array.isArray(j?.transactions) ? j.transactions[0] : (j?.transaction || j));
    if (typeof first !== 'string') return NextResponse.json({ error: 'unexpected_portal_body' }, { status: 400 });
    raw = bs58.decode(first);
  }
  const vtx = VersionedTransaction.deserialize(raw);
  try { vtx.sign([launchKp]); } catch {}
  const sim = await connection.simulateTransaction(vtx, { sigVerify: true });
  if (sim.value.err) {
    return NextResponse.json({ error: 'simulate_failed', logs: sim.value.logs, details: sim.value.err }, { status: 400 });
  }
  const sig = await connection.sendRawTransaction(vtx.serialize(), { skipPreflight: false });
  await connection.confirmTransaction(sig, 'finalized');
  return NextResponse.json({ ok: true, txSig: sig, soldUi: sellUi, balanceUi, percent: pct });
}


