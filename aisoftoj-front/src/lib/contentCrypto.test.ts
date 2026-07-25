import {
  CONTENT_CRYPTO_PUBLIC_KEY_HEADER,
  ContentCryptoError,
  decryptContentEnvelope,
  getContentCryptoRequestHeaders,
  resetContentCryptoForTests,
} from './contentCrypto';
import {
  base64UrlToBytes,
  bytesToBase64Url,
  encryptForBrowserPublicKey,
} from './contentCrypto.test-utils';

describe('contentCrypto', () => {
  beforeEach(() => resetContentCryptoForTests());

  it('reuses one temporary key pair for concurrent requests', async () => {
    const headers = await Promise.all([
      getContentCryptoRequestHeaders(),
      getContentCryptoRequestHeaders(),
      getContentCryptoRequestHeaders(),
    ]);

    expect(headers[0][CONTENT_CRYPTO_PUBLIC_KEY_HEADER]).toBe(
      headers[1][CONTENT_CRYPTO_PUBLIC_KEY_HEADER]
    );
    expect(headers[1][CONTENT_CRYPTO_PUBLIC_KEY_HEADER]).toBe(
      headers[2][CONTENT_CRYPTO_PUBLIC_KEY_HEADER]
    );
  });

  it('decrypts an RSA-OAEP and AES-GCM envelope', async () => {
    const headers = await getContentCryptoRequestHeaders();
    const expected = { code: 200, message: '操作成功', data: { question: 'test' } };
    const envelope = await encryptForBrowserPublicKey(
      headers[CONTENT_CRYPTO_PUBLIC_KEY_HEADER],
      expected
    );

    await expect(decryptContentEnvelope(envelope)).resolves.toEqual(expected);
  });

  it('rejects a tampered ciphertext', async () => {
    const headers = await getContentCryptoRequestHeaders();
    const envelope = await encryptForBrowserPublicKey(
      headers[CONTENT_CRYPTO_PUBLIC_KEY_HEADER],
      { code: 200, data: { answer: 'A' } }
    );
    const ciphertext = base64UrlToBytes(envelope.ciphertext);
    ciphertext[ciphertext.length - 1] ^= 1;

    await expect(decryptContentEnvelope({
      ...envelope,
      ciphertext: bytesToBase64Url(ciphertext),
    })).rejects.toBeInstanceOf(ContentCryptoError);
  });
});
