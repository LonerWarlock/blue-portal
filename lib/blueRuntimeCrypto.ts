import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export interface EncryptedRuntimeSecret {
  encryptedKey: string;
  iv: string;
  tag: string;
  version: 'v1';
}

function encryptionKey(): Buffer {
  const raw = String(process.env.BLUE_RUNTIME_TOKEN_ENCRYPTION_KEY || '').trim();
  const key = /^[a-f0-9]{64}$/i.test(raw)
    ? Buffer.from(raw, 'hex')
    : Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('BLUE_RUNTIME_TOKEN_ENCRYPTION_KEY must be a 32-byte base64 or 64-character hex value');
  }
  return key;
}

export function encryptRuntimeSecret(value: string, aad: string): EncryptedRuntimeSecret {
  if (!value) throw new Error('Cannot encrypt an empty runtime secret');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return {
    encryptedKey: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    version: 'v1'
  };
}

export function decryptRuntimeSecret(secret: EncryptedRuntimeSecret, aad: string): string {
  if (secret.version !== 'v1') throw new Error('Unsupported runtime credential encryption version');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(secret.iv, 'base64')
  );
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(Buffer.from(secret.tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(secret.encryptedKey, 'base64')),
    decipher.final()
  ]).toString('utf8');
}

