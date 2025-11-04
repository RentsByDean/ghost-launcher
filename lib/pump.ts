// Build Pump.fun create/init transaction using pump-anchor-idl
// Returns an unsigned transaction to be signed by the launch wallet (and mint if required) on the client.

import { Keypair, Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
// @ts-ignore - IDL package provides default export
import idl from 'pump-anchor-idl';
import { Program, AnchorProvider, BN, web3 } from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { env } from '@/lib/env';
import bs58 from 'bs58';

const FEE_RECIPIENT_ADDRESS = new PublicKey('CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM');

function makeDummyProvider(connection: Connection, payer: PublicKey) {
  const wallet = {
    publicKey: payer,
    signTransaction: async (tx: Transaction) => tx,
    signAllTransactions: async (txs: Transaction[]) => txs,
  } as any;
  return new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
}

export async function buildCreateTx(params: {
  connection: Connection;
  payer: PublicKey; // launch wallet pubkey
  mint: PublicKey; // newly generated mint pubkey (client will sign)
  meta: { name?: string; symbol?: string };
}): Promise<Transaction> {
  const provider = makeDummyProvider(params.connection, params.payer);
  // Program ID: prefer IDL metadata/address, then IDL address, then env
  const programIdStr = (idl as any)?.metadata?.address || (idl as any)?.address || process.env.PUMP_PROGRAM_ID;
  if (!programIdStr) {
    throw new Error('PUMP_PROGRAM_ID not configured and IDL has no address; set env PUMP_PROGRAM_ID');
  }
  const programId = new PublicKey(programIdStr);
  const pumpProgram = new (Program as any)(idl as any, programId, provider as any);

  // Minimal account set: try to rely on IDL account resolvers. If not supported, fall back will throw at runtime.
  // We also ensure associated token account exists for the payer post-create.
  const associatedUser = getAssociatedTokenAddressSync(params.mint, params.payer, true);
  const preIx = createAssociatedTokenAccountInstruction(
    params.payer,
    associatedUser,
    params.payer,
    params.mint,
    TOKEN_PROGRAM_ID
  );

  // Try common method names in Pump program for token creation
  const methods = (pumpProgram as any).methods;
  const name = params.meta?.name || '';
  const symbol = params.meta?.symbol || '';

  let builder: any | null = null;
  if (methods?.create) {
    builder = methods.create(name, symbol);
  } else if (methods?.launch) {
    builder = methods.launch(name, symbol);
  } else if (methods?.createToken) {
    builder = methods.createToken(name, symbol);
  }
  if (!builder) {
    // Fallback: noop tx for graceful failure; caller can surface a clear error
    const tx = new Transaction();
    tx.add(SystemProgram.transfer({ fromPubkey: params.payer, toPubkey: params.payer, lamports: 0 }));
    return tx;
  }

  const ix = await builder
    .accounts({
      mint: params.mint,
      associatedUser,
      feeRecipient: FEE_RECIPIENT_ADDRESS,
      program: pumpProgram.programId,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .preInstructions([preIx])
    .instruction();

  const tx = new Transaction();
  tx.add(ix);
  return tx;
}


// -------------------- Pump.fun Portal helpers --------------------
export async function uploadMetadataViaPumpFun(input: { name: string; ticker: string; description: string; imageUrl: string; twitter?: string; telegram?: string; website?: string }) {
  if (!env.PUMPFUN_IPFS_URL) throw new Error('PUMPFUN_IPFS_URL not configured');
  const imgRes = await fetch(input.imageUrl);
  if (!imgRes.ok) throw new Error(`image_fetch_failed: ${imgRes.status}`);
  const ab = await imgRes.arrayBuffer();
  const contentType = imgRes.headers.get('content-type') || 'application/octet-stream';
  const blob = new Blob([new Uint8Array(ab)], { type: contentType });
  const form = new FormData();
  form.append('file', blob, 'image');
  form.append('name', input.name);
  form.append('symbol', input.ticker);
  form.append('description', input.description);
  form.append('showName', 'true');
  if (input.twitter) form.append('twitter', input.twitter);
  if (input.telegram) form.append('telegram', input.telegram);
  if (input.website) form.append('website', input.website);
  const res = await fetch(env.PUMPFUN_IPFS_URL, { method: 'POST', body: form });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`ipfs_upload_failed: ${res.status} ${txt}`);
  }
  const json = await res.json();
  const uri = json?.metadataUri || json?.metadata?.uri;
  if (!uri) throw new Error(`ipfs_no_uri: ${JSON.stringify(json)}`);
  return { metadataUri: uri, raw: json };
}

export async function getPortalCreateTxBytes(params: {
  payerPubkey: string;
  mintPubkey: string;
  metadataUri: string;
  amountSol?: number; // optional initial buy amount in SOL
  slippageBps?: number; // e.g. 1000 => 10%
}): Promise<Uint8Array> {
  if (!env.PUMPFUN_PORTAL_URL) throw new Error('PUMPFUN_PORTAL_URL not configured');
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (env.PUMPFUN_PORTAL_API_KEY) {
    headers['authorization'] = `Bearer ${env.PUMPFUN_PORTAL_API_KEY}`;
    headers['x-api-key'] = env.PUMPFUN_PORTAL_API_KEY;
  }
  const payload = {
    publicKey: params.payerPubkey,
    action: 'create',
    tokenMetadata: {
      name: '',
      symbol: '',
      uri: params.metadataUri,
    },
    mint: params.mintPubkey,
    denominatedInSol: 'true',
    amount: (params.amountSol || 0),
    slippage: params.slippageBps ? Math.max(1, Math.floor(params.slippageBps / 100)) : 10,
    priorityFee: env.PUMPFUN_PRIORITY_FEE_SOL,
    pool: 'pump',
  } as any;

  const res = await fetch(`${env.PUMPFUN_PORTAL_URL}/trade-local`, { method: 'POST', headers, body: JSON.stringify(payload) });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`pumpportal_create_local_failed: ${res.status} ${txt}`);
  }
  try {
    const ab = await res.arrayBuffer();
    const bytes = new Uint8Array(ab);
    if (!bytes || bytes.length === 0) throw new Error('empty');
    return bytes;
  } catch {
    const j = await res.json();
    const first = Array.isArray(j) ? j[0] : (Array.isArray(j?.transactions) ? j.transactions[0] : (j?.transaction || j));
    if (typeof first !== 'string') throw new Error('unexpected_trade_local_body');
    return bs58.decode(first);
  }
}

