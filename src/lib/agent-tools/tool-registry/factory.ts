import { tool } from "ai";
import { z } from "zod";
import { ToolRegistry, ToolRegistryEntry } from "./registry";
import { logger } from "@/src/lib/logger";
import { getCustomToolId, isCustomToolReference } from "./custom-tool-ref";

export const ToolFactory = {
  /**
   * Creates a zod schema from parameter definitions
   */
  createParameterSchema(parameters: any[]): z.ZodObject<any> {
    try {
      const schemaObj: Record<string, z.ZodTypeAny> = {};
      
      for (const param of parameters) {
        switch (param.type) {
          case "string":
            schemaObj[param.name] = param.required !== false ? 
              z.string().describe(param.description) : 
              z.string().optional().describe(param.description);
            break;
          case "number":
            schemaObj[param.name] = param.required !== false ? 
              z.number().describe(param.description) : 
              z.number().optional().describe(param.description);
            break;
          case "boolean":
            schemaObj[param.name] = param.required !== false ? 
              z.boolean().describe(param.description) : 
              z.boolean().optional().describe(param.description);
            break;
          case "array":
            schemaObj[param.name] = param.required !== false ? 
              z.array(z.any()).describe(param.description) : 
              z.array(z.any()).optional().describe(param.description);
            break;
          case "object":
            schemaObj[param.name] = param.required !== false ? 
              z.record(z.any()).describe(param.description) : 
              z.record(z.any()).optional().describe(param.description);
            break;
          default:
            schemaObj[param.name] = param.required !== false ? 
              z.any().describe(param.description) : 
              z.any().optional().describe(param.description);
        }
      }
      
      return z.object(schemaObj);
    } catch (error) {
      logger.error("Error creating parameter schema", { error });
      // Return an empty schema as fallback
      return z.object({});
    }
  },
  
  /**
   * Creates an execute function for a tool
   */
  createExecuteFunction(toolEntry: ToolRegistryEntry) {
    return async function execute(params: any) {
      try {
        logger.tool(`Executing tool ${toolEntry.name}`, { 
          toolId: toolEntry.id,
          params 
        });
        
        switch (toolEntry.implementationType) {
          case "function":
            // Execute code using Function constructor (safer than eval)
            // eslint-disable-next-line no-new-func
            const fn = new Function('params', `
              return (async () => {
                try {
                  ${toolEntry.implementation}
                  return "No explicit return value from function";
                } catch (error) {
                  return "Error: " + error.message;
                }
              })();
            `);
            
            return await fn(params);
            
          case "api":
            // Call an external API
            const endpoint = (toolEntry.implementation || "").startsWith("{") 
              ? JSON.parse(toolEntry.implementation).endpoint 
              : toolEntry.implementation;
              
            if (!endpoint) {
              throw new Error("No API endpoint specified for tool");
            }
            
            const response = await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(params)
            });
            
            return await response.text();
            
          case "dynamic-script":
            // Call to a dynamic script system if implemented
            return `Dynamic script execution not yet implemented for tool ${toolEntry.name}`;
            
          default:
            return `Unsupported tool implementation type: ${toolEntry.implementationType}`;
        }
      } catch (error) {
        logger.error(`Error executing tool ${toolEntry.name}`, { 
          error,
          toolId: toolEntry.id
        });
        return `Error executing tool: ${error instanceof Error ? error.message : String(error)}`;
      }
    };
  },
  
  /**
   * Builds a tool object from a registry entry
   */
  buildTool(toolEntry: ToolRegistryEntry): Record<string, any> {
    try {
      const parameters = JSON.parse(toolEntry.parameters);
      const paramSchema = this.createParameterSchema(parameters);
      const executeFunc = this.createExecuteFunction(toolEntry);
      
      return {
        [toolEntry.name]: tool({
          description: toolEntry.description,
          parameters: paramSchema,
          execute: executeFunc
        })
      };
    } catch (error) {
      logger.error(`Failed to build tool ${toolEntry.name}`, { 
        error,
        toolId: toolEntry.id 
      });
      return {};
    }
  },
  
  /**
   * Creates a serializable representation of a tool for storage
   */
  createSerializableTool(toolEntry: ToolRegistryEntry): Record<string, any> {
    try {
      return {
        name: toolEntry.name,
        description: toolEntry.description,
        parameterInfo: {
          type: "object",
          properties: JSON.parse(toolEntry.parameters).reduce((acc: any, param: any) => {
            acc[param.name] = {
              type: param.type,
              description: param.description
            };
            return acc;
          }, {}),
        },
        toolId: toolEntry.id,
        implementationType: toolEntry.implementationType
      };
    } catch (error) {
      logger.error(`Failed to create serializable tool ${toolEntry.name}`, { 
        error,
        toolId: toolEntry.id 
      });
      return {
        name: toolEntry.name,
        description: toolEntry.description,
        error: "Failed to serialize tool"
      };
    }
  },
  
  /**
   * Builds tools from an array of registry entries
   */
  buildTools(toolEntries: ToolRegistryEntry[]): Record<string, any> {
    const tools: Record<string, any> = {};
    
    for (const entry of toolEntries) {
      try {
        const tool = this.buildTool(entry);
        Object.assign(tools, tool);
      } catch (error) {
        logger.error(`Error building tool ${entry.name}`, { error });
      }
    }
    
    return tools;
  },
  
  /**
   * Loads tools from references
   */
  async loadToolsFromReferences(toolRefs: string[]): Promise<Record<string, any>> {
    const tools: Record<string, any> = {};
    
    for (const ref of toolRefs) {
      try {
        if (!isCustomToolReference(ref)) {
          continue; // Skip non-custom tool references
        }
        
        const toolId = getCustomToolId(ref);
        const toolEntry = await ToolRegistry.getToolById(toolId);
        
        if (toolEntry) {
          const tool = this.buildTool(toolEntry);
          Object.assign(tools, tool);
        }
      } catch (error) {
        logger.error(`Error loading tool from reference ${ref}`, { error });
      }
    }
    
    return tools;
  }
}; 