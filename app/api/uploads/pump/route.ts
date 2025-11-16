import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

function asString(value: FormDataEntryValue | null): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function normalizeIpfsUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('ipfs://')) {
    const cleaned = url.replace('ipfs://', '');
    return `https://ipfs.io/ipfs/${cleaned}`;
  }
  return url;
}

export async function POST(req: NextRequest) {
  let incoming: FormData;
  try {
    incoming = await req.formData();
  } catch {
    return NextResponse.json({ error: 'invalid_multipart', message: 'Expected multipart/form-data body' }, { status: 400 });
  }

  const fileEntry = incoming.get('file');
  if (!fileEntry || !(fileEntry instanceof File)) {
    return NextResponse.json({ error: 'file_required', message: 'Upload must include a file field' }, { status: 400 });
  }

  const name = asString(incoming.get('name')) || 'Ghost Launch Token';
  const symbol = asString(incoming.get('symbol')) || 'TOKEN';
  const description = asString(incoming.get('description')) || 'Created via Ghost Launch';
  const twitter = asString(incoming.get('twitter'));
  const telegram = asString(incoming.get('telegram'));
  const website = asString(incoming.get('website'));
  const showName = asString(incoming.get('showName')) || 'true';

  const forward = new FormData();
  forward.append('name', name);
  forward.append('symbol', symbol);
  forward.append('description', description);
  forward.append('showName', showName);
  if (twitter) forward.append('twitter', twitter);
  if (telegram) forward.append('telegram', telegram);
  if (website) forward.append('website', website);
  forward.append('file', fileEntry, fileEntry.name || 'upload.png');

  const pumpUrl = env.PUMPFUN_IPFS_URL || 'https://pump.fun/api/ipfs';

  let response: Response;
  try {
    response = await fetch(pumpUrl, { method: 'POST', body: forward });
  } catch (e: any) {
    return NextResponse.json(
      { error: 'pump_ipfs_unreachable', message: e?.message || 'Failed to reach Pump.fun IPFS endpoint' },
      { status: 502 }
    );
  }

  const text = await response.text();
  let payload: any = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      // ignore – payload stays null
    }
  }

  if (!response.ok) {
    const message = payload?.message || payload?.error || text || 'Pump.fun IPFS upload failed';
    return NextResponse.json({ error: 'pump_ipfs_failed', message }, { status: response.status });
  }

  const metadataUri =
    typeof payload?.metadataUri === 'string'
      ? payload.metadataUri
      : typeof payload?.metadata?.uri === 'string'
        ? payload.metadata.uri
        : undefined;
  const rawImage =
    typeof payload?.metadata?.image === 'string'
      ? payload.metadata.image
      : typeof payload?.imageUri === 'string'
        ? payload.imageUri
        : undefined;
  const imageUrl = normalizeIpfsUrl(rawImage);

  return NextResponse.json({
    ok: true,
    metadataUri: metadataUri || null,
    imageUrl: imageUrl || null,
  });
}

