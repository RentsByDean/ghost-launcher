import { NextRequest, NextResponse } from 'next/server';
import { verifySessionJwt } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { withdrawToLaunchWallet } from '@/lib/launch/withdraw';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const rl = await rateLimit(req, 'job-withdraw');
  if (!rl.allowed) return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  const user = await verifySessionJwt(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  try {
    const res = await withdrawToLaunchWallet({ userSub: user.sub, launchId: id });
    return NextResponse.json(res);
  } catch (e: any) {
    const status = e?.status && Number.isFinite(e.status) ? e.status : 400;
    const message = e?.message || 'withdraw_failed';
    return NextResponse.json({ error: message }, { status });
  }
}


