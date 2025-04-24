"use server";
import { db } from "../../db";
import { logger } from "../../logger";
import { createCustomToolReference } from "./custom-tool-ref";
import { ToolRegistryEntry } from "./ct-types";

export async function CUSTOM_TOOL_registerTool(name: string, description: string, parameters: any[],implementation: string, implementationType: string, metadata:{ agentId: string; userId: string; [key: string]: any } ) {
    try {
        const tool = await db.customTool.create({
          data: {
            name,
            description,
            parameters: JSON.stringify(parameters),
            implementation,
            implementationType,
            metadata: JSON.stringify(metadata),
            version: 1
          }
        });
        
        logger.tool("Registered new tool in registry", {
          toolId: tool.id,
          toolName: name,
          agentId: metadata.agentId
        });
        
        // Return reference in CUSTOM_TOOL:id format
        return createCustomToolReference(tool.id);
    } catch (error) {
        logger.error("Failed to register tool", { name, error });
        throw new Error(`Failed to register tool ${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export async function CUSTOM_TOOL_updateTool(
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
    try {
        // Get current tool
        const currentTool = await db.customTool.findUnique({ where: { id } });
        if (!currentTool) {
          throw new Error(`Tool with ID ${id} not found`);
        }
        
        // Update with new values or keep existing ones
        const updatedTool = await db.customTool.update({
          where: { id },
          data: {
            name: updates.name || currentTool.name,
            description: updates.description || currentTool.description,
            parameters: updates.parameters 
              ? JSON.stringify(updates.parameters) 
              : currentTool.parameters,
            implementation: updates.implementation || currentTool.implementation,
            implementationType: updates.implementationType || currentTool.implementationType,
            metadata: updates.metadata 
              ? JSON.stringify({
                  ...JSON.parse(currentTool.metadata),
                  ...updates.metadata,
                  updatedAt: new Date().toISOString()
                })
              : currentTool.metadata,
            version: currentTool.version + 1
          }
        });
        
        logger.tool("Updated tool in registry", {
          toolId: id,
          toolName: updatedTool.name,
          version: updatedTool.version
        });
        
        // Return reference in CUSTOM_TOOL:id format
        return createCustomToolReference(id);
      } catch (error) {
        logger.error("Failed to update tool", { id, error });
        throw new Error(`Failed to update tool ${id}: ${error instanceof Error ? error.message : String(error)}`);
      }
}

export async function CUSTOM_TOOL_getToolById(id: string): Promise<ToolRegistryEntry | null> {
    try {
        const tool = await db.customTool.findUnique({ where: { id } });
        return tool;
      } catch (error) {
        logger.error("Failed to retrieve tool by ID", { id, error });
        return null;
      }
}

export async function CUSTOM_TOOL_findToolByName(name: string, userId?: string): Promise<ToolRegistryEntry | null> {
    try {
        if (userId) {
          // Search for tools with the specific name and userId
          const tools = await db.customTool.findMany({
            where: {
              name: name,
              metadata: {
                contains: `"userId":"${userId}"`
              }
            }
          });
          
          // Return the first matching tool if any found
          return tools.length > 0 ? tools[0] : null;
        } else {
          // Just search by name if no userId provided
          const tools = await db.customTool.findMany({
            where: {
              name: name
            }
          });
          
          return tools.length > 0 ? tools[0] : null;
        }
      } catch (error) {
        logger.error("Failed to find tool by name", { name, userId, error });
        return null;
      }
}

export async function CUSTOM_TOOL_getToolsForAgent(agentId: string): Promise<ToolRegistryEntry[]> {
    try {
        // Search for tools with this agent ID in metadata
        const tools = await db.customTool.findMany({
          where: {
            metadata: {
                contains: `"agentId":"${agentId}"`
            }
          }
        });
        
        return tools;
      } catch (error) {
        logger.error("Failed to retrieve tools for agent", { agentId, error });
        return [];
      }
}

export async function CUSTOM_TOOL_getToolsForUser(userId: string): Promise<ToolRegistryEntry[]> {
    try {
        // Search for tools with this user ID in metadata
        const tools = await db.customTool.findMany({
          where: {
            metadata: {
                contains: `"userId":"${userId}"`
            }
          }
        });
        
        return tools;
      } catch (error) {
        logger.error("Failed to retrieve tools for user", { userId, error });
        return [];
      }
}

export async function CUSTOM_TOOL_deleteTool(id: string): Promise<boolean> {
    try {
        await db.customTool.delete({ where: { id } });
        logger.tool("Deleted tool from registry", { toolId: id });
        return true;
      } catch (error) {
        logger.error("Failed to delete tool", { id, error });
        return false;
      }
}
