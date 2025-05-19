'use server';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/src/lib/logger';
import { saveUserCredential, UserCredentialConflictError } from '@/src/lib/security/credentials'; // Assuming this function exists and handles encryption + DB storage
// import { getUserIdFromRequest } from '@/src/lib/auth'; // Placeholder for actual user auth

const saveSecretSchema = z.object({
  userId: z.string().min(1, "User ID is required."), // For now, taken from body. In prod, get from session.
  credentialName: z.string().min(1, "Credential name is required."),
  secretValue: z.string().min(1, "Secret value is required."),
});

export async function POST(request: Request) {
  logger.info('[API][UserCredentials][SaveSecret] Received request to save secret.');

  // In a real application, you would get the userId from an authenticated session/token
  // const sessionUserId = await getUserIdFromRequest(request);
  // if (!sessionUserId) {
  //   logger.warn('[API][UserCredentials][SaveSecret] Unauthorized: No session user ID.');
  //   return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  // }

  let body;
  try {
    body = await request.json();
  } catch (error) {
    logger.warn('[API][UserCredentials][SaveSecret] Invalid JSON in request body.', { error });
    return NextResponse.json({ message: "Invalid request body: Must be JSON." }, { status: 400 });
  }

  const validationResult = saveSecretSchema.safeParse(body);

  if (!validationResult.success) {
    logger.warn('[API][UserCredentials][SaveSecret] Validation failed.', { errors: validationResult.error.flatten().fieldErrors });
    return NextResponse.json(
      { 
        message: "Invalid request data.", 
        errors: validationResult.error.flatten().fieldErrors 
      },
      { status: 400 }
    );
  }

  const { userId, credentialName, secretValue } = validationResult.data;

  // // If using sessionUserId, ensure it matches the userId in the body or just use sessionUserId
  // if (sessionUserId !== userId) {
  //    logger.warn('[API][UserCredentials][SaveSecret] Mismatch between session user ID and body user ID.');
  //    return NextResponse.json({ message: "Forbidden: User ID mismatch." }, { status: 403 });
  // }

  try {
    logger.info(`[API][UserCredentials][SaveSecret] Attempting to save credential "${credentialName}" for user ID: ${userId}. (Secret value is NOT logged)`);
    
    // `saveUserCredential` is expected to handle encryption internally
    // and then store it in the database (e.g., using Prisma).
    // It should also handle upsert logic (create if not exists, update if exists).
    await saveUserCredential(userId, credentialName, secretValue);

    logger.info(`[API][UserCredentials][SaveSecret] Successfully saved credential "${credentialName}" for user ID: ${userId}.`);
    return NextResponse.json({ message: `Credential "${credentialName}" saved successfully.` }, { status: 200 });

  } catch (error: any) {
    logger.error(`[API][UserCredentials][SaveSecret] Error saving credential "${credentialName}" for user ID: ${userId}.`, { error: error.message, stack: error.stack });
    
    if (error instanceof UserCredentialConflictError) { // Assuming a custom error type for conflicts
        return NextResponse.json({ message: error.message }, { status: 409 });
    }
    // Generic error for other issues
    return NextResponse.json({ message: "Failed to save credential. Please try again." }, { status: 500 });
  }
}
