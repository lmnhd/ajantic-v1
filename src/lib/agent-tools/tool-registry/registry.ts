import { logger } from "@/src/lib/logger";
import { createCustomToolReference } from "./custom-tool-ref";
import { ToolRegistryEntry } from "./ct-types";
import { 
    CUSTOM_TOOL_registerTool,
    CUSTOM_TOOL_updateTool,
    CUSTOM_TOOL_getToolById,
    CUSTOM_TOOL_findToolByName,
    CUSTOM_TOOL_getToolsForUser,
    CUSTOM_TOOL_deleteTool,
    CUSTOM_TOOL_listAllTools
} from "./ct-actions";
import { ToolListItem } from "@/src/app/api/playground/custom-tool/types";



export const ToolRegistry = {
  /**
   * Registers a custom tool for a specific user.
   * @param userId The ID of the user owning the tool.
   * @param metadata Optional metadata (agentId is no longer required).
   * @param requiredCredentialNames Array of {name: string, label: string} for credentials.
   * @returns A tool reference in CUSTOM_TOOL:id format.
   */
  async registerTool(
    userId: string,
    name: string,
    description: string,
    parameters: any[],
    implementation: string | object,
    implementationType: string = "function",
    metadata: { [key: string]: any } = {},
    acceptedStrategyJson?: string | null,
    requiredCredentialNames?: Array<{ name: string; label: string }> | null // Temporarily commented out for arity
  ): Promise<string> {
    // When ct-actions.ts is updated, uncomment the above and the line below
    return CUSTOM_TOOL_registerTool(
      userId,
      name,
      description,
      parameters,
      implementation,
      implementationType,
      metadata,
      acceptedStrategyJson,
      requiredCredentialNames // Pass when ct-actions.ts is updated
    );
  },
  
  /**
   * Retrieves all tools for a specific user.
   * @param userId The ID of the user whose tools to list.
   * @returns An array of ToolRegistryEntry objects.
   */
  async listAllTools(userId: string): Promise<ToolRegistryEntry[]> {
    return CUSTOM_TOOL_listAllTools(userId);
  },
  
  /**
   * Updates an existing tool. User ID cannot be changed.
   * @param requiredCredentialNames Array of {name: string, label: string} for credentials.
   */
  async updateTool(
    id: string,
    updates: {
      name?: string;
      description?: string;
      parameters?: any[];
      implementation?: string | object;
      implementationType?: string;
      metadata?: { [key: string]: any };
      acceptedStrategyJson?: string | null;
      requiredCredentialNames?: Array<{ name: string; label: string }> | null; // This is correct
    }
  ): Promise<string> {
    // Ensure CUSTOM_TOOL_updateTool in ct-actions.ts handles updates.requiredCredentialNames
    return CUSTOM_TOOL_updateTool(id, updates);
  },
  
  /**
   * Retrieves a specific tool by its ID.
   */
  async getToolById(id: string): Promise<ToolRegistryEntry | null> {
    return CUSTOM_TOOL_getToolById(id);
  },
  
  /**
   * Finds a tool by name for a specific user.
   * @param name The name of the tool.
   * @param userId The ID of the user who owns the tool.
   * @returns The tool if found, or null if not found.
   */
  async findToolByName(
    name: string,
    userId: string
  ): Promise<ToolRegistryEntry | null> {
    return CUSTOM_TOOL_findToolByName(name, userId);
  },
  
  /**
   * Retrieves all tools explicitly owned by a specific user.
   * (This is functionally the same as listAllTools now).
   */
  async getToolsForUser(userId: string): Promise<ToolRegistryEntry[]> {
    return CUSTOM_TOOL_getToolsForUser(userId);
  },
  
  /**
   * Deletes a tool owned by the requesting user.
   * @param id The ID of the tool to delete.
   * @param requestingUserId The ID of the user attempting the deletion.
   */
  async deleteTool(
    id: string,
    requestingUserId: string
  ): Promise<boolean> {
    return CUSTOM_TOOL_deleteTool(id, requestingUserId);
  }
}; 