"use client";
import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useRouter } from "next/navigation";
import {
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { ensureLogin } from "@/lib/client-auth";
import { useToast } from "@/lib/toast";

export default function LaunchPage() {
  const { connected, publicKey, signMessage } = useWallet();
  const { show } = useToast();
  const router = useRouter();
  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const [desc, setDesc] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [website, setWebsite] = useState("");
  const [targetSol, setTargetSol] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [whitelist, setWhitelist] = useState("");

  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [initialBuyAmount, setInitialBuyAmount] = useState("");
  const embedded = null;

  useEffect(() => {
    if (!connected) return;
  }, [connected]);

  function validateFields() {
    const errs: Record<string, string> = {};
    if (!name) errs.name = 'Name is required';
    if (!ticker || ticker.length < 2 || ticker.length > 6) errs.ticker = 'Ticker must be 2-6 chars';
    if (!desc) errs.desc = 'Description is required';
    if (!imageUrl) errs.imageUrl = 'Logo required';
    if (!bannerUrl) errs.bannerUrl = 'Banner required';
    const sol = Number(targetSol);
    if (!Number.isFinite(sol) || sol <= 0) errs.targetSol = 'Enter a valid SOL amount';
    else if (sol < 0.05) errs.targetSol = 'Minimum is 0.05 SOL';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!validateFields()) return;
    // Directly create and pay without confirmation modal
    confirmCreateAndPay();
  }

  async function confirmCreateAndPay() {
    if (!connected || !publicKey || !signMessage) {
      show('Connect a wallet that can sign', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await ensureLogin(publicKey, signMessage);
      const sol = Number(targetSol);
      const body: any = {
        amountLamports: Math.floor(sol * LAMPORTS_PER_SOL),
        meta: {
          name,
          symbol: ticker,
          desc,
          imageUrl,
          bannerUrl,
          twitter,
          telegram,
          website,
          initialBuyAmount,
        },
      };
      const r = await fetch('/api/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const msg = await r.text();
        throw new Error(msg || 'Failed to create launch');
      }
      const { id } = await r.json();
      show('Launch created. Funding from platform wallet.', 'success');
      router.push(`/launches/${id}`);
    } catch (e: any) {
      console.error(e);
      show(e?.message || 'Failed to create launch', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  // Vanity generation removed: launch wallet is created server-side

  async function uploadWithS3(file: File): Promise<string> {
    const prefix = 'uploads';
    const safeName = (file.name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
    const keyName = `${Date.now()}-${safeName}`;
    const ab = await file.arrayBuffer();
    const up = await fetch(`/api/uploads/${prefix}/${encodeURIComponent(keyName)}`, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: ab,
    });
    if (!up.ok) {
      let msg = 'Upload failed';
      try { const j = await up.json(); msg = j?.message || j?.error || msg; } catch {}
      throw new Error(msg);
    }
    const p = await up.json();
    return (p.publicUrl as string) || (p.proxyUrl as string);
  }

  return (
    <>
      <main className="pb-12 pt-6">
        {formError && <p className="mt-2 text-sm text-red-400">{formError}</p>}
        <div className="mt-6 grid grid-cols-1 gap-8">
          <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-zinc-300">Name <span className="text-red-400">*</span></label>
                <input className="mt-1 w-full rounded-md bg-white/5 px-3 py-2 outline-none" value={name} onChange={(e) => setName(e.target.value)} required maxLength={32} />
                {fieldErrors.name && (<div className="mt-1 text-xs text-red-400">{fieldErrors.name}</div>)}
              </div>
              <div>
                <label className="text-sm text-zinc-300">Ticker <span className="text-red-400">*</span></label>
                <input className="mt-1 w-full rounded-md bg-white/5 px-3 py-2 uppercase outline-none" value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} required minLength={2} maxLength={6} />
                {fieldErrors.ticker && (<div className="mt-1 text-xs text-red-400">{fieldErrors.ticker}</div>)}
              </div>
            </div>
            <div>
              <label className="text-sm text-zinc-300">Description <span className="text-red-400">*</span></label>
              <textarea className="mt-1 w-full rounded-md bg-white/5 px-3 py-2 outline-none" rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} required maxLength={280} />
              {fieldErrors.desc && (<div className="mt-1 text-xs text-red-400">{fieldErrors.desc}</div>)}
            </div>
            {/* Preview */}
            <div className="rounded-lg border border-white/10 bg-zinc-900/50 p-3">
              <div className="text-xs text-zinc-400">Preview</div>
              <div className="mt-2 overflow-hidden rounded-md border border-white/10">
                {bannerUrl ? (
                  <img src={bannerUrl} alt="Banner preview" className="h-24 w-full object-cover" />
                ) : (
                  <div className="h-24 w-full bg-white/5 flex items-center justify-center text-xs text-zinc-500">Banner preview</div>
                )}
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div className="h-12 w-12 overflow-hidden rounded-full border border-white/10 bg-white/5">
                  {imageUrl ? (
                    <img src={imageUrl} alt="Logo preview" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-[10px] text-zinc-500">Logo</div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm text-white">{name || 'Token Name'}</div>
                  <div className="truncate text-xs text-zinc-400">
                    {ticker || 'TICKR'}{desc ? ' • ' : ' • '}{desc ? (desc.length > 60 ? desc.slice(0,60) + '…' : desc) : 'Description preview'}
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-zinc-300">Logo image <span className="text-red-400">*</span></label>
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="mt-1 w-full rounded-md bg-white/5 px-3 py-2 outline-none"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setImageUploading(true);
                    setFieldErrors((prev) => ({ ...prev, imageUrl: "" }));
                    try {
                      const url = await uploadWithS3(f);
                      setImageUrl(url);
                    } catch (err: any) {
                      setFieldErrors((prev) => ({ ...prev, imageUrl: err?.message || 'Failed to upload image. Please try a different image.' }));
                    } finally {
                      setImageUploading(false);
                    }
                  }} required />
                <div className="mt-1 text-xs text-zinc-400">PNG, JPG, WEBP, GIF up to 8 MB.</div>
                {imageUploading && (<div className="mt-1 text-xs text-zinc-400">Uploading logo…</div>)}
                {fieldErrors.imageUrl && (<div className="mt-1 text-xs text-red-400">{fieldErrors.imageUrl}</div>)}
              </div>
              <div>
                <label className="text-sm text-zinc-300">Banner image <span className="text-red-400">*</span></label>
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="mt-1 w-full rounded-md bg-white/5 px-3 py-2 outline-none"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setBannerUploading(true);
                    setFieldErrors((prev) => ({ ...prev, bannerUrl: "" }));
                    try {
                      const url = await uploadWithS3(f);
                      setBannerUrl(url);
                    } catch (err: any) {
                      setFieldErrors((prev) => ({ ...prev, bannerUrl: err?.message || 'Failed to upload banner. Please try a different image.' }));
                    } finally {
                      setBannerUploading(false);
                    }
                  }} required />
                <div className="mt-1 text-xs text-zinc-400">PNG, JPG, WEBP, GIF up to 8 MB.</div>
                {bannerUploading && (<div className="mt-1 text-xs text-zinc-400">Uploading banner…</div>)}
                {fieldErrors.bannerUrl && (<div className="mt-1 text-xs text-red-400">{fieldErrors.bannerUrl}</div>)}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-zinc-300">Twitter <span className="text-zinc-500">(optional)</span></label>
                <input className="mt-1 w-full rounded-md bg-white/5 px-3 py-2 outline-none" value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="https://x.com/..." />
                {fieldErrors.twitter && (<div className="mt-1 text-xs text-red-400">{fieldErrors.twitter}</div>)}
              </div>
              <div>
                <label className="text-sm text-zinc-300">Telegram <span className="text-zinc-500">(optional)</span></label>
                <input className="mt-1 w-full rounded-md bg-white/5 px-3 py-2 outline-none" value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="https://t.me/..." />
                {fieldErrors.telegram && (<div className="mt-1 text-xs text-red-400">{fieldErrors.telegram}</div>)}
              </div>
              <div>
                <label className="text-sm text-zinc-300">Website <span className="text-zinc-500">(optional)</span></label>
                <input className="mt-1 w-full rounded-md bg-white/5 px-3 py-2 outline-none" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." />
                {fieldErrors.website && (<div className="mt-1 text-xs text-red-400">{fieldErrors.website}</div>)}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-zinc-300">Target SOL (min 0.05) <span className="text-red-400">*</span></label>
                <input type="number" step="0.000000001" min="0.05" className="mt-1 w-full rounded-md bg-white/5 px-3 py-2 outline-none" value={targetSol} onChange={(e) => setTargetSol(e.target.value)} required />
                {fieldErrors.targetSol && (<div className="mt-1 text-xs text-red-400">{fieldErrors.targetSol}</div>)}
              </div>
              <div className="flex items-end">
                <button type="submit" disabled={submitting || imageUploading || bannerUploading || !imageUrl || !bannerUrl || Number(targetSol) < 0.05} className="btn w-full justify-center text-base py-3">
                  {submitting ? "Creating..." : "Launch"}
                </button>
              </div>
            </div>
            
            
          </form>
        </div>
      </main>
    </>
  );
}
