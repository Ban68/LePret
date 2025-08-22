import crypto from 'crypto';

const algorithm = 'aes-256-gcm';
const ivLength = 12; // Recommended length for GCM

const rawKey = process.env.ENCRYPTION_KEY;
if (!rawKey) {
  throw new Error('ENCRYPTION_KEY is not set');
}

// Derive a 32-byte key using SHA-256
const key = crypto.createHash('sha256').update(String(rawKey)).digest();

export function encrypt(plainText: string): string {
  const iv = crypto.randomBytes(ivLength);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decrypt(encryptedText: string): string {
  const data = Buffer.from(encryptedText, 'base64');
  const iv = data.subarray(0, ivLength);
  const authTag = data.subarray(ivLength, ivLength + 16);
  const text = data.subarray(ivLength + 16);
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(text), decipher.final()]);
  return decrypted.toString('utf8');
}
