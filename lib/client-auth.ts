"use client";
import type { PublicKey } from '@solana/web3.js';

function bytesToBase64(bytes: Uint8Array) {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export async function ensureLogin(publicKey: PublicKey, signMessage: (message: Uint8Array) => Promise<Uint8Array>) {
  const nonceRes = await fetch('/api/auth/nonce');
  const { nonce } = await nonceRes.json();
  const message = new TextEncoder().encode(`Sign in to Ghost Launcher: ${nonce}`);
  const signature = await signMessage(message);
  const sigB64 = bytesToBase64(signature);
  const addr = publicKey.toBase58();
  const verify = await fetch('/api/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: addr, signature: sigB64, nonce })
  });
  if (!verify.ok) throw new Error('Sign-in failed');
}


