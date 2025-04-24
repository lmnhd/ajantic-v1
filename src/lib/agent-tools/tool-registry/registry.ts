import { logger } from "@/src/lib/logger";
import { createCustomToolReference } from "./custom-tool-ref";
import { ToolRegistryEntry } from "./ct-types";
import { 
    CUSTOM_TOOL_registerTool,
    CUSTOM_TOOL_updateTool,
    CUSTOM_TOOL_getToolById,
    CUSTOM_TOOL_findToolByName,
    CUSTOM_TOOL_getToolsForAgent,
    CUSTOM_TOOL_getToolsForUser,
    CUSTOM_TOOL_deleteTool
} from "./ct-actions";



export const ToolRegistry = {
  /**
   * Registers a custom tool in the registry
   * @returns A tool reference in CUSTOM_TOOL:id format
   */
  async registerTool(
    name: string,
    description: string,
    parameters: any[],
    implementation: string,
    implementationType: string = "function",
    metadata: { agentId: string; userId: string; [key: string]: any }
  ): Promise<string> {
   return CUSTOM_TOOL_registerTool(name, description, parameters, implementation, implementationType, metadata);
  },
  
  /**
   * Updates an existing tool in the registry
   */
  async updateTool(
    id: string,
    updates: {
      name?: string;
      description?: string;
      parameters?: any[];
      implementation?: string;
      implementationType?: string;
      metadata?: { [key: string]: any };
    }
  ): Promise<string> {
    return CUSTOM_TOOL_updateTool(id, updates);
  },
  
  /**
   * Retrieves a tool from the registry by ID
   */
  async getToolById(id: string): Promise<ToolRegistryEntry | null> {
    return CUSTOM_TOOL_getToolById(id);
  },
  
  /**
   * Finds a tool by name and optionally filtered by userId
   * @returns The tool if found, or null if not found
   */
  async findToolByName(name: string, userId?: string): Promise<ToolRegistryEntry | null> {
    return CUSTOM_TOOL_findToolByName(name, userId);
  },
  
  /**
   * Retrieves all tools for a specific agent
   */
  async getToolsForAgent(agentId: string): Promise<ToolRegistryEntry[]> {
    return CUSTOM_TOOL_getToolsForAgent(agentId);
  },
  
  /**
   * Retrieves all tools for a specific user
   */
  async getToolsForUser(userId: string): Promise<ToolRegistryEntry[]> {
    return CUSTOM_TOOL_getToolsForUser(userId);
  },
  
  /**
   * Deletes a tool from the registry
   */
  async deleteTool(id: string): Promise<boolean> {
    return CUSTOM_TOOL_deleteTool(id);
  }
}; 