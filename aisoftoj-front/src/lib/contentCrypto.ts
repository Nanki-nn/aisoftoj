export const CONTENT_CRYPTO_VERSION_HEADER = 'X-Content-Crypto-Version';
export const CONTENT_CRYPTO_PUBLIC_KEY_HEADER = 'X-Content-Public-Key';
export const CONTENT_CRYPTO_ENCRYPTED_HEADER = 'X-Content-Encrypted';

const CONTENT_CRYPTO_VERSION = 1;
const CONTENT_CRYPTO_ALGORITHM = 'RSA-OAEP-256+A256GCM';
const BASE64_URL_PATTERN = /^[A-Za-z0-9_-]+$/;

interface EncryptedContentEnvelope {
  version: number;
  algorithm: string;
  encryptedKey: string;
  iv: string;
  ciphertext: string;
}

interface ContentCryptoContext {
  privateKey: CryptoKey;
  publicKeyHeader: string;
}

export class ContentCryptoError extends Error {
  constructor(message = '题目数据安全校验失败，请刷新后重试') {
    super(message);
    this.name = 'ContentCryptoError';
  }
}

let cryptoContextPromise: Promise<ContentCryptoContext> | null = null;

function getSubtleCrypto(): SubtleCrypto {
  if (!globalThis.crypto?.subtle) {
    throw new ContentCryptoError('当前浏览器不支持题目数据安全协议，请升级浏览器后重试');
  }
  return globalThis.crypto.subtle;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlToBytes(value: unknown): Uint8Array {
  if (typeof value !== 'string' || !value || !BASE64_URL_PATTERN.test(value)) {
    throw new ContentCryptoError();
  }
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
    + '='.repeat((4 - (value.length % 4)) % 4);
  try {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    if (bytesToBase64Url(bytes) !== value) {
      throw new ContentCryptoError();
    }
    return bytes;
  } catch (error) {
    if (error instanceof ContentCryptoError) {
      throw error;
    }
    throw new ContentCryptoError();
  }
}

function parseEnvelope(payload: unknown): EncryptedContentEnvelope {
  if (!payload || typeof payload !== 'object') {
    throw new ContentCryptoError();
  }
  const envelope = payload as Partial<EncryptedContentEnvelope>;
  if (
    envelope.version !== CONTENT_CRYPTO_VERSION
    || envelope.algorithm !== CONTENT_CRYPTO_ALGORITHM
    || typeof envelope.encryptedKey !== 'string'
    || typeof envelope.iv !== 'string'
    || typeof envelope.ciphertext !== 'string'
  ) {
    throw new ContentCryptoError();
  }
  return envelope as EncryptedContentEnvelope;
}

async function createCryptoContext(): Promise<ContentCryptoContext> {
  const subtle = getSubtleCrypto();
  const keyPair = await subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    false,
    ['encrypt', 'decrypt']
  ) as CryptoKeyPair;
  const publicKey = new Uint8Array(await subtle.exportKey('spki', keyPair.publicKey));
  return {
    privateKey: keyPair.privateKey,
    publicKeyHeader: bytesToBase64Url(publicKey),
  };
}

async function getCryptoContext(): Promise<ContentCryptoContext> {
  if (!cryptoContextPromise) {
    cryptoContextPromise = createCryptoContext().catch((error) => {
      cryptoContextPromise = null;
      if (error instanceof ContentCryptoError) {
        throw error;
      }
      throw new ContentCryptoError();
    });
  }
  return cryptoContextPromise;
}

export async function getContentCryptoRequestHeaders(): Promise<Record<string, string>> {
  const context = await getCryptoContext();
  return {
    [CONTENT_CRYPTO_VERSION_HEADER]: String(CONTENT_CRYPTO_VERSION),
    [CONTENT_CRYPTO_PUBLIC_KEY_HEADER]: context.publicKeyHeader,
  };
}

export async function decryptContentEnvelope<T>(payload: unknown): Promise<T> {
  const envelope = parseEnvelope(payload);
  const context = await getCryptoContext();
  const subtle = getSubtleCrypto();

  try {
    const encryptedKey = base64UrlToBytes(envelope.encryptedKey);
    const iv = base64UrlToBytes(envelope.iv);
    const ciphertext = base64UrlToBytes(envelope.ciphertext);
    if (encryptedKey.length !== 256 || iv.length !== 12 || ciphertext.length < 16) {
      throw new ContentCryptoError();
    }

    const rawAesKey = await subtle.decrypt(
      { name: 'RSA-OAEP' },
      context.privateKey,
      encryptedKey
    );
    if (rawAesKey.byteLength !== 32) {
      throw new ContentCryptoError();
    }

    const aesKey = await subtle.importKey(
      'raw',
      rawAesKey,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    const plaintext = await subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
        tagLength: 128,
      },
      aesKey,
      ciphertext
    );
    return JSON.parse(new TextDecoder().decode(plaintext)) as T;
  } catch (error) {
    if (error instanceof ContentCryptoError) {
      throw error;
    }
    throw new ContentCryptoError();
  }
}

export function resetContentCryptoForTests(): void {
  cryptoContextPromise = null;
}
