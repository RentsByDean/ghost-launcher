"use client";
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { featureHighlights, launchSteps, siteMetadata, testimonials } from '@ghost/shared';
import { ensureLogin } from '@/lib/client-auth';
import { useToast } from '@/lib/toast';

export default function Home() {
  const { connected, publicKey, signMessage } = useWallet();
  const router = useRouter();
  const { setVisible } = useWalletModal();
  const { show } = useToast();
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);

  async function handleSignIn() {
    if (!connected || !publicKey || !signMessage) return;
    await ensureLogin(publicKey, signMessage);
    router.push('/dashboard');
  }

  async function handleEnter(route: string) {
    if (!connected) {
      setPendingRoute(route);
      setVisible(true);
      return;
    }
    if (publicKey && signMessage) {
      try {
        await ensureLogin(publicKey, signMessage);
        router.push(route);
      } catch {
        show('Sign-in failed', 'error');
      }
    } else {
      show('Your wallet must support message signing.', 'error');
    }
  }

  useEffect(() => {
    if (!pendingRoute) return;
    if (!connected) return;
    if (!publicKey || !signMessage) {
      show('Your wallet must support message signing.', 'error');
      setPendingRoute(null);
      return;
    }
    (async () => {
      try {
        await ensureLogin(publicKey, signMessage);
        router.push(pendingRoute);
      } catch {
        show('Sign-in failed', 'error');
      } finally {
        setPendingRoute(null);
      }
    })();
  }, [pendingRoute, connected, publicKey, signMessage, router, show]);

  return (
    <div className="relative isolate min-h-screen overflow-hidden">
      <div className="ghost-surface pointer-events-none" />
      <div className="ghost-grid pointer-events-none" />
      <div className="ghost-orb ghost-orb--left pointer-events-none" />
      <div className="ghost-orb ghost-orb--right pointer-events-none" />

      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt={siteMetadata.name} width={32} height={32} priority />
          <span className="text-sm font-medium uppercase tracking-[0.3em] text-zinc-400">{siteMetadata.name}</span>
        </div>
        <div className="hidden items-center gap-3 text-xs font-medium uppercase tracking-[0.3em] text-zinc-600 md:flex">
          <span>Stealth</span>
          <span className="h-px w-8 bg-zinc-800" />
          <span>Agency</span>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-16 px-6 pb-24">
        <section className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950/70 p-10 shadow-[0_40px_120px_rgba(6,6,7,0.6)]">
          <div className="absolute inset-x-6 inset-y-6 rounded-2xl border border-zinc-800/60" />
          <div className="relative z-10 flex flex-col items-center text-center space-y-6">
            <div className="ghost-pill">
              <span className="text-xs uppercase tracking-[0.3em] text-emerald-300">Stealth launch studio</span>
            </div>
            <h1 className="max-w-3xl bg-gradient-to-b from-white via-zinc-200 to-zinc-500 bg-clip-text text-4xl font-semibold text-transparent md:text-6xl md:leading-[1.1]">
              {siteMetadata.tagline}
            </h1>
            <p className="max-w-2xl text-balance text-base text-zinc-400 md:text-lg">{siteMetadata.description}</p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <button className="btn px-6 py-3 text-base" onClick={() => handleEnter('/dashboard')}>
                Launch Anonymously
              </button>             
            </div>
          </div>
          <div className="ghost-veil" />
        </section>

        <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {featureHighlights.map((item) => (
            <div key={item.title} className={`card relative overflow-hidden border-zinc-800/70 bg-zinc-950/80`}>
              <div className={`absolute inset-0 blur-2xl opacity-70 bg-gradient-to-br ${item.accent}`} />
              <div className="relative z-10 space-y-2">
                <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">{item.title}</p>
                <p className="text-sm text-zinc-300">{item.body}</p>
              </div>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="card relative overflow-hidden border-zinc-800/70 bg-zinc-950/70">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.25),_transparent_60%)]" />
            <div className="relative z-10 space-y-6 p-6">
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">How it works</p>
              <div className="space-y-6">
                {launchSteps.map((step) => (
                  <div key={step.title} className="space-y-2">
                    <p className="font-semibold text-zinc-100">{step.title}</p>
                    <p className="text-sm text-zinc-400">{step.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="card border-zinc-800/70 bg-zinc-950/70">
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Signal feeds</p>
            <div className="mt-4 space-y-4 text-sm text-zinc-300">
              <p>• Real-time wallet burn down + pump velocity alerts</p>
              <p>• Privacy score, front-run risk, liquidity health</p>
              <p>• Automated reward claim + distribution monitors</p>
            </div>
            <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
              Designed with agency playbooks: everything battle-tested across dozens of stealth launches.
            </div>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          {testimonials.map((item) => (
            <div key={item.author} className="card border-zinc-800/60 bg-zinc-950/80">
              <p className="text-lg text-zinc-200">&ldquo;{item.quote}&rdquo;</p>
              <div className="mt-4 text-sm text-zinc-500">
                {item.author} — {item.role}
              </div>
            </div>
          ))}
        </section>

        <section className="relative overflow-hidden rounded-3xl border border-zinc-800/80 bg-gradient-to-br from-emerald-500/15 via-cyan-500/10 to-transparent p-8">
          <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,_rgba(34,211,238,0.18),_transparent_70%)] blur-3xl" />
          <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-200">Ghost studio access</p>
              <h2 className="mt-3 text-3xl font-semibold text-white">Ready to launch like an agency?</h2>
              <p className="mt-2 text-sm text-zinc-300">Spin up a stealth drop in minutes with a spectral operations stack.</p>
            </div>
            <button className="btn px-6 py-3 text-base" onClick={() => handleEnter('/launch')}>
              Book a Ghost Launch
            </button>
          </div>
        </section>
      </main>

      <footer className="mx-auto mt-10 max-w-6xl px-6 pb-10 text-xs text-zinc-500">
        <div className="flex flex-col items-center justify-between gap-4 border-t border-zinc-900 pt-6 sm:flex-row">
          <div className="flex items-center gap-2">
            <span>{siteMetadata.name}</span>
          </div>
          <span>&copy; {new Date().getFullYear()} All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}


