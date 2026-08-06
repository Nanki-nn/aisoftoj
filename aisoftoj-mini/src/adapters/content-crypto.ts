export const CONTENT_CRYPTO_VERSION = '1'
export const CONTENT_CRYPTO_ALGORITHM = 'RSA-OAEP-256+A256GCM'
export const CONTENT_CRYPTO_VERSION_HEADER = 'X-Content-Crypto-Version'
export const CONTENT_CRYPTO_PUBLIC_KEY_HEADER = 'X-Content-Public-Key'
export const CONTENT_CRYPTO_RESPONSE_HEADER = 'X-Content-Encrypted'

const AES_KEY_BYTES = 32
const GCM_IV_BYTES = 12

export interface EncryptedContentEnvelope {
  version: number
  algorithm: string
  encryptedKey: string
  iv: string
  ciphertext: string
}

export class ContentCryptoError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message)
    this.name = 'ContentCryptoError'
    if (options && 'cause' in options) {
      Object.defineProperty(this, 'cause', { value: options.cause, enumerable: false })
    }
  }
}

function encodeBase64Url(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value)
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  let result = ''
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index]
    const second = bytes[index + 1]
    const third = bytes[index + 2]
    result += alphabet[first >> 2]
    result += alphabet[((first & 3) << 4) | ((second || 0) >> 4)]
    if (index + 1 < bytes.length) {
      result += alphabet[((second & 15) << 2) | ((third || 0) >> 6)]
    }
    if (index + 2 < bytes.length) {
      result += alphabet[third & 63]
    }
  }
  return result
}

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) {
    throw new ContentCryptoError('题目加密信封编码不合法')
  }
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
  const outputLength = Math.floor((value.length * 6) / 8)
  const output = new Uint8Array(new ArrayBuffer(outputLength))
  let accumulator = 0
  let bitCount = 0
  let offset = 0
  for (const character of value) {
    const digit = alphabet.indexOf(character)
    if (digit < 0) throw new ContentCryptoError('题目加密信封编码不合法')
    accumulator = (accumulator << 6) | digit
    bitCount += 6
    if (bitCount >= 8) {
      bitCount -= 8
      output[offset] = (accumulator >> bitCount) & 255
      offset += 1
    }
  }
  if (encodeBase64Url(output.buffer) !== value) {
    throw new ContentCryptoError('题目加密信封编码不规范')
  }
  return output
}

function decodeUtf8(bytes: Uint8Array): string {
  let result = ''
  for (let index = 0; index < bytes.length;) {
    const first = bytes[index++]
    let codePoint = first
    let continuationCount = 0
    if ((first & 0xe0) === 0xc0) {
      codePoint = first & 0x1f
      continuationCount = 1
    } else if ((first & 0xf0) === 0xe0) {
      codePoint = first & 0x0f
      continuationCount = 2
    } else if ((first & 0xf8) === 0xf0) {
      codePoint = first & 0x07
      continuationCount = 3
    } else if (first > 0x7f) {
      throw new ContentCryptoError('题目解密文本编码不合法')
    }
    if (index + continuationCount > bytes.length) {
      throw new ContentCryptoError('题目解密文本编码不完整')
    }
    for (let step = 0; step < continuationCount; step += 1) {
      const continuation = bytes[index++]
      if ((continuation & 0xc0) !== 0x80) {
        throw new ContentCryptoError('题目解密文本编码不合法')
      }
      codePoint = (codePoint << 6) | (continuation & 0x3f)
    }
    const minimum = continuationCount === 1 ? 0x80 : continuationCount === 2 ? 0x800 : 0x10000
    if (
      (continuationCount > 0 && codePoint < minimum) ||
      codePoint > 0x10ffff ||
      (codePoint >= 0xd800 && codePoint <= 0xdfff)
    ) {
      throw new ContentCryptoError('题目解密文本编码不合法')
    }
    result += String.fromCodePoint(codePoint)
  }
  return result
}

