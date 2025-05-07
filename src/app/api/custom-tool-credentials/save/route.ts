// src/app/api/custom-tool-credentials/save/route.ts
import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { db as prisma } from '@/src/lib/db'; // Using the shared client from db.ts
import { encryptCredential } from '@/src/lib/security/encryption';
import { auth } from "@clerk/nextjs/server"; // Import Clerk's auth helper

// Schema defining the expected request body
const saveCredentialSchema = z.object({
  credentialName: z.string().min(1, "Credential name cannot be empty"),
  credentialValue: z.string().min(1, "Credential value cannot be empty"),
  serviceName: z.string().optional(), // Optional context about the service this credential is for
});

export async function POST(req: NextRequest) {
  // 1. Authenticate the user and get userId using Clerk
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    // If clerkId is null, the user is not authenticated
    return NextResponse.json({ error: 'Unauthorized: User not logged in.' }, { status: 401 });
  }
  // Now 'clerkId' contains the authenticated Clerk user ID

  let credentialData;
  try {
    // 2. Validate the incoming request body against the Zod schema
    credentialData = saveCredentialSchema.parse(await req.json());
  } catch (error) {
    console.error("Invalid credential save request:", error);
    const errorMessage = error instanceof z.ZodError
      ? error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      : 'Invalid request body';
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }

  try {
    // 3. Encrypt the credential value before storing
    // Note: The implementation of encryptCredential is required in '@/lib/security/encryption'
    const encryptedValue = await encryptCredential(credentialData.credentialValue);
    if (!encryptedValue) {
        // Handle potential encryption failures
        console.error('Encryption failed for credential:', credentialData.credentialName);
        return NextResponse.json({ error: 'Internal server error during encryption' }, { status: 500 });
    }

    // 4. Upsert (Update or Insert) the credential into the database using the shared Prisma client
    await prisma.userCredential.upsert({
      where: {
        // Use the updated unique constraint name from the schema (clerkId_credentialName)
        clerkId_credentialName: {
          clerkId: clerkId,
          credentialName: credentialData.credentialName,
        },
      },
      update: {
        // Fields to update if the record exists
        encryptedValue: encryptedValue,
        serviceName: credentialData.serviceName, // Update service name if provided
        updatedAt: new Date(),
      },
      create: {
        // Fields to set if creating a new record
        clerkId: clerkId,
        credentialName: credentialData.credentialName,
        encryptedValue: encryptedValue,
        serviceName: credentialData.serviceName,
      },
    });

    console.log(`Credential "${credentialData.credentialName}" saved successfully for user ${clerkId}.`);
    // 5. Return success response
    return NextResponse.json({ success: true, message: `Credential '${credentialData.credentialName}' saved.` });

  } catch (error) {
    console.error('Error saving credential to database:', error);
    // TODO: Implement more specific database error handling if needed
    return NextResponse.json({ error: 'Failed to save credential due to a server error.' }, { status: 500 });
  }
}