// src/lib/security/encryption.ts
import crypto from 'crypto';

// --- Configuration ---
// IMPORTANT: Store this securely in environment variables, DO NOT hardcode it.
// It must be a 32-byte (256-bit) key.
const ENCRYPTION_KEY = process.env.CREDENTIAL_ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-gcm'; // Galois/Counter Mode provides authenticated encryption
const IV_LENGTH = 16; // AES GCM standard IV length
const AUTH_TAG_LENGTH = 16; // AES GCM standard auth tag length

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
  // Throw an error during development/build if the key is missing or invalid
  // In production, you might want more robust error handling or logging
  throw new Error('Invalid or missing CREDENTIAL_ENCRYPTION_KEY environment variable. Must be 32 bytes.');
}

const key = Buffer.from(ENCRYPTION_KEY, 'utf8'); // Ensure key is treated as buffer

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * @param text The plaintext string to encrypt.
 * @returns A string containing the IV, auth tag, and ciphertext, concatenated and base64 encoded.
 *          Returns null if encryption fails.
 */
export async function encryptCredential(text: string): Promise<string | null> {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const authTag = cipher.getAuthTag();

    // Concatenate IV, auth tag, and ciphertext for storage
    // We store them together, base64 encoded, separated by a delimiter
    // Delimiter choice is important - avoid chars likely in base64 output
    const parts = [
      iv.toString('base64'),
      authTag.toString('base64'),
      encrypted,
    ];
    return parts.join(':'); // Use ':' as a delimiter

  } catch (error) {
    console.error('Encryption failed:', error);
    return null;
  }
}

/**
 * Decrypts a string previously encrypted with encryptCredential.
 * @param encryptedData The base64 encoded string containing IV:AuthTag:Ciphertext.
 * @returns The original plaintext string, or null if decryption fails (e.g., wrong key, tampered data).
 */
export async function decryptCredential(encryptedData: string): Promise<string | null> {
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      console.error('Decryption failed: Invalid encrypted data format.');
      return null;
    }

    const [ivBase64, authTagBase64, encryptedTextBase64] = parts;

    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    // We don't need to decode the encryptedTextBase64 here, createDecipheriv handles it

    // Validate lengths to prevent certain attacks
    if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
        console.error('Decryption failed: Invalid IV or Auth Tag length.');
        return null;
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedTextBase64, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;

  } catch (error) {
    // This catch block is crucial as it handles decryption failures (e.g., wrong key, integrity check fail)
    console.error('Decryption failed:', error instanceof Error ? error.message : error);
    return null;
  }
}