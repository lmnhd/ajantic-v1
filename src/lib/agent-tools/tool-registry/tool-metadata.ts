"use server";

import { ToolRegistry } from "./registry";
import { getCustomToolId, isCustomToolReference } from "./custom-tool-ref";

/**
 * Server action to fetch custom tool names for display in the UI
 */
export async function fetchCustomToolNames(toolRefs: string[]): Promise<Record<string, string>> {
  try {
    // Filter only valid custom tool references
    const customToolRefs = toolRefs.filter(ref => 
      typeof ref === 'string' && isCustomToolReference(ref)
    );
    
    if (customToolRefs.length === 0) {
      return {};
    }
    
    const result: Record<string, string> = {};
    
    // Fetch each tool's name
    for (const ref of customToolRefs) {
      try {
        const toolId = getCustomToolId(ref);
        const tool = await ToolRegistry.getToolById(toolId);
        
        if (tool) {
          result[ref] = tool.name;
        }
      } catch (error) {
        console.error(`Error fetching tool name for ${ref}`, error);
      }
    }
    
    return result;
  } catch (error) {
    console.error("Error fetching custom tool names:", error);
    return {};
  }
} 