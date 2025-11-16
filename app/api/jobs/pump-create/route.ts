import { NextRequest, NextResponse } from 'next/server';
import { getLaunch, updateLaunch } from '@/lib/db';
import { verifySessionJwt } from '@/lib/auth';
import { uploadMetadataViaPumpFun, getPortalCreateTxBytes } from '@/lib/pump';
import { env } from '@/lib/env';
import { getConnection } from '@/lib/solana';
import { Keypair, PublicKey, VersionedTransaction, SendTransactionError, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { decryptSecret } from '@/lib/crypto';
import bs58 from 'bs58';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, 'job-pump-create');
  if (!rl.allowed) return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  const user = await verifySessionJwt(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const rec = await getLaunch(id);
  if (!rec || rec.userSub !== user.sub) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!rec.launchWallet) return NextResponse.json({ error: 'No launchWallet set' }, { status: 400 });
  if (!rec.launchWalletEnc) return NextResponse.json({ error: 'No server launch key stored' }, { status: 400 });

  // Decrypt server-held launch wallet keypair
  const secretB58 = await decryptSecret(rec.launchWalletEnc, process.env.APP_JWT_SECRET!);
  const launchKp = Keypair.fromSecretKey(bs58.decode(secretB58));
  // Generate mint on server
  const mintKp = Keypair.generate();

  // Pump.fun Portal only
  const meta: any = rec.meta || {};
  if (!meta?.imageUrl || !meta?.desc || !meta?.name || !meta?.symbol) {
    return NextResponse.json({ error: 'missing_metadata' }, { status: 400 });
  }
  let metadataUri: string | undefined = meta.metadataUri;
  if (!metadataUri) {
    const uploaded = await uploadMetadataViaPumpFun({
      name: meta.name,
      ticker: meta.symbol,
      description: meta.desc,
      imageUrl: meta.imageUrl,
      twitter: meta.twitter,
      telegram: meta.telegram,
      website: meta.website,
    });
    metadataUri = uploaded.metadataUri;
    try {
      await updateLaunch(rec.id, { meta: { ...rec.meta, metadataUri } });
    } catch (e) {
      console.warn('[pump-create] failed to persist metadataUri', e);
    }
  }
  if (!metadataUri) {
    return NextResponse.json({ error: 'missing_metadata_uri' }, { status: 400 });
  }
  // Calculate buy amount from current balance: keep 0.005 SOL reserve and cover create costs
  const connection = getConnection();
  const balanceLamports = await connection.getBalance(new PublicKey(rec.launchWallet));
  const MIN_CREATE_LAMPORTS = 50_000_000; // 0.05 SOL typical create+rent cost
  const RESERVE_LAMPORTS = Math.floor(0.005 * LAMPORTS_PER_SOL); // leave 0.005 SOL after
  const SAFETY_LAMPORTS = 1_000_000; // small buffer
  const availableLamports = Math.max(0, balanceLamports - MIN_CREATE_LAMPORTS - RESERVE_LAMPORTS - SAFETY_LAMPORTS);
  const amountSol = availableLamports > 0 ? (availableLamports / LAMPORTS_PER_SOL) : 0;
  const payerPubkey = rec.launchWallet;
  const bytes = await getPortalCreateTxBytes({
    payerPubkey,
    mintPubkey: mintKp.publicKey.toBase58(),
    metadataUri,
    amountSol,
    slippageBps: 1000,
  });
  // Sign and submit on server
  let sig: string;
  const raw = Uint8Array.from(bytes);
  // Pump Portal returns versioned transactions for trade-local
  const vtx = VersionedTransaction.deserialize(raw);
  // Derive required signers and fee payer (first required signer)
  const msg: any = vtx.message as any;
  const header = msg?.header || { numRequiredSignatures: 0 };
  const staticKeys = (msg?.staticAccountKeys || msg?.accountKeys || []) as any[];
  const normalize = (k: any) => (typeof k === 'string' ? k : (k?.toBase58 ? k.toBase58() : String(k)));
  const accountKeys = staticKeys.map(normalize);
  const requiredSigners = accountKeys.slice(0, header.numRequiredSignatures || 0);
  const feePayer = requiredSigners[0];
  // Sign only with keys that are actually required
  const candidates = [mintKp, launchKp];
  const signersToUse = candidates.filter((kp) => requiredSigners.includes(kp.publicKey.toBase58()));
  const signed = signersToUse.map((kp) => kp.publicKey.toBase58());
  if (signersToUse.length === 0) {
    return NextResponse.json({ error: 'no_matching_signers', requiredSigners, feePayer, have: candidates.map(c => c.publicKey.toBase58()) }, { status: 400 });
  }
  try { vtx.sign(signersToUse as any); } catch {}
  // Optional preflight simulate for clearer errors
  try {
    const sim = await connection.simulateTransaction(vtx, { sigVerify: true });
    if (sim.value.err) {
      const payerBalance = await connection.getBalance(new PublicKey(feePayer)).catch(() => undefined);
      return NextResponse.json({ error: 'simulate_failed', logs: sim.value.logs, details: sim.value.err, requiredSigners, feePayer, signed, payerUsed: payerPubkey, mintGenerated: mintKp.publicKey.toBase58(), payerBalance }, { status: 400 });
    }
  } catch (e: any) {
    // Try without sigVerify to at least surface logs
    try {
      const sim2 = await connection.simulateTransaction(vtx, { sigVerify: false });
      const payerBalance = await connection.getBalance(new PublicKey(feePayer)).catch(() => undefined);
      return NextResponse.json({ error: 'simulate_failed', logs: sim2.value.logs, details: sim2.value.err, requiredSigners, feePayer, signed, payerUsed: payerPubkey, mintGenerated: mintKp.publicKey.toBase58(), payerBalance }, { status: 400 });
    } catch {}
    return NextResponse.json({ error: 'simulate_failed', message: e?.message, requiredSigners, feePayer, signed, payerUsed: payerPubkey, mintGenerated: mintKp.publicKey.toBase58() }, { status: 400 });
  }
  try {
    sig = await connection.sendRawTransaction(vtx.serialize(), { skipPreflight: false });
  } catch (e: any) {
    let logs: string[] | undefined;
    try {
      if (typeof (e as any)?.getLogs === 'function') {
        logs = await (e as any).getLogs(connection);
      }
    } catch {}
    return NextResponse.json({ error: 'send_failed', message: e?.message, logs }, { status: 400 });
  }
  await connection.confirmTransaction(sig, 'finalized');
  await updateLaunch(rec.id, { status: 'launched', pump: { ...(rec.pump || {}), txSig: sig, mint: mintKp.publicKey.toBase58(), status: 'launched' } });
  return NextResponse.json({ ok: true, txSig: sig, mint: mintKp.publicKey.toBase58() });
}


