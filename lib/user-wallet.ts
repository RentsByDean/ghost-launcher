import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { redis } from '@/lib/db';
import { encryptSecret } from '@/lib/crypto';

const platformWalletKey = (sub: string) => `user:${sub}:platformWallet`;
const platformWalletEncKey = (sub: string) => `user:${sub}:platformWalletEnc`;

export async function getOrCreatePlatformWallet(sub: string): Promise<{ platformWallet: string }> {
  const addrKey = platformWalletKey(sub);
  const encKey = platformWalletEncKey(sub);

  const existingAddress = await redis.get<string>(addrKey);
  const existingEncrypted = await redis.get<string>(encKey);

  // Migration logic: if prior code stored the login wallet address as platformWallet
  // or if there's no encrypted secret stored, rotate to a server-generated wallet.
  if (existingAddress && existingEncrypted && existingAddress !== sub) {
    return { platformWallet: existingAddress };
  }

  const keypair = Keypair.generate();
  const publicAddress = keypair.publicKey.toBase58();
  const secretB58 = bs58.encode(keypair.secretKey);
  const encryptedSecret = await encryptSecret(secretB58, process.env.APP_JWT_SECRET!);

  await redis.set(addrKey, publicAddress);
  await redis.set(encKey, encryptedSecret);

  return { platformWallet: publicAddress };
}


