"use client";
import Link from 'next/link';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useWallet } from '@solana/wallet-adapter-react';
import { ensureLogin } from '@/lib/client-auth';

export default function SignInPage() {
  const { connected, publicKey, signMessage } = useWallet();

  async function handleEnsureLogin() {
    if (!connected || !publicKey || !signMessage) return;
    await ensureLogin(publicKey, signMessage);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <div className="card space-y-4">
        <p className="text-sm text-zinc-300">Connect your Solana wallet to sign in.</p>
        <div className="flex items-center gap-3">
          <WalletMultiButton />
          {connected && (
            <button className="btn" onClick={handleEnsureLogin}>Sign in</button>
          )}
          {connected && (
            <Link href="/dashboard" className="btn">Go to dashboard</Link>
          )}
        </div>
      </div>
    </div>
  );
}


