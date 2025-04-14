// "use server";

import { tool } from "ai";
import { z } from "zod";
import { CustomToolDefinition } from "./tool-generator";
import { isCustomToolReference, getCustomToolId } from "../tool-registry/custom-tool-ref";
import { ToolRegistry } from "../tool-registry/registry";
import { ToolFactory } from "../tool-registry/factory";
import { logger } from "@/src/lib/logger";

/**
 * Loads serializable metadata about custom tools for agent creation/storage
 * @param toolDefinitions Tool definitions to serialize
 * @param agentName The agent's name
 * @param userId The user ID
 * @returns Record of serializable tool info (no functions/complex objects)
 */
export function AGENT_TOOLS_loadCustomTools_serializable(
  toolDefinitions: CustomToolDefinition[],
  agentName: string,
  userId: string
): Record<string, any> {
  const serializableTools: Record<string, any> = {};
  
  for (const def of toolDefinitions) {
    serializableTools[def.name] = {
      name: def.name,
      description: def.description,
      parameterInfo: {
        properties: def.parameters.reduce((acc, param) => {
          acc[param.name] = {
            type: param.type,
            description: param.description,
            required: param.required !== false
          };
          return acc;
        }, {} as Record<string, any>)
      },
      isCustomTool: true,
      toolId: def.id || "pending"
    };
  }
  
  return serializableTools;
}

/**
 * Loads custom tools for execution (runtime use)
 * This should only be used server-side when the tools need to be executed
 * For agent definitions stored in the database, use tool references instead
 */
export async function AGENT_TOOLS_loadCustomTools(
  toolReferences: string[],
  agentName: string,
  userId: string
): Promise<Record<string, any>> {
  try {
    // Filter for custom tool references
    const customRefs = toolReferences.filter(ref => isCustomToolReference(ref));
    
    if (customRefs.length === 0) {
      return {};
    }
    
    // Build tools from the registry
    return await ToolFactory.loadToolsFromReferences(customRefs);
  } catch (error: any) {
    logger.error("Error loading custom tools", {
      error: error.message || "Unknown error",
      agentName
    });
    return {};
  }
}

/**
 * Registers a new custom tool definition in the registry
 * @returns A tool reference in CUSTOM_TOOL:id format
 */
export async function registerCustomTool(
  definition: CustomToolDefinition,
  agentName: string,
  userId: string
): Promise<string> {
  try {
    // Register the tool in the registry
    return await ToolRegistry.registerTool(
      definition.name,
      definition.description,
      definition.parameters,
      definition.implementation || "",
      "function",
      {
        agentId: agentName,
        userId: userId,
        source: "manual-registration",
        createdAt: new Date().toISOString()
      }
    );
  } catch (error: any) {
    logger.error("Error registering custom tool", {
      error: error.message || "Unknown error",
      toolName: definition.name,
      agentName
    });
    throw new Error(`Failed to register tool ${definition.name}: ${error.message}`);
  }
} 