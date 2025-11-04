import { getLaunch, updateLaunch, redis } from '@/lib/db';
import { getDepositStatus, withdrawForOwner } from '@/lib/privacy-cash';
import { decryptSecret } from '@/lib/crypto';
import { PublicKey } from '@solana/web3.js';

type WithdrawResult = { ok?: boolean; result?: any; status?: string };

export async function withdrawToLaunchWallet({ userSub, launchId }: { userSub: string; launchId: string }): Promise<WithdrawResult> {
  const rec = await getLaunch(launchId);
  if (!rec || rec.userSub !== userSub) {
    const err: any = new Error('Not found');
    err.status = 404;
    throw err;
  }
  if (!rec.launchWallet) {
    const err: any = new Error('No launchWallet set');
    err.status = 400;
    throw err;
  }

  const st = await getDepositStatus(String(rec.privacyCash?.depositId || rec.amountLamports));
  const incomingStatus = st?.status || rec.status;
  const isReady = incomingStatus === 'mixed' || incomingStatus === 'ready' || incomingStatus === 'complete' || incomingStatus === 'ok';

  if (isReady) {
    await updateLaunch(rec.id, { status: 'withdrawing', privacyCash: { ...rec.privacyCash, status: incomingStatus } });
    let result: any;
    try {
      const encKey = await redis.get<string>(`user:${userSub}:platformWalletEnc`);
      if (!encKey) {
        throw new Error('Platform wallet not initialized');
      }
      // Validate recipient address to avoid library defaulting to owner
      new PublicKey(rec.launchWallet);
      const ownerSecretB58 = await decryptSecret(encKey, process.env.APP_JWT_SECRET!);
      result = await withdrawForOwner({ ownerSecretB58, lamports: rec.amountLamports, toAddress: rec.launchWallet });
    } catch (e: any) {
      await updateLaunch(rec.id, { status: 'withdraw_error', privacyCash: { ...rec.privacyCash, status: 'withdraw_error' } });
      const err: any = new Error(e?.message || 'withdraw_failed');
      err.status = 400;
      throw err;
    }
    await updateLaunch(rec.id, { status: 'withdrawn', privacyCash: { ...rec.privacyCash, status: 'withdrawn' } });
    return { ok: true, result, status: 'withdrawn' };
  }

  if (incomingStatus === rec.privacyCash?.status) {
    return { status: incomingStatus };
  }

  await updateLaunch(rec.id, { privacyCash: { ...rec.privacyCash, status: incomingStatus }, status: incomingStatus });
  return { status: incomingStatus };
}


