import { redis } from '@/lib/db';
import { NextRequest } from 'next/server';

export async function rateLimit(req: NextRequest, key: string, limit = Number(process.env.RATE_LIMIT_MAX || 60), windowSec = Math.ceil((Number(process.env.RATE_LIMIT_WINDOW_MS || 60000)) / 1000)) {
  const headers = req.headers;
  const ip =
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('cf-connecting-ip') ||
    'ip:unknown';
  const k = `rl:${key}:${ip}`;
  const curr = await redis.incr(k);
  if (curr === 1) {
    await redis.expire(k, windowSec);
  }
  const remaining = Math.max(0, limit - curr);
  return { allowed: curr <= limit, remaining };
}


