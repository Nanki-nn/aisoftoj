import {
  CONTENT_CRYPTO_ENCRYPTED_HEADER,
  CONTENT_CRYPTO_PUBLIC_KEY_HEADER,
  resetContentCryptoForTests,
} from './contentCrypto';
import { ApiRequestError, requestEncrypted } from './api';
import { encryptForBrowserPublicKey } from './contentCrypto.test-utils';

const memoryStorage = new Map<string, string>();

describe('requestEncrypted', () => {
  beforeEach(() => {
    memoryStorage.clear();
    resetContentCryptoForTests();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => memoryStorage.get(key) ?? null,
        setItem: (key: string, value: string) => memoryStorage.set(key, value),
        removeItem: (key: string) => memoryStorage.delete(key),
        clear: () => memoryStorage.clear(),
      },
    });
  });

  it('decrypts a successful encrypted API response', async () => {
    globalThis.fetch = async (_input, init) => {
      const headers = new Headers(init?.headers);
      const publicKey = headers.get(CONTENT_CRYPTO_PUBLIC_KEY_HEADER);
      expect(publicKey).toBeTruthy();
      const envelope = await encryptForBrowserPublicKey(publicKey!, {
        code: 200,
        message: '操作成功',
        data: { id: 7 },
        timestamp: Date.now(),
      });
      return new Response(JSON.stringify(envelope), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          [CONTENT_CRYPTO_ENCRYPTED_HEADER]: '1',
        },
      });
    };

    await expect(requestEncrypted<{ id: number }>('/encrypted')).resolves.toEqual({ id: 7 });
  });

  it('fails closed when a successful response is plaintext', async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({
      code: 200,
      message: '操作成功',
      data: { answer: 'A' },
      timestamp: Date.now(),
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    await expect(requestEncrypted('/plaintext-success')).rejects.toMatchObject({
      message: '题目数据安全校验失败，请刷新后重试',
    });
  });

  it('keeps HTTP 200 in-band business errors readable', async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({
      code: 429,
      message: '请求过于频繁',
      data: null,
      timestamp: Date.now(),
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    await expect(requestEncrypted('/business-error')).rejects.toEqual(
      expect.objectContaining<ApiRequestError>({
        message: '请求过于频繁',
        status: 200,
        code: 429,
      })
    );
  });
});
