// Removed \"use server\"

// Removed: tool from 'ai'
import { z } from "zod";
import { logger } from "../../logger";
import { tool } from "ai";
import { createExecuteFunctionForLoading, getAgentToolsRegistry } from "./auto-gen-tool_core";
// Removed: logger, getAgentToolsRegistry

// Interface for tool parameter definition (Client-safe)
export interface ToolParameter {
  name: string;
  type: string;
  description: string;
  required?: boolean;
  default?: any;
}

// Interface for tool creation (Client-safe)
export interface CustomToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
  functionBody: string; // Note: Body is here but execution is server-side
  category?: string;
  
  // New fields for registry integration
  id?: string;
  implementation?: string;
  implementationType?: string;
  metadata?: {
    agentId?: string;
    userId?: string;
    [key: string]: any;
  };
  version?: number;
}

// Removed: UTILS_generateDynamicTool
// Removed: UTILS_registerDynamicTool

/**
 * Builds a zod schema from the parameter definitions (Client-safe utility)
 */
export const UTILS_buildParameterSchema = (parameters: ToolParameter[]): z.ZodObject<any> => {
  const schemaFields: Record<string, any> = {};
  
  parameters.forEach(param => {
    let fieldSchema: any;
    
    // Create the appropriate schema based on type
    switch (param.type) {
      case 'string':
        fieldSchema = z.string().describe(param.description);
        break;
      case 'number':
        fieldSchema = z.number().describe(param.description);
        break;
      case 'boolean':
        fieldSchema = z.boolean().describe(param.description);
        break;
      case 'array':
        fieldSchema = z.array(z.any()).describe(param.description);
        break;
      case 'object':
        fieldSchema = z.record(z.any()).describe(param.description);
        break;
      default:
        fieldSchema = z.any().describe(param.description);
    }
    
    // Make optional if not required
    if (!param.required) {
      fieldSchema = fieldSchema.optional();
    }
    
    // Add default value if provided
    if (param.default !== undefined && !param.required) {
      fieldSchema = fieldSchema.default(param.default);
    }
    
    schemaFields[param.name] = fieldSchema;
  });
  
  return z.object(schemaFields);
};

export const UTILS_generateDynamicTool = async (
  toolDefinition: CustomToolDefinition
): Promise<any> => {
  const { name, description, parameters, functionBody } = toolDefinition;
  
  logger.tool("Tool Generator - Generating Tool", { 
    name,
    parametersCount: parameters.length,
    functionBodyLength: functionBody.length
  });

  try {
    // Create a zod schema from the parameters
    const parameterSchema = UTILS_buildParameterSchema(parameters);
    
    // Create the tool function
    const generatedTool = tool({
      description,
      parameters: parameterSchema,
      execute: await createExecuteFunctionForLoading(functionBody, parameters)
    });
    
    logger.tool("Tool Generator - Generated Successfully", { name });
    
    return generatedTool;
  } catch (error) {
    logger.error("Tool Generator - Generation Failed", {
      name,
      error: error instanceof Error ? error.message : "Unknown error"
    });
    
    throw new Error(`Failed to generate tool: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
};

/**
 * Registers a dynamic tool with an agent
 */
export const UTILS_registerDynamicTool = async (
  agentName: string,
  toolName: string,
  toolFunction: any
): Promise<void> => {
  logger.tool("Tool Generator - Registering Tool", {
    agentName,
    toolName
  });
  
  try {
    const registry = await getAgentToolsRegistry(agentName);
    registry[toolName] = toolFunction;
    
    logger.tool("Tool Generator - Registered Successfully", {
      agentName,
      toolName
    });
  } catch (error) {
    logger.error("Tool Generator - Registration Failed", {
      agentName,
      toolName,
      error: error instanceof Error ? error.message : "Unknown error"
    });
    
    throw new Error(`Failed to register tool: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
};