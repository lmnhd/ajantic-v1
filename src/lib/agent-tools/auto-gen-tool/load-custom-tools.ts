// "use server";

import { tool } from "ai";
import { z } from "zod";
import { logger } from "@/src/lib/logger";
import { SERVER_storeGeneralPurposeData } from "@/src/lib/server-actions";
import { ToolParameter, CustomToolDefinition } from "./tool-generator";

/**
 * Loads multiple predefined tools at once
 * 
 * This function takes an array of tool schemas and returns all ready-to-use tools
 * that can be added directly to the agent's toolset during loading
 */
export const AGENT_TOOLS_loadCustomTools = (
  toolSchemas: CustomToolDefinition[],
  agentName: string,
  userId: string
): Record<string, any> => {
  logger.tool("Loading Multiple Predefined Tools", {
    agentName,
    toolCount: toolSchemas.length
  });
  
  const tools: Record<string, any> = {};
  
  toolSchemas.forEach(schema => {
    try {
      const generatedTool = AGENT_TOOLS_customToolWrapper(schema, agentName, userId);
      Object.assign(tools, generatedTool);
    } catch (error) {
      logger.error("Error loading predefined tool", {
        name: schema.name,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  
  return tools;
};

/**
 * Loads a predefined tool during agent initialization
 * 
 * This function takes a tool schema and returns a ready-to-use tool
 * that can be added directly to the agent's toolset during loading
 */
export const AGENT_TOOLS_customToolWrapper = (
  toolSchema: CustomToolDefinition,
  agentName: string,
  userId: string
): Record<string, any> => {
  const { name, description, parameters, functionBody, category } = toolSchema;
  
  logger.tool("Loading Predefined Tool", {
    agentName,
    toolName: name,
    parameters: parameters.length
  });
  
  try {
    // Create a zod schema from the parameters
    const parameterSchema = buildParameterSchema(parameters);
    
    // Create the tool function
    const generatedTool = {
      [name]: tool({
        description,
        parameters: parameterSchema,
        execute: createExecuteFunction(functionBody, parameters)
      })
    };
    
    // Optionally store for future reference
    SERVER_storeGeneralPurposeData(
      JSON.stringify(toolSchema),
      name,
      description,
      "",
      `LOADED_TOOLS_${agentName}_${userId}`,
      true
    ).catch(err => {
      logger.error("Error storing predefined tool definition", {
        name,
        error: err instanceof Error ? err.message : "Unknown error"
      });
    });
    
    logger.tool("Predefined Tool Loaded Successfully", { name });
    
    return generatedTool;
  } catch (error) {
    logger.error("Failed to load predefined tool", {
      name,
      error: error instanceof Error ? error.message : "Unknown error"
    });
    
    // Return empty object on failure to prevent crashing
    return {};
  }
};

/**
 * Builds a zod schema from the parameter definitions
 */
const buildParameterSchema = (parameters: ToolParameter[]): z.ZodObject<any> => {
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

/**
 * Creates an execute function for the tool
 */
const createExecuteFunction = (functionBody: string, parameters: ToolParameter[]) => {
  return async (args: any) => {
    try {
      // Apply default values for any missing optional parameters
      parameters
        .filter(param => !param.required && param.default !== undefined)
        .forEach(param => {
          if (args[param.name] === undefined) {
            args[param.name] = param.default;
          }
        });
        
      // Create the function from the provided code
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const paramNames = parameters.map(p => p.name);
      const paramValues = parameters.map(p => args[p.name]);
      
      const func = new AsyncFunction(...paramNames, functionBody);
      const result = await func(...paramValues);
      
      return result;
    } catch (error) {
      logger.error("Tool Execution Error", {
        error: error instanceof Error ? error.message : "Unknown error"
      });
      
      return {
        error: true,
        message: error instanceof Error ? error.message : "Function execution failed",
        stack: error instanceof Error ? error.stack : undefined
      };
    }
  };
}; 