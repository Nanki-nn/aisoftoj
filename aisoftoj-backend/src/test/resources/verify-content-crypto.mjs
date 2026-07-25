import { webcrypto } from 'node:crypto';

const { subtle } = webcrypto;
let input = '';
for await (const chunk of process.stdin) {
  input += chunk;
}

const fixture = JSON.parse(input);
const decode = value => Buffer.from(value, 'base64url');
const privateKey = await subtle.importKey(
  'pkcs8',
  decode(fixture.privateKey),
  { name: 'RSA-OAEP', hash: 'SHA-256' },
  false,
  ['decrypt']
);
const rawAesKey = await subtle.decrypt(
  { name: 'RSA-OAEP' },
  privateKey,
  decode(fixture.envelope.encryptedKey)
);
if (rawAesKey.byteLength !== 32) {
  throw new Error(`Expected a 32-byte AES key, got ${rawAesKey.byteLength}`);
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
    iv: decode(fixture.envelope.iv),
    tagLength: 128,
  },
  aesKey,
  decode(fixture.envelope.ciphertext)
);
const actual = JSON.parse(new TextDecoder().decode(plaintext));
if (JSON.stringify(actual) !== JSON.stringify(fixture.expected)) {
  throw new Error(`Decrypted payload mismatch: ${JSON.stringify(actual)}`);
}
