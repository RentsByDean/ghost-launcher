"use client";
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/lib/toast';
import { clusterApiUrl, Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';

function short(address?: string) {
  if (!address) return '';
  return address.slice(0, 4) + '…' + address.slice(-4);
}

export default function DashboardPage() {
  const { show } = useToast();
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [platformAddress, setPlatformAddress] = useState<string | null>(null);
  const [isLoadingWallet, setIsLoadingWallet] = useState(true);

  const connection = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SOLANA_CLUSTER === 'mainnet-beta'
      ? (process.env.NEXT_PUBLIC_SOLANA_RPC_URL || process.env.SOLANA_RPC_URL || clusterApiUrl('mainnet-beta'))
      : clusterApiUrl('mainnet-beta');
    return new Connection(url, 'confirmed');
  }, []);

  const mainAddress = platformAddress || undefined;

  function formatSolMinimal(amountSol: number): string {
    // Up to 9 decimals (Solana), trim trailing zeros and trailing dot
    const s = amountSol.toFixed(9);
    return s.replace(/\.0+$/, '').replace(/(\.[0-9]*?)0+$/, '$1');
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await fetch('/api/user/wallets');
        if (r.ok) {
          const { platformWallet, balanceLamports } = await r.json();
          if (mounted) {
            setPlatformAddress(platformWallet);
            if (typeof balanceLamports === 'number') setSolBalance(balanceLamports / LAMPORTS_PER_SOL);
          }
        }
      } catch {}
      finally { if (mounted) setIsLoadingWallet(false); }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!mainAddress) return;
      try {
        const pubkey = new PublicKey(mainAddress);
        const bal = await connection.getBalance(pubkey);
        if (mounted) setSolBalance(bal / LAMPORTS_PER_SOL);
      } catch {}
    })();
    return () => { mounted = false; };
  }, [connection, mainAddress]);

  

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <Link className="btn" href="/launch">New Launch</Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card space-y-3">
          <div className="text-sm text-zinc-400">Main Wallet (platform)</div>
          <div className="text-xl font-semibold">
            {isLoadingWallet ? <span className="inline-block h-6 w-24 animate-pulse rounded bg-zinc-800/50" /> : (short(mainAddress) || '—')}
          </div>
          <div className="text-sm text-zinc-400">Balance: {isLoadingWallet ? <span className="inline-block h-4 w-20 animate-pulse rounded bg-zinc-800/50" /> : (solBalance == null ? '—' : `${formatSolMinimal(solBalance)} SOL`)}</div>
          {mainAddress && (
            <div className="flex gap-2">
              <button className="btn" onClick={() => { navigator.clipboard.writeText(mainAddress); show('Address copied', 'success'); }}>Copy Address</button>
              <a className="btn" href={`https://solscan.io/account/${mainAddress}`} target="_blank" rel="noreferrer">View on Solscan</a>
            </div>
          )}
        </div>
        <div className="card">
          <div className="mb-2 text-sm text-zinc-400">Your Launches</div>
          <LaunchesList />
        </div>
      </div>
    </div>
  );
}

function LaunchesList() {
  const [items, setItems] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/launch?mine=1');
        if (r.ok) setItems(await r.json());
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);
  if (loading) {
    return (
      <div className="space-y-2">
        <div className="h-6 w-full animate-pulse rounded bg-zinc-800/50" />
        <div className="h-6 w-full animate-pulse rounded bg-zinc-800/50" />
        <div className="h-6 w-full animate-pulse rounded bg-zinc-800/50" />
      </div>
    );
  }
  if (!items.length) return <div className="text-sm text-zinc-400">No launches yet.</div>;
  return (
    <div className="divide-y divide-zinc-800">
      {items.map((l) => (
        <div key={l.id} className="flex items-center justify-between py-2 text-sm">
          <div className="space-y-1">
            <div className="font-medium">{l.meta?.name || l.id}</div>
            <div className="text-zinc-400">{l.status}</div>
          </div>
          <Link className="btn" href={`/launches/${l.id}`}>View</Link>
        </div>
      ))}
    </div>
  );
}


