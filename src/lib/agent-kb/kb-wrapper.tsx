"use server"

import { fetchKnowledgeBaseEntries } from "@/src/app/api/kb-entries/[id]";
import { KnowledgeBaseEntry } from "./types";

export async function getKnowledgeBaseEntries(userId: string, agentName: string) {
  const kbId = `agent-kb-${userId}-${agentName}`;
  return await fetchKnowledgeBaseEntries(kbId);
}