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

export const isEncrypted = (text: string): boolean => {
  if (!text || typeof text !== 'string') return false;
  return /^[0-9a-f]{32}:[0-9a-f]{32}:[0-9a-f]+$/i.test(text);
};

/**
 * Determina se o documento deve ser criptografado em repouso no banco de dados.
 * Regra do Sistema: Criptografar apenas documentos CONFIDENCIAIS e acima (Confidencial, Secreto, Ultrassecreto).
 * Documentos Públicos e Internos são salvos em texto puro.
 */
export const shouldEncryptDocument = (nivelAcesso: string | number): boolean => {
  const normalized = String(nivelAcesso).toUpperCase().trim();
  if (normalized === '1' || normalized === 'PUBLICO' || normalized === '2' || normalized === 'INTERNO') {
    return false;
  }
  return true;
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
  if (!text || !isEncrypted(text)) {
    // Não criptografado (ex: documentos Públicos ou Internos em texto puro)
    return text;
  }

  try {
    const parts = text.split(':');
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
