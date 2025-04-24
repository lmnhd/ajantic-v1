"use server";

import { AGENT_FORM_creator } from "@/src/lib/post-message-analysis/agent-request-form-creator"; 
import { ContextContainerProps, AgentComponentProps, ServerMessage } from "@/src/lib/types";
import { UTILS_TEAMS_infoRequestContextFormSet } from "@/src/lib/teams/lib/teams-utils";

/**
 * Server action to create an info request form and context set
 * This isolates Prisma dependencies to server-only code
 */
export async function createInfoRequestForm(
  currentMessage: string, 
  contextSets: ContextContainerProps[], 
  currentAgent: AgentComponentProps, 
  messageHistory: ServerMessage[]
) {
  const formSchema = await AGENT_FORM_creator(currentMessage);
  const tempCTX = [...contextSets, UTILS_TEAMS_infoRequestContextFormSet(
    formSchema, [], currentAgent ?? {}, messageHistory ?? [], false
  )];
  
  return tempCTX;
} 