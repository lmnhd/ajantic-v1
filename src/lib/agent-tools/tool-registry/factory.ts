import { tool } from "ai";
import { z } from "zod";
import { ToolRegistry } from "./registry";
import { logger } from "@/src/lib/logger";
import { getCustomToolId, isCustomToolReference } from "./custom-tool-ref";
import { ToolRegistryEntry } from "./ct-types";
import { validateImplementationString } from "./ct-utils";
import { getDecryptedCredential } from "@/src/lib/security/credentials";
import { MissingCredentialError } from "@/src/lib/agent-tools/load-agent-tools";

// Define a type for tool execution results
type ToolExecutionResult = {
  _isToolError: boolean;
  success: boolean;
  error?: string;
  result?: string;
};

// Helper function to ensure string output
function ensureStringOutput(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

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
    const validation = validateImplementationString(toolEntry.implementation, toolEntry.implementationType);
    if (!validation.isValid) {
      logger.error(`ToolFactory: Invalid implementation structure for tool ${toolEntry.name} (Type: ${toolEntry.implementationType})`, { 
        toolId: toolEntry.id, 
        validationError: validation.error 
      });
      return async function invalidExecute(): Promise<ToolExecutionResult> {
            return {
                 _isToolError: true,
                 success: false,
                 error: `Tool Configuration Error: ${validation.error}`
            };
      };
    }

    return async function execute(params: any): Promise<ToolExecutionResult> {
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

              const result = await funcExecutor(params);
              return {
                _isToolError: false,
                success: true,
                result: ensureStringOutput(result)
              };
            } catch (execError) {
              logger.error(`ToolFactory: Error executing function implementation for ${toolEntry.name}`, { 
                error: execError, 
                toolId: toolEntry.id 
              });
                 return {
                     _isToolError: true,
                     success: false,
                     error: `Tool Execution Error: ${execError instanceof Error ? execError.message : String(execError)}`
                 };
            }
            
          case "api":
            try {
              // Parse API configuration
              const apiConfig = (toolEntry.implementation || "").startsWith("{") 
                ? JSON.parse(toolEntry.implementation || "{}")
                : { endpoint: toolEntry.implementation || "" };
                
              if (!apiConfig.endpoint) {
              throw new Error("No API endpoint specified for tool");
            }
            
              // Get credentials if required
              const headers: Record<string, string> = {
                "Content-Type": "application/json"
              };

              if (Array.isArray(toolEntry.requiredCredentialNames) && toolEntry.requiredCredentialNames.length > 0) {
                for (const cred of toolEntry.requiredCredentialNames as unknown as { name: string, label: string }[]) {
                  if (cred && typeof cred.name === 'string') {
                    const credentialValue = await getDecryptedCredential(toolEntry.userId, cred.name);
                    if (!credentialValue) {
                      throw new MissingCredentialError(cred.name);
                    }
                    if (apiConfig && apiConfig.authType === 'bearer') {
                      headers['Authorization'] = `Bearer ${credentialValue}`;
                    } else if (apiConfig && apiConfig.authType === 'basic') {
                      headers['Authorization'] = `Basic ${Buffer.from(credentialValue).toString('base64')}`;
                    } else if (apiConfig && apiConfig.authType === 'apiKey') {
                      headers[apiConfig.apiKeyHeader || 'X-API-Key'] = credentialValue;
                    }
                  } else {
                    logger.warn(`ToolFactory: Invalid credential object in requiredCredentialNames for tool ${toolEntry.name}`, { cred });
                  }
                }
              }

              // Map parameters according to the API configuration
              const mappedParams: Record<string, any> = {};
              if (apiConfig.parameterMapping) {
                const mapping = apiConfig.method === 'GET' 
                  ? apiConfig.parameterMapping.query 
                  : apiConfig.parameterMapping.body;

                if (mapping) {
                  Object.entries(mapping as Record<string, string>).forEach(([apiParam, toolParam]) => {
                    if ((params as Record<string, any>)[toolParam] !== undefined) {
                      mappedParams[apiParam] = (params as Record<string, any>)[toolParam];
                    }
                  });
                }
              } else {
                // If no mapping provided, use params as is
                Object.assign(mappedParams, params);
              }

              // Prepare request configuration
              const requestConfig: RequestInit = {
                method: apiConfig.method || 'POST',
                headers,
                body: apiConfig.method !== 'GET' ? JSON.stringify(mappedParams) : undefined,
                signal: AbortSignal.timeout(apiConfig.timeout || 30000), // 30s default timeout
              };

              // Add query parameters for GET requests
              if (apiConfig.method === 'GET' && Object.keys(mappedParams).length > 0) {
                const queryParams = new URLSearchParams();
                Object.entries(mappedParams).forEach(([key, value]) => {
                  if (value !== undefined && value !== null) {
                    queryParams.append(key, String(value));
                  }
                });
                apiConfig.endpoint = `${apiConfig.endpoint}${apiConfig.endpoint.includes('?') ? '&' : '?'}${queryParams.toString()}`;
              }

              logger.tool(`Calling API for tool ${toolEntry.name}`, { 
                toolId: toolEntry.id,
                endpoint: apiConfig.endpoint,
                method: requestConfig.method,
                mappedParams
              });

              const response = await fetch(apiConfig.endpoint, requestConfig);
              const contentType = response.headers.get('content-type');
              let result: string;

              // Handle different response types
              if (contentType?.includes('application/json')) {
                const jsonResult = await response.json();
                result = JSON.stringify(jsonResult);
              } else if (contentType?.includes('text/')) {
                result = await response.text();
              } else {
                // For binary data, convert to base64
                const buffer = await response.arrayBuffer();
                result = Buffer.from(buffer).toString('base64');
              }

              // Handle error responses
              if (!response.ok) {
                const errorMessage = typeof result === 'string' && result.includes('message') 
                  ? JSON.parse(result).message 
                  : `API call failed with status ${response.status}`;
                
                throw new Error(errorMessage);
              }

              logger.tool(`Tool ${toolEntry.name} API call successful`, { 
                toolId: toolEntry.id,
                status: response.status
              });

              return {
                _isToolError: false,
                success: true,
                result
              };

            } catch (error) {
              if (error instanceof MissingCredentialError) {
                logger.error(`Missing required credential for tool ${toolEntry.name}`, {
                  toolId: toolEntry.id,
                  credentialName: error.credentialName
                });
                return {
                  _isToolError: true,
                  success: false,
                  error: `Missing required credential: ${error.credentialName}`
                };
              }

              logger.error(`ToolFactory: Error executing API for ${toolEntry.name}`, {
                error: error instanceof Error ? error.message : String(error),
                toolId: toolEntry.id
              });

              return {
                _isToolError: true,
                success: false,
                error: `API Error: ${error instanceof Error ? error.message : String(error)}`
              };
            }
            
          case "dynamic-script":
            logger.warn(`ToolFactory: Dynamic script execution not implemented for tool ${toolEntry.name}`, { toolId: toolEntry.id });
            return {
              _isToolError: true,
              success: false,
              error: `Dynamic script execution not yet implemented for tool ${toolEntry.name}`
            };
            
          default:
            logger.error(`ToolFactory: Unsupported implementation type: ${toolEntry.implementationType}`, { toolId: toolEntry.id });
            return {
              _isToolError: true,
              success: false,
              error: `Unsupported tool implementation type: ${toolEntry.implementationType}`
            };
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