function assertEnvelope(value: unknown): asserts value is EncryptedContentEnvelope {
  const envelope = value as Partial<EncryptedContentEnvelope> | null
  if (
    !envelope ||
    envelope.version !== 1 ||
    envelope.algorithm !== CONTENT_CRYPTO_ALGORITHM ||
    typeof envelope.encryptedKey !== 'string' ||
    typeof envelope.iv !== 'string' ||
    typeof envelope.ciphertext !== 'string'
  ) {
    throw new ContentCryptoError('题目加密信封格式或协议不合法')
  }
}

export function readHeader(headers: Record<string, unknown>, name: string): string | undefined {
  const target = name.toLowerCase()
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target && value != null) return String(value)
  }
  return undefined
}

export function requireEncryptedResponse(headers: Record<string, unknown>): void {
  if (readHeader(headers, CONTENT_CRYPTO_RESPONSE_HEADER) !== CONTENT_CRYPTO_VERSION) {
    throw new ContentCryptoError('题目响应缺少加密标记，已拒绝读取')
  }
}

export class MiniProgramContentCrypto {
  private keyPairPromise?: Promise<CryptoKeyPair>

  constructor(private readonly runtime: Crypto) {
    if (!runtime?.subtle || typeof runtime.getRandomValues !== 'function') {
      throw new ContentCryptoError('当前微信运行时不支持安全题目解密')
    }
  }

  async requestHeaders(): Promise<Record<string, string>> {
    const keyPair = await this.keyPair()
    const publicKey = await this.runtime.subtle.exportKey('spki', keyPair.publicKey)
    return {
      [CONTENT_CRYPTO_VERSION_HEADER]: CONTENT_CRYPTO_VERSION,
      [CONTENT_CRYPTO_PUBLIC_KEY_HEADER]: encodeBase64Url(publicKey)
    }
  }

  async decrypt<T>(value: unknown): Promise<T> {
    assertEnvelope(value)
    try {
      const keyPair = await this.keyPair()
      const encryptedKey = decodeBase64Url(value.encryptedKey)
      const iv = decodeBase64Url(value.iv)
      const ciphertext = decodeBase64Url(value.ciphertext)
      if (iv.byteLength !== GCM_IV_BYTES) {
        throw new ContentCryptoError('题目加密信封 IV 长度不合法')
      }
      const rawAesKey = await this.runtime.subtle.decrypt(
        { name: 'RSA-OAEP' },
        keyPair.privateKey,
        encryptedKey
      )
      if (rawAesKey.byteLength !== AES_KEY_BYTES) {
        throw new ContentCryptoError('题目加密信封密钥长度不合法')
      }
      const aesKey = await this.runtime.subtle.importKey(
        'raw',
        rawAesKey,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      )
      const plaintext = await this.runtime.subtle.decrypt(
        { name: 'AES-GCM', iv, tagLength: 128 },
        aesKey,
        ciphertext
      )
      return JSON.parse(decodeUtf8(new Uint8Array(plaintext))) as T
    } catch (error) {
      if (error instanceof ContentCryptoError) throw error
      throw new ContentCryptoError('题目内容解密或完整性校验失败', { cause: error })
    }
  }

  private keyPair(): Promise<CryptoKeyPair> {
    if (!this.keyPairPromise) {
      this.keyPairPromise = this.runtime.subtle.generateKey(
        {
          name: 'RSA-OAEP',
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256'
        },
        false,
        ['encrypt', 'decrypt']
      ) as Promise<CryptoKeyPair>
    }
    return this.keyPairPromise
  }
}

let runtimeInstance: MiniProgramContentCrypto | undefined

export function getMiniProgramContentCrypto(): MiniProgramContentCrypto {
  if (!runtimeInstance) {
    runtimeInstance = new MiniProgramContentCrypto(globalThis.crypto)
  }
  return runtimeInstance
}
