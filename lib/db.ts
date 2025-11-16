import { Redis } from '@upstash/redis';

let redis: Redis | null = null;

export function getRedis() {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error(
      'Upstash Redis env vars missing. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.'
    );
  }

  redis = new Redis({ url, token });
  return redis;
}

export type LaunchRecord = {
  id: string;
  userSub: string;
  amountLamports: number;
  platformWallet: string;
  launchWallet?: string;
  launchWalletEnc?: string;
  meta?: {
    name?: string;
    symbol?: string;
    desc?: string;
    imageUrl?: string;
    metadataUri?: string;
    bannerUrl?: string;
    twitter?: string;
    telegram?: string;
    website?: string;
    durationMinutes?: number;
    initialBuyAmount?: string | number;
  };
  privacyCash?: {
    depositId?: string;
    depositAddress?: string;
    status?: string;
  };
  pump?: {
    txSig?: string;
    mint?: string;
    status?: string;
    mintEnc?: string;
  };
  status: string;
  createdAt: number;
  updatedAt: number;
};

export async function putLaunch(rec: LaunchRecord) {
  const client = getRedis();
  await client.json.set(`launch:${rec.id}`, '$', rec as any);
  await client.sadd(`user:${rec.userSub}:launches`, rec.id);
}

export async function getLaunch(id: string) {
  const client = getRedis();
  return (await client.json.get(`launch:${id}`)) as LaunchRecord | null;
}

export async function updateLaunch(id: string, partial: Partial<LaunchRecord>) {
  const client = getRedis();
  const curr = await getLaunch(id);
  if (!curr) return null;
  const next = { ...curr, ...partial, updatedAt: Date.now() } as LaunchRecord;
  await putLaunch(next);
  return next;
}

export async function ensureUser(sub: string, platformWallet?: string) {
  const client = getRedis();
  // store platform wallet address if provided
  if (platformWallet) {
    await client.set(`user:${sub}:platformWallet`, platformWallet);
  }
  const existing = (await client.get<string>(`user:${sub}:platformWallet`)) || platformWallet;
  return { platformWallet: existing };
}

export async function getUserLaunches(sub: string): Promise<LaunchRecord[]> {
  const client = getRedis();
  const ids = (await client.smembers(`user:${sub}:launches`)) as string[];
  const records = await Promise.all(ids.map((id: string) => getLaunch(id)));
  return records.filter((r): r is LaunchRecord => Boolean(r));
}


