import { NextResponse } from 'next/server';

function randomNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('hex');
}

export async function GET() {
  const nonce = randomNonce();
  return NextResponse.json({ nonce });
}


