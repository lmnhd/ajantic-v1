import { db as prisma } from '@/src/lib/db'; // Use shared Prisma client
import { decryptCredential } from './encryption'; // Import the decryption utility

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
