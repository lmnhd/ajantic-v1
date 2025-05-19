import { db as prisma } from '@/src/lib/db'; // Use shared Prisma client
import { decryptCredential, encryptCredential } from './encryption'; // Import both encryption and decryption utilities
import { Prisma } from '@prisma/client'; // Import Prisma for error types

/**
 * Custom error for credential conflicts.
 */
export class UserCredentialConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserCredentialConflictError';
  }
}

/**
 * Securely encrypts and saves/updates a user credential.
 * This function should ONLY be called from secure server-side environments.
 *
 * @param clerkId The Clerk ID of the user owning the credential.
 * @param credentialName The name identifier of the credential (e.g., "OPENAI_API_KEY").
 * @param secretValue The plaintext secret value to be encrypted and stored.
 * @returns A promise that resolves when the operation is complete.
 * @throws Will throw an error if encryption fails or database operation fails.
 */
export async function saveUserCredential(
  clerkId: string,
  credentialName: string,
  secretValue: string
): Promise<void> {
  if (!clerkId || !credentialName || typeof secretValue !== 'string') {
    // Do not log secretValue itself
    console.error('saveUserCredential: clerkId, credentialName, and secretValue are required.');
    throw new Error('Invalid input for saving credential.');
  }

  try {
    // 0. Verify the User exists
    const user = await prisma.user.findUnique({
      where: { clerkId: clerkId },
      select: { id: true } // Select a minimal field to check for existence
    });

    if (!user) {
      console.error(`User with clerkId "${clerkId}" not found. Cannot save credential "${credentialName}".`);
      throw new Error(`User with clerkId "${clerkId}" not found. Ensure the user exists before saving credentials.`);
    }

    // 1. Encrypt the secret value
    const encryptedValue = await encryptCredential(secretValue);
    if (!encryptedValue) {
      // Encryption failure is logged within encryptCredential
      console.error(`Failed to encrypt credential "${credentialName}" for user ${clerkId}.`);
      throw new Error('Encryption failed for credential.');
    }

    // 2. Upsert (update or insert) the credential in the database
    await prisma.userCredential.upsert({
      where: {
        clerkId_credentialName: {
          clerkId: clerkId,
          credentialName: credentialName,
        },
      },
      update: {
        encryptedValue: encryptedValue,
      },
      create: {
        credentialName: credentialName,
        encryptedValue: encryptedValue,
        user: {
          connect: {
            clerkId: clerkId
          }
        }
      },
    });

    console.log(`Credential "${credentialName}" saved successfully for user ${clerkId}.`);

  } catch (error: any) {
    console.error(`Error saving credential "${credentialName}" for user ${clerkId}:`, error);
    // Check for Prisma-specific unique constraint violation error, though upsert should handle it.
    // This is more of a fallback or if other unique constraints were violated.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new UserCredentialConflictError(
        `A credential named "${credentialName}" might already exist or another conflict occurred.`
      );
    }
    throw new Error(`Failed to save credential "${credentialName}".`);
  }
}

/**
 * Securely fetches and decrypts a stored user credential.
 * This function should ONLY be called from secure server-side environments
 * (API Routes, Server Actions, RSCs where auth is checked) as it handles sensitive data.
 *
 * @param clerkId The Clerk ID of the user owning the credential.
 * @param credentialName The name identifier of the credential to fetch (e.g., "OPENAI_API_KEY").
 * @returns The decrypted credential value as a string if found and successfully decrypted, otherwise null.
 */
export async function getDecryptedCredential(
  clerkId: string,
  credentialName: string
): Promise<string | null> {
  if (!clerkId || !credentialName) {
    console.error('getDecryptedCredential: clerkId and credentialName are required.');
    return null; // Or throw an error, depending on desired strictness
  }

  try {
    // 1. Fetch the credential record from the database
    const credentialRecord = await prisma.userCredential.findUnique({
      where: {
        clerkId_credentialName: {
          clerkId: clerkId,
          credentialName: credentialName,
        },
      },
      select: {
        encryptedValue: true, // Only select the encrypted value
      },
    });

    // 2. Check if the record exists
    if (!credentialRecord) {
      console.log(`Credential "${credentialName}" not found for user ${clerkId}.`);
      return null;
    }

    // 3. Decrypt the value
    const decryptedValue = await decryptCredential(credentialRecord.encryptedValue);

    // 4. Check if decryption was successful
    if (decryptedValue === null) {
      // Decryption failure is logged within decryptCredential
      console.error(`Failed to decrypt credential "${credentialName}" for user ${clerkId}.`);
      return null;
    }

    // 5. Return the plaintext credential value
    return decryptedValue;

  } catch (error) {
    console.error(`Error fetching/decrypting credential "${credentialName}" for user ${clerkId}:`, error);
    return null;
  }
}
