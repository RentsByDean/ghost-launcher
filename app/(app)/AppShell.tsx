'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import React, { type ReactNode } from 'react';

function NavItem({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== '/' && pathname.startsWith(href));
  return (
    <Link
      href={href}
      className={`block rounded px-3 py-2 text-sm ${active ? 'bg-zinc-800 text-white' : 'text-zinc-300 hover:bg-zinc-900'}`}
    >
      {label}
    </Link>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r border-zinc-800 p-4 space-y-6 bg-[radial-gradient(1200px_600px_at_50%_-20%,rgba(34,211,238,0.08),transparent_60%)]">
        <div className="flex flex-col items-center justify-center">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <img src="/ghost.svg" alt="Ghost Launcher" className="w-8 h-8" />
            Ghost Launcher
          </div>
        </div>
        <div className="flex">
          <WalletMultiButton />
        </div>
        <nav className="space-y-1">
          <NavItem href="/dashboard" label="Dashboard" />
          <NavItem href="/launch" label="New Launch" />
          <NavItem href="/wallets" label="Wallets" />
        </nav>
      </aside>
      <main className="flex-1 p-6 max-w-2xl mx-auto">{children}</main>
    </div>
  );
}


