import crypto from 'crypto';

// This is just a placeholder key - in production, use a proper key management system
const ENCRYPTION_KEY = crypto.scryptSync(
  process.env.ENCRYPTION_KEY || 'your-secret-key-min-32-chars-long!!!',
  'salt',
  32 // 32 bytes = 256 bits
);
const ALGORITHM = 'aes-256-gcm';

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // We need to store the IV and auth tag for decryption
  return JSON.stringify({
    iv: iv.toString('hex'),
    encrypted,
    authTag: authTag.toString('hex')
  });
}

export function decrypt(encryptedData: string): string {
  const { iv, encrypted, authTag } = JSON.parse(encryptedData);
  
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    ENCRYPTION_KEY,
    Buffer.from(iv, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
} 