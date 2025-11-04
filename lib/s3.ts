import { env } from '@/lib/env';

export function getUploadsPrefix() {
  const p = env.UPLOADS_PREFIX || 'uploads';
  return p.replace(/^\/+|\/+$/g, '');
}


