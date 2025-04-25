"use server";

import { AGENT_FORM_creator } from "@/src/lib/post-message-analysis/agent-request-form-creator"; 
import { ContextContainerProps, AgentComponentProps, ServerMessage } from "@/src/lib/types";
import { UTILS_TEAMS_infoRequestContextFormSet } from "@/src/lib/teams/lib/teams-utils";

/**
 * Server action to create an info request form and context set
 * This isolates Prisma dependencies to server-only code
 */
export async function createInfoRequestForm(
  requestMessage: string,
  contextSets: ContextContainerProps[],
  agents: AgentComponentProps[],
  teamName: string
): Promise<ContextContainerProps[]> {
  const formSchema = await AGENT_FORM_creator(requestMessage);
  const newFormSet = UTILS_TEAMS_infoRequestContextFormSet(
    formSchema, [], agents[0] ?? {}, [], false
  );
  
  // Return all context sets with the new form set added
  return [...contextSets, newFormSet];
} 