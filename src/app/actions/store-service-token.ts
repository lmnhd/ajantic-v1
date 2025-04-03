"use server";

import { SERVER_storeGeneralPurposeData } from "@/src/lib/server-actions";
import { DYNAMIC_NAMES } from "@/src/lib/dynamic-names";

export async function storeServiceTokens(
  tokens: {
    userId: string;
    provider: string;
    accessToken: string;
    expiresAt: number;
  },
  userId: string,
  platform: string
) {
  console.log("storeServiceTokens: userId:", userId, "platform:", platform);
  if (!userId) {
    console.error("storeServiceTokens: userId is undefined");
    return { success: false };
  }
  const _updatedTokens = JSON.stringify({
    ...tokens,
    clientId: process.env.GOOGLE_ID!,
    clientSecret: process.env.GOOGLE_SECRET!,
  });
  try {
    console.log("Storing tokens for user:", userId);
    const tokenKey = `oauth::${platform}::${userId}`;

    const fullNameSpace = await DYNAMIC_NAMES.service_tokens(userId, platform);
    

    await SERVER_storeGeneralPurposeData(
      _updatedTokens,
      platform,
      userId,
      tokenKey,
      fullNameSpace,
      false

    );
    console.log("Tokens stored successfully");
    return { success: true };
  } catch (error) {
    console.error("Failed to store tokens:", error);
    throw new Error("Failed to store tokens");
  }
}