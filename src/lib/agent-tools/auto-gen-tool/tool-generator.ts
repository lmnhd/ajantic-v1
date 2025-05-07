// Removed "use server"

// Removed: tool from 'ai'
import { z } from "zod";
import { logger } from "../../logger";
import { tool } from "ai";
// Removed: import { getAgentToolsRegistry } from "./auto-gen-tool_core";
// Removed: logger, getAgentToolsRegistry

// Interface for tool parameter definition (Client-safe)
export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required?: boolean;
  default?: any;
}

// Interface for tool creation (Client-safe)
export interface CustomToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
  // functionBody: string; // DEPRECATED: Use implementation instead
  category?: string;
  
  // New fields for registry integration
  id?: string;
  implementation?: string; // The primary field for the tool's code
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