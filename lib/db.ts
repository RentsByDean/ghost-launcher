import { Redis } from '@upstash/redis';

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

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
  await redis.json.set(`launch:${rec.id}`, '$', rec as any);
  await redis.sadd(`user:${rec.userSub}:launches`, rec.id);
}

export async function getLaunch(id: string) {
  return (await redis.json.get(`launch:${id}`)) as LaunchRecord | null;
}

export async function updateLaunch(id: string, partial: Partial<LaunchRecord>) {
  const curr = await getLaunch(id);
  if (!curr) return null;
  const next = { ...curr, ...partial, updatedAt: Date.now() } as LaunchRecord;
  await putLaunch(next);
  return next;
}

export async function ensureUser(sub: string, platformWallet?: string) {
  // store platform wallet address if provided
  if (platformWallet) {
    await redis.set(`user:${sub}:platformWallet`, platformWallet);
  }
  const existing = (await redis.get<string>(`user:${sub}:platformWallet`)) || platformWallet;
  return { platformWallet: existing };
}

export async function getUserLaunches(sub: string): Promise<LaunchRecord[]> {
  const ids = (await redis.smembers(`user:${sub}:launches`)) as string[];
  const records = await Promise.all(ids.map((id: string) => getLaunch(id)));
  return records.filter((r): r is LaunchRecord => Boolean(r));
}


