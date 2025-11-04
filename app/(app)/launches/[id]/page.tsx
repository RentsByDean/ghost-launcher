"use client";
import { useEffect, useMemo, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Connection, PublicKey, VersionedTransaction, clusterApiUrl, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { useToast } from '@/lib/toast';
import Link from 'next/link';
import axios from 'axios';

export default function LaunchDetailPage() {
  const { publicKey, sendTransaction, connected } = useWallet();
  const { show } = useToast();
  const params = useParams<{ id: string }>();
  const id = params?.id as string;
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [sellBusy, setSellBusy] = useState<boolean>(false);
  const [pumpMint, setPumpMint] = useState<string | null>(null);
  const [walletTokenBalance, setWalletTokenBalance] = useState<number | null>(null);
  const [walletTokenDecimals, setWalletTokenDecimals] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState<boolean>(false);
  const pumpScanTriedRef = useRef(false);
  const withdrawTriggeredRef = useRef(false);

  const connection = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SOLANA_CLUSTER === 'mainnet-beta'
      ? (process.env.NEXT_PUBLIC_SOLANA_RPC_URL || process.env.SOLANA_RPC_URL || clusterApiUrl('mainnet-beta'))
      : clusterApiUrl('mainnet-beta');
    return new Connection(url, 'confirmed');
  }, []);

  useEffect(() => {
    let timer: any;
    async function fetchStatus() {
      try {
        const r = await axios.get(`/api/launch/${id}/status`);
        if (r.status === 200) {
          const latest = r.data;
          setData(latest);
          // If backend already has the mint stored, use it
          if (latest?.pump?.mint) setPumpMint(latest.pump.mint);
          // If mint isn't known yet, try a single scan (once per page view)
          if (!latest?.pump?.mint && !pumpScanTriedRef.current) {
            pumpScanTriedRef.current = true;
            try {
              const s = await axios.get(`/api/launch/${id}/pump-scan`);
              if (s.status === 200 && s.data?.mint) setPumpMint(s.data.mint);
            } catch {}
          }
        }
      } finally {
        setLoading(false);
      }
    }
    if (id) {
      fetchStatus();
      // Continue polling status, but we will not keep re-calling the scan
      timer = setInterval(fetchStatus, 5000);
    }
    return () => clearInterval(timer);
  }, [id]);

  // Fetch token balance for this mint from the launch wallet (or connected wallet as fallback)
  useEffect(() => {
    const mintStr = pumpMint || data?.pump?.mint;
    const ownerPresent = data?.launchWallet || publicKey;
    if (!ownerPresent || !mintStr) return;
    refreshWalletTokenBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicKey, data?.launchWallet, pumpMint, data?.pump?.mint]);

  // Auto-trigger withdraw on first page load (only once, and only if not minted yet)
  useEffect(() => {
    if (!id || !data) return;
    if (withdrawTriggeredRef.current) return;
    if (data?.pump?.mint) return;
    withdrawTriggeredRef.current = true;
    // Reflect immediate UI intent
    setData((prev: any) => (prev ? { ...prev, status: 'funding wallet' } : prev));
    triggerWithdraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, data]);

  async function refreshWalletTokenBalance(): Promise<{ balanceUi: number; decimals: number | null } | null> {
    const mintStr = pumpMint || data?.pump?.mint;
    const ownerStr = data?.launchWallet || publicKey?.toBase58();
    if (!ownerStr || !mintStr) return null;
    setLoadingBalance(true);
    try {
      const qs = new URLSearchParams({ owner: ownerStr, mint: mintStr }).toString();
      const r = await fetch(`/api/token-balance?${qs}`);
      if (!r.ok) throw new Error('balance_api_failed');
      const j = await r.json();
      const totalUi = Number(j?.balanceUi || 0);
      const decimals = typeof j?.decimals === 'number' ? j.decimals : null;
      setWalletTokenBalance(totalUi);
      if (decimals !== null) setWalletTokenDecimals(decimals);
      return { balanceUi: totalUi, decimals };
    } catch {
      return null;
    } finally {
      setLoadingBalance(false);
    }
  }

  // Removed the frequent CA check: scan happens at most once during a status refresh

  if (!id) return null;
  if (loading && !data) return <div>Loading…</div>;
  if (!data) return <div className="text-sm text-red-300">Launch not found.</div>;

  const displayStatus = busy === 'Withdrawing' ? 'funding wallet' : data.status;

  async function generateLaunchWallet() {
    // Server already created a launch wallet; keep button as no-op indicator
    show('Launch wallet is server-managed', 'success');
  }

  async function triggerWithdraw() {
    if (!id) return;
    setBusy('Withdrawing');
    show('Starting withdraw…', 'info');
    try {
      const r = await axios.post('/api/jobs/withdraw', { id });
      if (r.status !== 200) {
        let msg = 'Withdraw failed';
        try { const j = r.data; if (j?.error) msg = `${msg}: ${j.error}`; } catch {}
        show(msg, 'error');
        return;
      }
      show('Withdraw requested', 'success');
      try {
        const st = await axios.get(`/api/launch/${id}/status`);
        if (st.status === 200) setData(st.data);
      } catch {}
    } finally {
      setBusy(null);
    }
  }

  async function returnRewardsToPlatform() {
    if (!id) return;
    setBusy('Claiming and returning');
    show('Starting claim & return…', 'info');
    try {
      const r = await axios.post('/api/jobs/rewards', { id, action: 'claim_return' });
      if (r.status !== 200) {
        let msg = 'Claim & return failed';
        try { const j = r.data; if (j?.error) msg = `${msg}: ${j.error}${j.stage ? ` (${j.stage})` : ''}`; } catch {}
        show(msg, 'error');
        return;
      }
      const j = r.data;
      const returned = typeof j?.returnedLamports === 'number' ? (j.returnedLamports / LAMPORTS_PER_SOL).toFixed(4) + ' SOL' : '';
      const sig = j?.claimSig ? ` (${j.claimSig.slice(0, 8)}…)` : '';
      show(`Claimed and returned ${returned} to platform${sig}`, 'success');
      // Refresh status promptly
      try {
        const st = await axios.get(`/api/launch/${id}/status`);
        if (st.status === 200) setData(st.data);
      } catch {}
    } finally {
      setBusy(null);
    }
  }

  async function signAndSendPumpCreate() {
    if (!id) return;
    setBusy('Launching on server');
    show('Building and submitting launch…', 'info');
    try {
      const r = await axios.post('/api/jobs/pump-create', { id });
      if (r.status !== 200) {
        let msg = 'Launch failed';
        try { const j = r.data; if (j?.error) msg = `${msg}: ${j.error}`; } catch {}
        show(msg, 'error');
        return;
      }
      const j = r.data;
      if (j?.txSig) show(`Submitted: ${j.txSig}`, 'success');
      try {
        const st = await axios.get(`/api/launch/${id}/status`);
        if (st.status === 200) setData(st.data);
      } catch {}
    } catch (e) {
      console.error(e);
      show('Failed to submit pump create', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function sellPercent(percent: number) {
    const mintStr = pumpMint || data?.pump?.mint;
    if (!publicKey || !mintStr) {
      show('Missing wallet or mint', 'error');
      return;
    }
    setSellBusy(true);
    try {
      const r = await axios.post('/api/jobs/sell', { id, percent, mint: mintStr });
      if (r.status !== 200) {
        let msg = 'Sell failed';
        try { const j = r.data; if (j?.error) msg = `${msg}: ${j.error}`; } catch {}
        show(msg, 'error');
        return;
      }
      const j = r.data;
      if (j?.txSig) show(`Submitted: ${j.txSig}`, 'success');
      // Refresh balance and status
      try { await refreshWalletTokenBalance(); } catch {}
    } catch (e) {
      console.error(e);
      show('Sell failed', 'error');
    } finally {
      setSellBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {pumpMint && (
        <div className="rounded-md border border-green-800 bg-green-950 p-3 text-green-100">
          Detected coin: <Link className="underline" href={`https://pump.fun/coin/${pumpMint}`} target="_blank">{pumpMint}</Link>
        </div>
      )}
      <h1 className="text-2xl font-semibold">Launch {id}</h1>
      <div className="card space-y-2 text-sm">
        <div>Status: {displayStatus}</div>
        {data.privacyCash?.depositAddress && (
          <div>Deposit Address: <code className="text-zinc-300">{data.privacyCash.depositAddress}</code></div>
        )}
        <div className="flex flex-wrap gap-2 pt-2">
          {!data?.pump?.mint && (
            <>
              {/* <button className="btn" disabled={!!busy} onClick={generateLaunchWallet}>{busy ? busy : (data.launchWallet ? 'Launch wallet set' : 'Launch wallet set')}</button> */}
              <button className="btn" disabled={!!busy} onClick={triggerWithdraw}>Withdraw to launch wallet</button>
              <button className="btn" disabled={!!busy} onClick={signAndSendPumpCreate}>Launch</button>
            </>
          )}
          {data?.pump?.mint && (
            <button className="btn" disabled={!!busy} onClick={returnRewardsToPlatform}>Claim & return rewards</button>
          )}
        </div>
        {data.pump?.mint && (
          <div>Mint: <a className="text-indigo-400 underline" href={`https://solscan.io/token/${data.pump.mint}`} target="_blank" rel="noreferrer">{data.pump.mint}</a></div>
        )}
        {data.pump?.txSig && (
          <div>Tx: <a className="text-indigo-400 underline" href={`https://solscan.io/tx/${data.pump.txSig}`} target="_blank" rel="noreferrer">{data.pump.txSig}</a></div>
        )}
      </div>
      
      {(pumpMint || data?.pump?.mint) && (
        <div className="card space-y-3">
          <div className="text-sm text-zinc-300">Sell (%)</div>
          <div className="text-xs text-zinc-400">
            Balance (launch wallet): {loadingBalance ? 'Loading…' : (walletTokenBalance !== null ? `${walletTokenBalance.toLocaleString(undefined, { maximumFractionDigits: 6 })} tokens` : '—')}
            {walletTokenDecimals !== null ? ` · Decimals: ${walletTokenDecimals}` : ''}
            <button onClick={refreshWalletTokenBalance} className="ml-2 rounded-md bg-white/10 px-2 py-1 text-xs hover:bg-white/20">Refresh</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button className="btn w-full h-12" disabled={sellBusy} onClick={() => sellPercent(10)}>{sellBusy ? '…' : '▼ 10%'}</button>
            <button className="btn w-full h-12" disabled={sellBusy} onClick={() => sellPercent(25)}>{sellBusy ? '…' : '▼ 25%'}</button>
            <button className="btn w-full h-12" disabled={sellBusy} onClick={() => sellPercent(50)}>{sellBusy ? '…' : '▼ 50%'}</button>
            <button className="btn w-full h-12" disabled={sellBusy} onClick={() => sellPercent(100)}>{sellBusy ? '…' : '▼ 100%'}</button>
          </div>
        </div>
      )}
    </div>
  );
}


