import { describe, expect, it } from 'vitest'
import {
  CONTENT_CRYPTO_ALGORITHM,
  CONTENT_CRYPTO_PUBLIC_KEY_HEADER,
  CONTENT_CRYPTO_RESPONSE_HEADER,
  CONTENT_CRYPTO_VERSION_HEADER,
  ContentCryptoError,
  MiniProgramContentCrypto,
  readHeader,
  requireEncryptedResponse,
  type EncryptedContentEnvelope
} from './content-crypto'

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

function encode(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value)
  let result = ''
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index]
    const second = bytes[index + 1]
    const third = bytes[index + 2]
    result += alphabet[first >> 2]
    result += alphabet[((first & 3) << 4) | ((second || 0) >> 4)]
    if (index + 1 < bytes.length) result += alphabet[((second & 15) << 2) | ((third || 0) >> 6)]
    if (index + 2 < bytes.length) result += alphabet[third & 63]
  }
  return result
}

function decode(value: string): Uint8Array<ArrayBuffer> {
  const output = new Uint8Array(new ArrayBuffer(Math.floor((value.length * 6) / 8)))
  let accumulator = 0
  let bits = 0
  let offset = 0
  for (const character of value) {
    accumulator = (accumulator << 6) | alphabet.indexOf(character)
    bits += 6
    if (bits >= 8) {
      bits -= 8
      output[offset++] = (accumulator >> bits) & 255
    }
  }
  return output
}

async function javaCompatibleEnvelope(
  runtime: Crypto,
  publicKeyHeader: string,
  payload: unknown
): Promise<EncryptedContentEnvelope> {
  const publicKey = await runtime.subtle.importKey(
    'spki',
    decode(publicKeyHeader),
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  )
  const aesKey = await runtime.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt'])
  const rawAesKey = await runtime.subtle.exportKey('raw', aesKey)
  const encryptedKey = await runtime.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, rawAesKey)
  const iv = runtime.getRandomValues(new Uint8Array(new ArrayBuffer(12)))
  const plaintext = new TextEncoder().encode(JSON.stringify(payload))
  const ciphertext = await runtime.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    aesKey,
    plaintext
  )
  return {
    version: 1,
    algorithm: CONTENT_CRYPTO_ALGORITHM,
    encryptedKey: encode(encryptedKey),
    iv: encode(iv.buffer),
    ciphertext: encode(ciphertext)
  }
}

describe('MiniProgramContentCrypto', () => {
  it('exports the backend protocol headers and decrypts a Java-compatible envelope', async () => {
    const adapter = new MiniProgramContentCrypto(globalThis.crypto)
    const headers = await adapter.requestHeaders()
    expect(headers[CONTENT_CRYPTO_VERSION_HEADER]).toBe('1')
    expect(headers[CONTENT_CRYPTO_PUBLIC_KEY_HEADER]).toMatch(/^[A-Za-z0-9_-]+$/)

    const payload = { code: 200, message: '操作成功', data: { intro: '架构题：你好，世界 🌏' } }
    const envelope = await javaCompatibleEnvelope(
      globalThis.crypto,
      headers[CONTENT_CRYPTO_PUBLIC_KEY_HEADER],
      payload
    )
    await expect(adapter.decrypt(envelope)).resolves.toEqual(payload)
  })

  it('fails closed when the envelope is tampered with or the protocol changes', async () => {
    const adapter = new MiniProgramContentCrypto(globalThis.crypto)
    const headers = await adapter.requestHeaders()
    const envelope = await javaCompatibleEnvelope(
      globalThis.crypto,
      headers[CONTENT_CRYPTO_PUBLIC_KEY_HEADER],
      { code: 200, data: ['A'] }
    )
    const tampered = `${envelope.ciphertext.slice(0, -1)}${envelope.ciphertext.endsWith('A') ? 'B' : 'A'}`
    await expect(adapter.decrypt({ ...envelope, ciphertext: tampered }))
      .rejects.toBeInstanceOf(ContentCryptoError)
    await expect(adapter.decrypt({ ...envelope, algorithm: 'plaintext' }))
      .rejects.toBeInstanceOf(ContentCryptoError)
  })

  it('reads response markers case-insensitively', () => {
    expect(readHeader({ 'x-content-encrypted': '1' }, CONTENT_CRYPTO_RESPONSE_HEADER)).toBe('1')
    expect(() => requireEncryptedResponse({})).toThrow(ContentCryptoError)
    expect(() => requireEncryptedResponse({ 'x-content-encrypted': '1' })).not.toThrow()
  })

  it('rejects runtimes without native secure crypto', () => {
    expect(() => new MiniProgramContentCrypto({} as Crypto)).toThrow(ContentCryptoError)
  })
})
