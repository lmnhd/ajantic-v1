'use server';

import { tool } from "ai";
import { z } from "zod";
import { logger } from "@/src/lib/logger";
import { getAgentToolsRegistry } from "./auto-gen-tool_core"; // Corrected import
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
  const { name, description, parameters, functionBody } = toolDefinition;
  
  logger.tool("Tool Generator Core - Generating Tool", { 
    name,
    parametersCount: parameters.length,
    functionBodyLength: functionBody.length
  });

  try {
    // Build the schema using the imported utility
    const parameterSchema = UTILS_buildParameterSchema(parameters);
    
    // Create the tool function
    const generatedTool = tool({
      description,
      parameters: parameterSchema,
      execute: CORE_createExecuteFunction(functionBody, parameters) // Use core execute creator
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

/**
 * Registers a dynamic tool with an agent (Server-Side)
 */
export const CORE_registerDynamicTool = async (
  agentName: string,
  toolName: string,
  toolFunction: any // The actual generated tool object
): Promise<void> => {
  logger.tool("Tool Generator Core - Registering Tool", {
    agentName,
    toolName
  });
  
  try {
    // Access the registry via the function imported from auto-gen-tool_core
    const registry = await getAgentToolsRegistry(agentName);
    registry[toolName] = toolFunction;
    
    logger.tool("Tool Generator Core - Registered Successfully", {
      agentName,
      toolName
    });
  } catch (error) {
    logger.error("Tool Generator Core - Registration Failed", {
      agentName,
      toolName,
      error: error instanceof Error ? error.message : "Unknown error"
    });
    
    throw new Error(`Failed to register tool: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}; 