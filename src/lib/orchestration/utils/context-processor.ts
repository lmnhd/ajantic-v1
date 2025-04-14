import { AgentComponentProps, ContextContainerProps } from "@/src/lib/types";
import { logger } from "@/src/lib/logger";

/**
 * Process context set updates from manager directives
 * This ensures a consistent approach to handling context updates
 */
export function processContextSetUpdates(
  contextUpdates: {
    newOrUpdate: "new" | "update";
    name: string;
    context: string;
    visibleToAgents?: "none" | "all" | string | string[];
  }[],
  currentContextSets: ContextContainerProps[],
  allAgents: AgentComponentProps[],
  teamName: string
): {
  updatedContextSets: ContextContainerProps[];
  contextSet: { teamName: string; sets: ContextContainerProps[] };
} {
  // Create a copy of the current context sets
  const updatedContextSets = [...currentContextSets];
  
  // Process each update
  for (const update of contextUpdates) {
    const { newOrUpdate, name, context, visibleToAgents } = update;
    // Convert visibleToAgents to hiddenFromAgents
    let hiddenFromAgents: string[] = [];
    const visibleTo = visibleToAgents || "all";
    
    // Handle visibility based on the provided value
    if (visibleTo === "none") {
      // If visible to none, hide from all agents
      hiddenFromAgents = allAgents.map(agent => agent.name);
    } else if (visibleTo === "all") {
      // If visible to all, hide from none
      hiddenFromAgents = [];
    } else if (Array.isArray(visibleTo)) {
      // If an array of specific agents is provided, hide from all others
      hiddenFromAgents = allAgents
        .filter(agent => !visibleTo.includes(agent.name))
        .map(agent => agent.name);
    } else {
      // Handle single agent name (string)
      hiddenFromAgents = allAgents
        .filter(agent => agent.name !== visibleTo)
        .map(agent => agent.name);
    }
    
    if (newOrUpdate === "new") {
      // Add new context set
      updatedContextSets.push({
        setName: name,
        text: context,
        lines: [],
        isDisabled: false,
        hiddenFromAgents: hiddenFromAgents
      });
      
      logger.log(`Added new context set "${name}" with visibility ${
        typeof visibleTo === 'string' ? visibleTo : JSON.stringify(visibleTo)
      }`);
    } else if (newOrUpdate === "update") {
      // Update existing context set
      const index = updatedContextSets.findIndex(cs => cs.setName === name);
      
      if (index >= 0) {
        if (context === "") {
          // Remove the context set if empty string provided
          updatedContextSets.splice(index, 1);
          logger.log(`Removed context set "${name}" (empty context provided)`);
        } else {
          // Update with new content
          updatedContextSets[index] = {
            ...updatedContextSets[index],
            text: context,
            hiddenFromAgents: hiddenFromAgents
          };
          
          logger.log(`Updated context set "${name}" with visibility ${
            visibleTo ? (typeof visibleTo === 'string' ? visibleTo : JSON.stringify(visibleTo)) : "unchanged"
          }`);
        }
      } else {
        // Context set doesn't exist, create it
        logger.log(`Context set "${name}" doesn't exist, creating it`);
        
        // Create context set
        updatedContextSets.push({
          setName: name,
          text: context,
          lines: [],
          isDisabled: false,
          hiddenFromAgents: hiddenFromAgents
        });
        
        logger.log(`Created new context set "${name}" with visibility ${
          typeof visibleTo === 'string' ? visibleTo : JSON.stringify(visibleTo)
        }`);
      }
    }
  }
  
  // Return updated context and formatted for UI
  return {
    updatedContextSets,
    contextSet: {
      teamName,
      sets: updatedContextSets
    }
  };
}

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
  const { ORCHESTRATION_infoRequestToContextFormSet } = await import("../modes/manager-directed");
  
  // Create form-based context set
  const updatedContextSets = await ORCHESTRATION_infoRequestToContextFormSet(
    message,
    contextSets,
    agent,
    history
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
