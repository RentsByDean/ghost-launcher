"use client";
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useToast } from '@/lib/toast';

function short(address?: string) {
  if (!address) return '';
  return address.slice(0, 4) + '…' + address.slice(-4);
}

type LaunchItem = { id: string; meta?: any; launchWallet?: string };

export default function WalletsPage() {
  const { connected, publicKey, signMessage } = useWallet();
  const { show } = useToast();
  const [platformWallet, setPlatformWallet] = useState<string | null>(null);
  const [launches, setLaunches] = useState<Array<LaunchItem>>([]);
  const [loadingPlatform, setLoadingPlatform] = useState(true);
  const [loadingLaunches, setLoadingLaunches] = useState(true);
  const [revealing, setRevealing] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState<string | null>(null);
  const [modalWallet, setModalWallet] = useState<{ key: string; label: string; address: string; primary: boolean; launchId?: string } | null>(null);
  const [modalRevealing, setModalRevealing] = useState(false);
  const [modalPrivateKey, setModalPrivateKey] = useState<string | null>(null);
  const [modalShowFull, setModalShowFull] = useState(false);
  const [modalCopied, setModalCopied] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/user/wallets');
        if (r.ok) {
          const { platformWallet } = await r.json();
          setPlatformWallet(platformWallet);
        }
      } catch {}
      finally { setLoadingPlatform(false); }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/launch?mine=1');
        if (r.ok) {
          const items = await r.json();
          setLaunches(items);
        }
      } catch {}
      finally { setLoadingLaunches(false); }
    })();
  }, []);

  const allWallets = useMemo(() => {
    const list: Array<{ key: string; label: string; address: string; primary: boolean; launchId?: string }> = [];
    if (platformWallet) list.push({ key: 'platform', label: 'Platform Wallet', address: platformWallet, primary: true });
    for (const l of launches) {
      if (l.launchWallet) list.push({ key: `launch:${l.id}`, label: l.meta?.name || 'Launch Wallet', address: l.launchWallet, primary: false, launchId: l.id });
    }
    return list;
  }, [platformWallet, launches]);

  async function signNonce(prefix: string) {
    if (!connected || !publicKey || !signMessage) throw new Error('Connect a wallet that can sign');
    const nonceRes = await fetch('/api/auth/nonce');
    const { nonce } = await nonceRes.json();
    const message = new TextEncoder().encode(`${prefix}: ${nonce}`);
    const sig = await signMessage(message);
    const signature = Buffer.from(sig).toString('base64');
    return { nonce, signature };
  }

  async function revealPlatform() {
    setError(null);
    setRevealing('platform');
    try {
      const { nonce, signature } = await signNonce('Reveal platform wallet private key');
      const res = await fetch('/api/user/wallets/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nonce, signature }),
      });
      if (!res.ok) throw new Error('Reveal failed');
      const { privateKey } = await res.json();
      setRevealed((m) => ({ ...m, platform: privateKey }));
    } catch (e: any) {
      setError(e?.message || 'Failed to reveal');
    } finally {
      setRevealing(null);
    }
  }

  async function revealLaunch(id: string) {
    setError(null);
    setRevealing(id);
    try {
      const { nonce, signature } = await signNonce('Reveal launch wallet private key');
      const res = await fetch(`/api/launch/${id}/wallet/reveal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nonce, signature }),
      });
      if (!res.ok) throw new Error('Reveal failed');
      const { privateKey } = await res.json();
      setRevealed((m) => ({ ...m, [id]: privateKey }));
    } catch (e: any) {
      setError(e?.message || 'Failed to reveal');
    } finally {
      setRevealing(null);
    }
  }

  async function getPrivateKeyFor(wallet: { primary: boolean; launchId?: string }) {
    const prefix = wallet.primary ? 'Reveal platform wallet private key' : 'Reveal launch wallet private key';
    const { nonce, signature } = await signNonce(prefix);
    const url = wallet.primary ? '/api/user/wallets/reveal' : `/api/launch/${wallet.launchId}/wallet/reveal`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nonce, signature }),
    });
    if (!res.ok) {
      try {
        const body = await res.json();
        throw new Error(body?.error || res.statusText || 'Reveal failed');
      } catch {
        throw new Error('Reveal failed');
      }
    }
    const { privateKey } = await res.json();
    return privateKey as string;
  }

  function maskPrivateKey(pk: string): string {
    if (!pk) return '';
    if (pk.length <= 8) return '•'.repeat(pk.length);
    const visible = 6;
    const head = pk.slice(0, visible);
    const tail = pk.slice(-visible);
    return `${head}${'•'.repeat(Math.max(4, pk.length - visible * 2))}${tail}`;
  }

  async function openPrivateKeyModal(w: { key: string; label: string; address: string; primary: boolean; launchId?: string }) {
    setMenuOpen(null);
    setModalOpen(w.key);
    setModalWallet(w);
    setModalShowFull(false);
    setModalCopied(false);
    setModalPrivateKey(null);
    setModalRevealing(true);
    setModalError(null);
    try {
      const pk = await getPrivateKeyFor(w);
      setModalPrivateKey(pk);
    } catch (e: any) {
      setModalError(e?.message || 'Failed to reveal');
    } finally {
      setModalRevealing(false);
    }
  }

  function CogIcon(props: { className?: string }) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={props.className || ''}>
        <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0A1.65 1.65 0 0 0 9 3.09V3a2 2 0 1 1 4 0v.09c0 .64.38 1.22.97 1.49h0c.59.27 1.28.15 1.76-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06c-.48.48-.6 1.17-.33 1.76h0c.27.59.85.97 1.49.97H21a2 2 0 1 1 0 4h-.09c-.64 0-1.22.38-1.49.97Z"/>
      </svg>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Wallets</h1>
        <Link className="btn" href="/launch">New Launch</Link>
      </div>

      <div className="card">
        <div className="divide-y divide-zinc-800">
          {(loadingPlatform && loadingLaunches) && (
            <>
              <div className="py-3">
                <div className="h-4 w-28 animate-pulse rounded bg-zinc-800/50" />
                <div className="mt-2 h-6 w-40 animate-pulse rounded bg-zinc-800/50" />
              </div>
              <div className="py-3">
                <div className="h-4 w-28 animate-pulse rounded bg-zinc-800/50" />
                <div className="mt-2 h-6 w-64 animate-pulse rounded bg-zinc-800/50" />
              </div>
            </>
          )}
          {!loadingPlatform && !loadingLaunches && allWallets.map((w) => (
            <div key={w.key} className="py-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="font-medium">{w.label}</div>
                    {w.primary && <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">Primary</span>}
                  </div>
                  <div className="text-sm text-zinc-400">{short(w.address)}</div>
                </div>
                <div className="relative">
                  <button className="btn" onClick={() => setMenuOpen(menuOpen === w.key ? null : w.key)} aria-haspopup="menu" aria-expanded={menuOpen === w.key}>
                    <CogIcon className="h-4 w-4" />
                  </button>
                  {menuOpen === w.key && (
                    <div className="absolute right-0 z-10 mt-2 w-44 rounded border border-zinc-800 bg-zinc-900 py-1 text-sm shadow-lg">
                      <button className="block w-full px-3 py-2 text-left hover:bg-zinc-800" onClick={() => { navigator.clipboard.writeText(w.address); setMenuOpen(null); show('Public key copied', 'success'); }}>Copy public key</button>
                      <button className="block w-full px-3 py-2 text-left hover:bg-zinc-800" onClick={() => openPrivateKeyModal(w)}>Show private key</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        {!loadingPlatform && !loadingLaunches && !allWallets.length && (
          <div className="p-3 text-sm text-zinc-400">No wallets yet.</div>
        )}
      </div>

      {!connected && (
        <div className="rounded-md border border-yellow-700 bg-yellow-950 p-3 text-yellow-200 text-sm">
          Connect a wallet to sign reveal requests.
        </div>
      )}
      {!connected && <div className="flex gap-3"><WalletMultiButton /></div>}

      {error && <div className="rounded-md border border-red-800 bg-red-950 p-3 text-red-200 text-sm">{error}</div>}

      {modalOpen && modalWallet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setModalOpen(null)} aria-hidden="true" />
          <div role="dialog" aria-modal="true" className="relative z-10 w-full max-w-lg rounded border border-zinc-800 bg-zinc-900 p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-sm text-zinc-400">{modalWallet.label}{modalWallet.primary ? ' (Primary)' : ''}</div>
                <div className="text-mono text-sm text-zinc-300">{short(modalWallet.address)}</div>
              </div>
                  <button className="btn" onClick={() => setModalOpen(null)}>Close</button>
            </div>
            <div className="space-y-2">
              <div className="text-sm text-zinc-400">Private Key (base58)</div>
              <div className="text-mono break-all select-all rounded border border-zinc-800 bg-black/40 p-3">
                {modalRevealing ? <span className="inline-block h-6 w-full animate-pulse rounded bg-zinc-800/50" /> : (modalPrivateKey ? (modalShowFull ? modalPrivateKey : maskPrivateKey(modalPrivateKey)) : (modalError ? '' : '—'))}
              </div>
              {modalError && (
                <div className="rounded border border-red-800 bg-red-950 p-2 text-sm text-red-200">{modalError}</div>
              )}
              <div className="flex items-center gap-2">
                <button className="btn" disabled={modalRevealing || !modalPrivateKey} onClick={() => setModalShowFull((v) => !v)}>
                  {modalShowFull ? 'Hide' : 'Reveal'}
                </button>
                <div className="relative">
                  <button className="btn" disabled={modalRevealing || !modalPrivateKey} onClick={async () => {
                    if (modalPrivateKey) await navigator.clipboard.writeText(modalPrivateKey);
                    setModalCopied(true);
                    setTimeout(() => setModalCopied(false), 1500);
                    show('Private key copied', 'success');
                  }}>Copy</button>
                  {modalCopied && (
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-100 shadow">Copied</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


