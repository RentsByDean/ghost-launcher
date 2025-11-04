import { clusterApiUrl, Connection } from '@solana/web3.js';

export function getConnection() {
  const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'mainnet-beta';
  const url = cluster === 'mainnet-beta'
    ? (process.env.SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl('mainnet-beta'))
    : clusterApiUrl('mainnet-beta');
  return new Connection(url, 'confirmed');
}


