"use client";
import Image from "next/image";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { ensureLogin } from "@/lib/client-auth";
import { useToast } from "@/lib/toast";

export default function Home() {
  const router = useRouter();
  const { connected, publicKey, signMessage } = useWallet();
  const { show } = useToast();

  useEffect(() => {
    if (!connected || !publicKey || !signMessage) return;
    (async () => {
      try {
        await ensureLogin(publicKey, signMessage);
        router.push("/dashboard");
      } catch {
        show("Sign-in failed. Please try again.", "error");
      }
    })();
  }, [connected, publicKey, signMessage, router, show]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 px-6 py-12">
      <div className="ghost-grid pointer-events-none" />
      <div className="ghost-orb ghost-orb--left pointer-events-none" />
      <div className="ghost-orb ghost-orb--right pointer-events-none" />
      <div className="relative z-10 w-full max-w-md space-y-6 rounded-3xl bg-zinc-950/90 p-8 border border-zinc-800">
        <div className="flex flex-col items-center space-y-4 text-center">
          <Image
            src="/logo.png"
            alt="Ghost Launcher"
            width={48}
            height={48}
            priority
          />
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-300">
              Ghost Launcher
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              Sign a one-time message to unlock the Ghost Launcher and start
              launching in secret.
            </p>
          </div>
        </div>

        <div className="flex justify-center">
          <WalletMultiButton />
        </div>

        <div className="rounded-md border border-zinc-800 bg-black/40 p-4 text-sm text-zinc-300">
          <p className="font-medium text-white">What happens next?</p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-zinc-400">
            <li>Connect using Phantom or any supported Solana wallet.</li>
            <li>Approve a one-time signature to authenticate securely.</li>
            <li>
              You'll be redirected to the dashboard once verification succeeds.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
