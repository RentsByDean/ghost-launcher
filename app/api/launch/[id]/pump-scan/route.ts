import { NextRequest, NextResponse } from 'next/server';
import { verifySessionJwt } from '@/lib/auth';
import { getLaunch, updateLaunch } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rl = await rateLimit(req, 'pump-scan');
  if (!rl.allowed) return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  const user = await verifySessionJwt(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const rec = await getLaunch(id);
  if (!rec || rec.userSub !== user.sub) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!rec.launchWallet) return NextResponse.json({ error: 'No launch wallet' }, { status: 400 });

  const url = `https://frontend-api-v3.pump.fun/coins/user-created-coins/${rec.launchWallet}?offset=0&limit=10&includeNsfw=false`;
  const r = await fetch(url, { cache: 'no-store', headers: { 'accept': 'application/json' } });
  if (!r.ok) return NextResponse.json({ error: 'Upstream error' }, { status: 502 });
  const data = await r.json();
  const first = Array.isArray(data?.coins) && data.coins.length ? data.coins[0] : null;
  const mint: string | null = first?.mint || null;

  if (mint && (!rec.pump?.mint || rec.pump.mint !== mint)) {
    await updateLaunch(rec.id, { pump: { ...(rec.pump || {}), mint } });
  }
  return NextResponse.json({ mint, coin: first || null });
}


