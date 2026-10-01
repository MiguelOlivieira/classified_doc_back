import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const ALGORITHM = 'aes-256-gcm';

// The key must be exactly 32 bytes for aes-256-gcm
// We will look for DATA_ENCRYPTION_KEY in env, fallback for dev
const getEncryptionKey = (): Buffer => {
  const keyStr = process.env.DATA_ENCRYPTION_KEY || 'default_secret_key_32_bytes_long_123';
  return crypto.scryptSync(keyStr, 'salt', 32); // ensure exactly 32 bytes
};

export const encrypt = (text: string): string => {
  const iv = crypto.randomBytes(16);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  // Format: iv:authTag:encryptedText
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
};

export const decrypt = (text: string): string => {
  try {
    const parts = text.split(':');
    if (parts.length !== 3) {
      // Not encrypted or old format
      return text;
    }
    
    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = getEncryptionKey();
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (e) {
    console.error('Falha na decriptação do documento:', e);
    return text; // Return original if decryption fails (might be unencrypted old data)
  }
};
