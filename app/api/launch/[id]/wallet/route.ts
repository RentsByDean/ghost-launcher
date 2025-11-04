import { NextRequest, NextResponse } from 'next/server';
import { getLaunch, updateLaunch } from '@/lib/db';
import { verifySessionJwt } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const rl = await rateLimit(req, 'launch-wallet');
  if (!rl.allowed) return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  const user = await verifySessionJwt(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const rec = await getLaunch(id);
  if (!rec || rec.userSub !== user.sub) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await req.json();
  if (!body?.launchWallet || typeof body.launchWallet !== 'string') {
    return NextResponse.json({ error: 'launchWallet required' }, { status: 400 });
  }
  await updateLaunch(rec.id, { launchWallet: body.launchWallet });
  return NextResponse.json({ ok: true });
}


