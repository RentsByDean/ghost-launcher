import { NextRequest, NextResponse } from 'next/server';
import { getLaunch, updateLaunch } from '@/lib/db';
import { verifySessionJwt } from '@/lib/auth';
import { getDepositStatus } from '@/lib/privacy-cash';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const rl = await rateLimit(req, 'launch-status');
  if (!rl.allowed) return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  const user = await verifySessionJwt(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const rec = await getLaunch(id);
  if (!rec || rec.userSub !== user.sub) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Opportunistically update deposit status
  if (rec.privacyCash?.depositId && rec.status?.startsWith('deposit')) {
    try {
      const st = await getDepositStatus(rec.privacyCash.depositId);
      if (st?.status && st.status !== rec.privacyCash.status) {
        await updateLaunch(rec.id, { privacyCash: { ...rec.privacyCash, status: st.status }, status: st.status });
      }
    } catch {}
  }

  const latest = await getLaunch(id);
  return NextResponse.json(latest || rec);
}


