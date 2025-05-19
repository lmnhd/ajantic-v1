'use server';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/src/lib/logger';
import { db as prisma } from '@/src/lib/db'; // Your Prisma client
// import { getUserIdFromRequest } from '@/src/lib/auth'; // Placeholder for actual user auth

const checkExistenceSchema = z.object({
  // userId will eventually come from session/auth
  userId: z.string().min(1, "User ID is required."),
  credentialNames: z.array(z.string().min(1)).min(1, "At least one credential name is required."),
});

export async function POST(request: Request) {
  logger.info('[API][UserCredentials][CheckExistence] Received request.');

  // TODO: Get userId from authenticated session
  // const sessionUserId = await getUserIdFromRequest(request);
  // if (!sessionUserId) {
  //   logger.warn('[API][UserCredentials][CheckExistence] Unauthorized: No session user ID.');
  //   return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  // }

  let body;
  try {
    body = await request.json();
  } catch (error) {
    logger.warn('[API][UserCredentials][CheckExistence] Invalid JSON in request body.', { error });
    return NextResponse.json({ message: "Invalid request body: Must be JSON." }, { status: 400 });
  }

  const validationResult = checkExistenceSchema.safeParse(body);

  if (!validationResult.success) {
    logger.warn('[API][UserCredentials][CheckExistence] Validation failed.', { errors: validationResult.error.flatten().fieldErrors });
    return NextResponse.json(
      {
        message: "Invalid request data.",
        errors: validationResult.error.flatten().fieldErrors
      },
      { status: 400 }
    );
  }

  const { userId, credentialNames } = validationResult.data;

  // Ensure userId from body matches sessionUserId if using sessions
  // if (sessionUserId !== userId) {
  //   logger.warn('[API][UserCredentials][CheckExistence] Mismatch between session user ID and body user ID.');
  //   return NextResponse.json({ message: "Forbidden: User ID mismatch." }, { status: 403 });
  // }

  try {
    const existingCredentials = await prisma.userCredential.findMany({
      where: {
        clerkId: userId, // Assuming userId from frontend is the clerkId
        credentialName: {
          in: credentialNames,
        },
      },
      select: {
        credentialName: true, // Only need the name to confirm existence
      },
    });

    const existingNames = existingCredentials.map(cred => cred.credentialName);
    
    // Return a map of credentialName -> boolean (exists)
    const result: Record<string, boolean> = {};
    credentialNames.forEach(name => {
      result[name] = existingNames.includes(name);
    });

    logger.info(`[API][UserCredentials][CheckExistence] Checked credentials for user ${userId}. Found: ${existingNames.join(', ')}`);
    return NextResponse.json(result, { status: 200 });

  } catch (error: any) {
    logger.error(`[API][UserCredentials][CheckExistence] Error checking credential existence for user ${userId}.`, { error: error.message, stack: error.stack });
    return NextResponse.json({ message: "Failed to check credential existence." }, { status: 500 });
  }
}
