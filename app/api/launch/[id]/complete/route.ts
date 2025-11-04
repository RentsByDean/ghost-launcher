import { NextRequest, NextResponse } from 'next/server';
import { getLaunch, updateLaunch } from '@/lib/db';
import { verifySessionJwt } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const rl = await rateLimit(req, 'launch-complete');
  if (!rl.allowed) return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  const user = await verifySessionJwt(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const rec = await getLaunch(id);
  if (!rec || rec.userSub !== user.sub) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await req.json();
  const txSig = body?.txSig as string | undefined;
  const mint = body?.mint as string | undefined;
  if (!txSig && !mint) return NextResponse.json({ error: 'txSig or mint required' }, { status: 400 });
  await updateLaunch(rec.id, { pump: { ...(rec.pump || {}), txSig, mint, status: 'launched' }, status: 'launched' });
  return NextResponse.json({ ok: true });
}


