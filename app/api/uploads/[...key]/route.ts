import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { getUploadsPrefix } from '@/lib/s3'
import { uploadToS3 } from '@/lib/storage'
import { redis } from '@/lib/redis'

export const dynamic = 'force-dynamic'

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ key: string[] }> } | { params: { key: string[] } }
) {
  if ((env.STORAGE_PROVIDER || 's3') !== 's3') {
    return NextResponse.json({ error: 's3_disabled' }, { status: 400 })
  }

  if (!env.AWS_REGION || !env.S3_BUCKET) {
    return NextResponse.json(
      { error: 'missing_s3_config', message: 'AWS_REGION/S3_BUCKET not configured' },
      { status: 500 }
    )
  }

  // Next.js may provide params as a Promise in edge runtimes – unwrap if needed
  // https://nextjs.org/docs/messages/sync-dynamic-apis
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resolved = 'then' in (ctx as any).params ? await (ctx as any).params : (ctx as any).params
  const rawParts = Array.isArray(resolved.key) ? resolved.key : []
  const parts = rawParts.map((p: string) => decodeURIComponent(p))
  const key = parts.join('/')
  const prefix = getUploadsPrefix()
  if (!key || !key.startsWith(prefix + '/')) {
    return NextResponse.json({ error: 'invalid_key' }, { status: 400 })
  }

  const contentType = req.headers.get('content-type') || 'application/octet-stream'
  const ab = await req.arrayBuffer()
  const bytes = new Uint8Array(ab)

  try {
    const { key: objectKey, publicUrl } = await uploadToS3(key, bytes, contentType)
    const meta = { key: objectKey, contentType, publicUrl, createdAt: Date.now() }
    await redis.set(`uploads:${key}`, meta)
    const proxyUrl = `${(env.APP_URL || '').replace(/\/$/, '')}/api/uploads/${key}`
    return NextResponse.json({ ok: true, key, publicUrl, proxyUrl })
  } catch (e: any) {
    return NextResponse.json(
      { error: 'upload_failed', message: e?.message || String(e) },
      { status: 500 }
    )
  }
}


