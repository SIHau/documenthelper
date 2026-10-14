import { ed25519 } from '@noble/curves/ed25519.js';
import { fromBase64Url, toBase64Url, utf8ToBytes } from './encoding';
import { concatBytes } from '@noble/hashes/utils.js';

/** 裝置簽章鑰。私鑰只存在本機，不寫進任何文件包或事件。 */
export interface KeyPair {
  /** ed25519:<公鑰 base64url> */
  id: string;
  secretKey: Uint8Array;
}

export function keyIdOf(publicKey: Uint8Array): string {
  return `ed25519:${toBase64Url(publicKey)}`;
}

export function publicKeyOf(keyId: string): Uint8Array {
  const m = /^ed25519:([A-Za-z0-9_-]{43})$/.exec(keyId);
  if (!m) throw new Error(`不是有效的金鑰識別碼：${keyId}`);
  return fromBase64Url(m[1]);
}

export function generateKeyPair(): KeyPair {
  const secretKey = ed25519.utils.randomSecretKey();
  return { id: keyIdOf(ed25519.getPublicKey(secretKey)), secretKey };
}

export function keyPairFromSecret(secretKey: Uint8Array): KeyPair {
  return { id: keyIdOf(ed25519.getPublicKey(secretKey)), secretKey };
}

/** 簽章前一律加上用途前綴，同一把鑰簽的事件不會被拿去冒充見證，反之亦然 */
const domainBytes = (domain: string, message: string) => concatBytes(utf8ToBytes(`${domain}\n`), utf8ToBytes(message));

export function signText(domain: string, message: string, key: KeyPair): string {
  return toBase64Url(ed25519.sign(domainBytes(domain, message), key.secretKey));
}

export function verifyText(domain: string, message: string, signature: string, keyId: string): boolean {
  try {
    return ed25519.verify(fromBase64Url(signature), domainBytes(domain, message), publicKeyOf(keyId));
  } catch {
    return false;
  }
}
