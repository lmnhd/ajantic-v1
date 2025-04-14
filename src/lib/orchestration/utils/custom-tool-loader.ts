import { ToolRegistry } from "@/src/lib/agent-tools/tool-registry/registry";
import { ToolFactory } from "@/src/lib/agent-tools/tool-registry/factory";
import { isCustomToolReference, getCustomToolId } from "@/src/lib/agent-tools/tool-registry/custom-tool-ref";
import { logger } from "@/src/lib/logger";

/**
 * Loads custom tools from the registry for use in orchestration
 * @param agentName The name of the agent
 * @param toolNames Array of tool references (including custom:id references)
 * @param userId The user ID for logging
 * @returns Object containing the loaded custom tools
 */
export async function loadCustomToolsForOrchestration(
  agentName: string,
  toolNames: (string | undefined)[],
  userId: string
): Promise<Record<string, any>> {
  try {
    const customTools: Record<string, any> = {};
    
    // Filter for custom tool references
    const customToolRefs = (toolNames || [])
      .filter(Boolean)
      .filter(name => isCustomToolReference(name as string));
    
    if (customToolRefs.length === 0) {
      return customTools;
    }
    
    logger.tool("Loading custom tools for orchestration", {
      agentName,
      customToolCount: customToolRefs.length
    });
    
    // Process each custom tool reference
    for (const ref of customToolRefs) {
      try {
        const toolId = getCustomToolId(ref as string);
        const toolEntry = await ToolRegistry.getToolById(toolId);
        
        if (!toolEntry) {
          logger.warn(`Custom tool not found: ${toolId}`, { agentName });
          continue;
        }
        
        // Build the tool
        const toolObj = ToolFactory.buildTool(toolEntry);
        Object.assign(customTools, toolObj);
      } catch (error) {
        logger.error(`Error loading custom tool ${ref}`, { error, agentName });
      }
    }
    
    return customTools;
  } catch (error) {
    logger.error("Error in loadCustomToolsForOrchestration", { error, agentName });
    return {};
  }
} 