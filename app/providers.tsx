"use client";
import type { ReactNode } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import '@solana/wallet-adapter-react-ui/styles.css';
import { ToastProvider } from '@/lib/toast';

export function Providers({ children }: { children: ReactNode }) {
  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  const wallets = useMemo(() => [
    new PhantomWalletAdapter(),
  ], []);
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <ToastProvider>
            {children}
            <WalletSessionSync />
          </ToastProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

function WalletSessionSync() {
  const { connected } = useWallet();
  const router = useRouter();
  const prevConnectedRef = useRef<boolean | null>(null);

  useEffect(() => {
    const prev = prevConnectedRef.current;
    prevConnectedRef.current = connected;
    if (prev === null) return; // ignore initial render
    if (prev && !connected) {
      // Wallet was disconnected → clear session and go home
      fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
        router.push('/');
      });
    }
  }, [connected, router]);

  return null;
}


