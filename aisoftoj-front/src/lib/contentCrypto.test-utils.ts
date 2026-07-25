export function bytesToBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

export function base64UrlToBytes(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, 'base64url'));
}

export async function encryptForBrowserPublicKey(publicKeyHeader: string, payload: unknown) {
  const publicKey = await crypto.subtle.importKey(
    'spki',
    base64UrlToBytes(publicKeyHeader),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  );
  const aesKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt']
  );
  const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);
  const encryptedKey = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    publicKey,
    rawAesKey
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    aesKey,
    plaintext
  );

  return {
    version: 1,
    algorithm: 'RSA-OAEP-256+A256GCM',
    encryptedKey: bytesToBase64Url(new Uint8Array(encryptedKey)),
    iv: bytesToBase64Url(iv),
    ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
  };
}
