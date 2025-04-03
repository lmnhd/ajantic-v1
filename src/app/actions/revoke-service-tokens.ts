"use server";

import { DYNAMIC_NAMES } from "@/src/lib/dynamic-names";
import { SERVER_deleteGeneralPurposeData, SERVER_getGeneralPurposeDataSingle } from "@/src/lib/server";


export async function revokeServiceTokens(platform: string, userId: string) {
  try {
    const fullNameSpace = await DYNAMIC_NAMES.service_tokens(userId, platform);
    const _id = await SERVER_getGeneralPurposeDataSingle(fullNameSpace);
    await SERVER_deleteGeneralPurposeData(_id.id);
    return { success: true };


  } catch (error) {
    console.error("Failed to revoke service tokens:", error);
    return { success: false };
  }
} 