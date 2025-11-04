import nacl from 'tweetnacl';
import bs58 from 'bs58';

type Options = {
  targetSuffix?: string;
  fallbackSuffix?: string;
  tryMs?: number;
};

export async function generateVanityKeypair({ targetSuffix = 'pump', fallbackSuffix = 'mp', tryMs = 30000 }: Options = {}) {
  const deadline = Date.now() + tryMs;
  let attempts = 0;

  while (Date.now() < deadline) {
    const kp = nacl.sign.keyPair();
    const pub = bs58.encode(kp.publicKey);
    if (pub.endsWith(targetSuffix)) {
      return { publicKey: pub, secretKeyB58: bs58.encode(kp.secretKey), attempts, suffix: targetSuffix };
    }
    attempts++;
    if ((attempts & 0xfff) === 0) await new Promise((r) => setTimeout(r, 0));
  }

  // Fallback loop
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const kp = nacl.sign.keyPair();
    const pub = bs58.encode(kp.publicKey);
    if (pub.endsWith(fallbackSuffix)) {
      return { publicKey: pub, secretKeyB58: bs58.encode(kp.secretKey), attempts, suffix: fallbackSuffix };
    }
    attempts++;
    if ((attempts & 0xfff) === 0) await new Promise((r) => setTimeout(r, 0));
  }
}


