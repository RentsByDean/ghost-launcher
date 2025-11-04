import { NextRequest, NextResponse } from 'next/server';
import { verifySessionJwt } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { getOrCreatePlatformWallet } from '@/lib/user-wallet';
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';

export async function GET(req: NextRequest) {
  const rl = await rateLimit(req, 'user-wallets-get');
  if (!rl.allowed) return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  const user = await verifySessionJwt(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { platformWallet } = await getOrCreatePlatformWallet(user.sub);
  let balanceLamports: number | undefined;
  try {
    const rpcUrl = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl('mainnet-beta');
    const connection = new Connection(rpcUrl, 'confirmed');
    balanceLamports = await connection.getBalance(new PublicKey(platformWallet));
  } catch {}
  return NextResponse.json({ platformWallet, balanceLamports });
}

export async function POST() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}

