import crypto from 'crypto';

// Hash the input key to guarantee a 32-byte key buffer for AES-256-GCM
const getEncryptionKey = () => {
  const secret = process.env.TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error('TOKEN_ENCRYPTION_KEY environment variable is not defined.');
  }
  return crypto.createHash('sha256').update(secret).digest();
};

/**
 * Encrypts a string using AES-256-GCM.
 * @param {string} text - The clear text to encrypt.
 * @returns {string} The encrypted payload formatted as iv:encryptedData:authTag
 */
export const encrypt = (text) => {
  if (!text) return null;
  
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // standard 12 bytes for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  return `${iv.toString('hex')}:${encrypted}:${authTag}`;
};

/**
 * Decrypts an AES-256-GCM encrypted payload.
 * @param {string} payload - The formatted payload (iv:encryptedData:authTag).
 * @returns {string} The decrypted clear text.
 */
export const decrypt = (payload) => {
  if (!payload) return null;
  
  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format.');
  }
  
  const [ivHex, encryptedHex, authTagHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};
