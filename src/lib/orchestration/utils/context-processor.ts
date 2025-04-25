import { AgentComponentProps, ContextContainerProps } from "@/src/lib/types";
import { logger } from "@/src/lib/logger";

/**
 * Process form-based context updates
 */
export async function processInfoRequestContextForm(
  message: string,
  contextSets: ContextContainerProps[],
  agent: AgentComponentProps,
  history: any[],
  teamName: string
): Promise<{
  updatedContextSets: ContextContainerProps[];
  contextSet: { teamName: string; sets: ContextContainerProps[] };
}> {
  // Import the function dynamically to avoid circular dependencies
  const { ORCHESTRATION_infoRequestToContextFormSet } = await import("../modes/workflow-helpers");
  
  // Create form-based context set
  const updatedContextSets = await ORCHESTRATION_infoRequestToContextFormSet(
    message,
    contextSets,
    agent,
    ""
  );
  
  // Return both formats
  return {
    updatedContextSets,
    contextSet: {
      teamName,
      sets: updatedContextSets
    }
  };
}
