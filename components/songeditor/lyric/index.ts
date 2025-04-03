"use server";

import { processLineOrGroup } from "@/src/lib/server-actions";
import {
  AISessionState,
  AppState,
  GlobalMessages,
  ProcessType,
} from "@/src/lib/types";

export async function handleProcessLineOrGroup({
  globalMessages
}: {
  globalMessages: GlobalMessages;
}) {
  
  console.log("HANDLE PROCESS LINE OR GROUP: ", globalMessages.currentState.resultData);
  console.log("?????")
  // UPDATE MESSAGE ARRAY...
  const resultobj = await processLineOrGroup()
  return resultobj;
 // return {globalMessages: globalMessages};
}


