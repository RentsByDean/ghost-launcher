const IV_LENGTH_BYTES = 12; // AES-GCM recommended IV length

async function getSubtle(): Promise<SubtleCrypto> {
  // Use global Web Crypto in Edge/Browser or Node's webcrypto
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g: any = globalThis as any;
  if (g.crypto?.subtle) return g.crypto.subtle as SubtleCrypto;
  const nodeCrypto = await import('crypto');
  return nodeCrypto.webcrypto.subtle as unknown as SubtleCrypto;
}

async function deriveKeyFromPassphrase(passphrase: string) {
  const subtle = await getSubtle();
  const passphraseBytes = new TextEncoder().encode(passphrase);
  const hash = await subtle.digest('SHA-256', passphraseBytes);
  return subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

function toBase64(bytes: ArrayBuffer | Uint8Array) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (typeof Buffer !== 'undefined') return Buffer.from(arr).toString('base64');
  // Fallback for strict runtimes
  let binary = '';
  for (let i = 0; i < arr.byteLength; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(b64, 'base64'));
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function encryptSecret(plaintext: string, passphrase: string): Promise<string> {
  const subtle = await getSubtle();
  const key = await deriveKeyFromPassphrase(passphrase);
  const iv = new Uint8Array(IV_LENGTH_BYTES);
  // Use crypto.getRandomValues for IV
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g: any = globalThis as any;
  (g.crypto ?? (await import('crypto')).webcrypto).getRandomValues(iv);
  const data = new TextEncoder().encode(plaintext);
  const ciphertext = await subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    data.buffer as ArrayBuffer
  );
  return `${toBase64(iv)}.${toBase64(ciphertext)}`;
}

export async function decryptSecret(token: string, passphrase: string): Promise<string> {
  const subtle = await getSubtle();
  const key = await deriveKeyFromPassphrase(passphrase);
  const [ivB64, ctB64] = token.split('.', 2);
  if (!ivB64 || !ctB64) throw new Error('Invalid encrypted payload');
  const iv = fromBase64(ivB64);
  const ciphertext = fromBase64(ctB64);
  const plaintext = await subtle.decrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    ciphertext.buffer as ArrayBuffer
  );
  return new TextDecoder().decode(plaintext);
}