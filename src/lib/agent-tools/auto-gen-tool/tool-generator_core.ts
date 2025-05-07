'use server';

import { tool } from "ai";
import { z } from "zod";
import { logger } from "@/src/lib/logger";
import { 
    ToolParameter, 
    CustomToolDefinition, 
    UTILS_buildParameterSchema // Import schema builder
} from "./tool-generator";

/**
 * Creates an execute function for the tool (Server-Side)
 */
const CORE_createExecuteFunction = (functionBody: string, parameters: ToolParameter[]) => {
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
      // Ensure paramNames/Values align correctly if args might have extra properties
      const paramNames = parameters.map(p => p.name);
      const paramValues = paramNames.map(name => args[name]);
            
      const func = new AsyncFunction(...paramNames, functionBody);
      const result = await func(...paramValues);
      
      return result;
    } catch (error) {
      logger.error("Tool Execute Core - Execution Error", {
        error: error instanceof Error ? error.message : "Unknown error"
      });
      
      // Return a structured error object
      return {
        _isToolError: true, // Flag to identify tool errors
        error: error instanceof Error ? error.message : "Function execution failed",
        stack: error instanceof Error ? error.stack : undefined
      };
    }
  };
};

/**
 * Generates a dynamic tool based on provided definition (Server-Side)
 */
export const CORE_generateDynamicTool = async (
  toolDefinition: CustomToolDefinition
): Promise<any> => {
  const { name, description, parameters, implementation } = toolDefinition;
  
  logger.tool("Tool Generator Core - Generating Tool", { 
    name,
    parametersCount: parameters.length,
    implementationLength: implementation?.length
  });

  try {
    // Build the schema using the imported utility
    const parameterSchema = UTILS_buildParameterSchema(parameters);
    
    // Create the tool function
    const generatedTool = tool({
      description,
      parameters: parameterSchema,
      execute: CORE_createExecuteFunction(implementation ?? "", parameters) // Use core execute creator
    });
    
    logger.tool("Tool Generator Core - Generated Successfully", { name });
    
    return generatedTool;
  } catch (error) {
    logger.error("Tool Generator Core - Generation Failed", {
      name,
      error: error instanceof Error ? error.message : "Unknown error"
    });
    
    throw new Error(`Failed to generate tool: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}; 