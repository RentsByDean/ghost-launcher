"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { ensureLogin } from '@/lib/client-auth';

export default function LoginPage() {
  const router = useRouter();
  const { connected, publicKey, signMessage } = useWallet();

  useEffect(() => {
    (async () => {
      if (!connected || !publicKey || !signMessage) return;
      try {
        await ensureLogin(publicKey, signMessage);
        router.push('/dashboard');
      } catch {
        // ignore and let user retry
      }
    })();
  }, [connected, publicKey, signMessage, router]);

  return (
    <div className="max-w-md mx-auto">
      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <img src="/ghost.svg" alt="Ghost Launcher" className="h-6 w-6" />
          <h1 className="text-xl font-semibold">Ghost Launcher</h1>
        </div>
        <p className="text-sm text-zinc-400">Connect a wallet and sign a message to continue.</p>
        <div className="flex gap-3">
          <WalletMultiButton />
        </div>
        {!signMessage && (
          <div className="rounded-md border border-yellow-700 bg-yellow-950 p-3 text-yellow-200 text-sm">
            Your wallet must support message signing.
          </div>
        )}
      </div>
    </div>
  );
}


