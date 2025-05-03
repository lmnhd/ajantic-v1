import { tool } from "ai";
import { z } from "zod";
import { ToolRegistry } from "./registry";
import { logger } from "@/src/lib/logger";
import { getCustomToolId, isCustomToolReference } from "./custom-tool-ref";
import { ToolRegistryEntry } from "./ct-types";
import { validateImplementationString } from "./ct-utils";

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
    const validation = validateImplementationString(toolEntry.implementation);
    if (!validation.isValid) {
        logger.error(`ToolFactory: Invalid implementation structure for tool ${toolEntry.name}`, { toolId: toolEntry.id, validationError: validation.error });
        return async function invalidExecute(params: any) {
            return {
                 _isToolError: true,
                 success: false,
                 error: `Tool Configuration Error: ${validation.error}`
            };
        }
    }

    return async function execute(params: any) {
      try {
        logger.tool(`Executing tool ${toolEntry.name}`, {
          toolId: toolEntry.id,
        });
        
        switch (toolEntry.implementationType) {
          case "function":
            try {
                const funcDefinition = toolEntry.implementation;
                const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
                const funcExecutor = new AsyncFunction('params', `return (${funcDefinition})(params);`);

                return await funcExecutor(params);
            } catch (execError) {
                 logger.error(`ToolFactory: Error executing function implementation for ${toolEntry.name}`, { error: execError, toolId: toolEntry.id });
                 return {
                     _isToolError: true,
                     success: false,
                     error: `Tool Execution Error: ${execError instanceof Error ? execError.message : String(execError)}`
                 };
            }
            
          case "api":
            const endpoint = (toolEntry.implementation || "").startsWith("{") 
              ? JSON.parse(toolEntry.implementation || "{}").endpoint || ""
              : toolEntry.implementation || "";
              
            if (!endpoint) {
              throw new Error("No API endpoint specified for tool");
            }
            
            logger.tool(`Calling API for tool ${toolEntry.name}`, { toolId: toolEntry.id });
            const response = await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(params)
            });
            const apiResult = await response.text();
            logger.tool(`Tool ${toolEntry.name} API result status: ${response.status}`, { toolId: toolEntry.id });

            if (!response.ok) throw new Error(`API call failed with status ${response.status}: ${apiResult}`);
            
             try {
                if(response.headers.get('content-type')?.includes('application/json')) {
                    return JSON.parse(apiResult);
                }
             } catch (parseError) {
                 logger.warn(`ToolFactory: API for ${toolEntry.name} returned non-JSON response despite content-type`, { toolId: toolEntry.id, status: response.status });
             }
            return apiResult;
            
          case "dynamic-script":
            logger.warn(`ToolFactory: Dynamic script execution not implemented for tool ${toolEntry.name}`, { toolId: toolEntry.id });
            return `Dynamic script execution not yet implemented for tool ${toolEntry.name}`;
            
          default:
            logger.error(`ToolFactory: Unsupported implementation type: ${toolEntry.implementationType}`, { toolId: toolEntry.id });
            return `Unsupported tool implementation type: ${toolEntry.implementationType}`;
        }
      } catch (outerError) {
        logger.error(`ToolFactory: Error executing tool ${toolEntry.name} (outer catch)`, {
          error: outerError,
          toolId: toolEntry.id
        });
        return {
            _isToolError: true,
            success: false,
            error: `Error executing tool: ${outerError instanceof Error ? outerError.message : String(outerError)}`
        };
      }
    };
  },
  
  /**
   * Builds a tool object from a registry entry
   */
  buildTool(toolEntry: ToolRegistryEntry): Record<string, any> {
    try {
      let parametersArray: any[] = [];
      if (toolEntry.parameters && typeof toolEntry.parameters === 'string') {
          try {
              parametersArray = JSON.parse(toolEntry.parameters);
              if (!Array.isArray(parametersArray)) {
                 logger.warn(`Parsed parameters for tool ${toolEntry.name} (ID: ${toolEntry.id}) was not an array. Defaulting to empty.`, { parsed: parametersArray });
                 parametersArray = [];
              }
          } catch (e) {
              logger.error(`Failed to parse parameters JSON for tool ${toolEntry.name} (ID: ${toolEntry.id})`, { error: e, paramsString: toolEntry.parameters });
              parametersArray = [];
          }
      } else {
           logger.warn(`Parameters field for tool ${toolEntry.name} (ID: ${toolEntry.id}) is missing or not a string. Assuming no parameters.`, { parameters: toolEntry.parameters });
           parametersArray = [];
      }
      
      const paramSchema = this.createParameterSchema(parametersArray);
      const executeFunc = this.createExecuteFunction(toolEntry);
      
      return {
        [toolEntry.name]: tool({
          description: toolEntry.description || "No description provided.",
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