import { PrivacyCash as PrivacyCashClient } from 'privacycash'

type CreateDepositArgs = {
  amountLamports: number;
};

let _client: any | null = null;
function getClient() {
  if (_client) return _client;
  const RPC_url = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  const owner = process.env.PRIVACY_CASH_OWNER_PRIVATE_KEY;
  if (!owner) throw new Error('PRIVACY_CASH_OWNER_PRIVATE_KEY is required');
  _client = new PrivacyCashClient({ RPC_url, owner });
  return _client;
}

function getClientForOwner(owner: string) {
  const RPC_url = process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  return new PrivacyCashClient({ RPC_url, owner });
}

export async function createDeposit({ amountLamports }: CreateDepositArgs) {
  const client = getClient();
  const res = await client.deposit({ lamports: amountLamports });
  return res as unknown as { txSignature?: string };
}

export async function createDepositForOwner({ amountLamports, ownerSecretB58 }: { amountLamports: number; ownerSecretB58: string }) {
  const client = getClientForOwner(ownerSecretB58);
  const res = await client.deposit({ lamports: amountLamports });
  return res as unknown as { txSignature?: string };
}

export async function getPrivateBalance() {
  const client = getClient();
  return await client.getPrivateBalance();
}

// Kept for backward compatibility with previous interface; returns balance status
export async function getDepositStatus(_unused: string) {
  const balance = await getPrivateBalance();
  return { status: 'ok', balance } as { status: string; balance: any };
}

// Note: parameter "depositId" is interpreted as lamports for compatibility migration
export async function withdraw(depositId: string | number, toAddress: string) {
  const client = getClient();
  const lamports = typeof depositId === 'number' ? depositId : Number(depositId);
  if (!Number.isFinite(lamports) || lamports <= 0) {
    throw new Error('withdraw expects lamports as first argument during migration');
  }
  return await client.withdraw({ lamports, recipientAddress: toAddress });
}

export async function withdrawForOwner({ ownerSecretB58, lamports, toAddress }: { ownerSecretB58: string; lamports: number; toAddress: string }) {
  if (!Number.isFinite(lamports) || lamports <= 0) {
    throw new Error('lamports must be > 0');
  }
  const client = getClientForOwner(ownerSecretB58);
  return await client.withdraw({ lamports, recipientAddress: toAddress });
}