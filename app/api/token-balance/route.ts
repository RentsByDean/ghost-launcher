import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';
import { verifySessionJwt } from '@/lib/auth';
import { getConnection } from '@/lib/solana';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const rl = await rateLimit(req, 'token-balance');
  if (!rl.allowed) return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  const user = await verifySessionJwt(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const ownerStr = searchParams.get('owner') || undefined;
  const mintStr = searchParams.get('mint') || undefined;
  if (!ownerStr || !mintStr) return NextResponse.json({ error: 'owner and mint required' }, { status: 400 });

  try {
    const owner = new PublicKey(ownerStr);
    const mint = new PublicKey(mintStr);
    const connection = getConnection();

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

    return NextResponse.json({ balanceUi: total, decimals });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 400 });
  }
}


