'use server';

import { z } from "zod";
import { TextChatLogProps } from "../../text-chat-log";
import { logger } from "@/src/lib/logger";
import { UTILS_generateDynamicTool, UTILS_registerDynamicTool } from "./tool-generator"; 
import { SERVER_storeGeneralPurposeData, SERVER_getGeneralPurposeDataMany, SERVER_getGeneralPurposeDataSingle } from "@/src/lib/server-actions";

import { GeneralPurpose } from "@prisma/client";
import { CORE_generateDynamicTool } from "./tool-generator_core"; // Use core generator
import { tool } from "ai"; // Need tool here for generation
import { 
    ToolParameter, 
    CustomToolDefinition, 
    UTILS_buildParameterSchema // Use the utility from the client-safe file
} from "./tool-generator"; 
import { generateObject } from "ai"; // Ensure generateObject is imported
import { MODEL_getModel_ai } from "@/src/lib/vercelAI-model-switcher";
import { UTILS_getModelArgsByName, UTILS_getModelsJSON } from "@/src/lib/utils";
import { ToolRequest } from "@/src/lib/types";
import { ensureUnifiedToolRequest } from "@/src/lib/agent-tools/auto-gen-tool/tool-request-adapter";

// Add global declaration for tool registry
declare global {
  var __loadedTools: Record<string, Record<string, any>>;
}

// Tools state registry for each agent
const agentToolsRegistry: Record<string, Record<string, any>> = {};

// Zod schemas (needed for type validation within core functions)
const toolParameterCoreSchema = z.array(z.object({
  name: z.string(),
  type: z.enum(["string", "number", "boolean", "array", "object"]),
  description: z.string(),
  required: z.boolean().optional(),
  default: z.any().optional()
}));

type ToolParameterCoreType = z.infer<typeof toolParameterCoreSchema>;

const customToolCoreSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: toolParameterCoreSchema,
  functionBody: z.string(),
  category: z.string().optional()
});

type CustomToolCoreType = z.infer<typeof customToolCoreSchema>;

// --- Core Logic Functions --- 

export const CORE_createTool = async (
  agentName: string,
  userId: string,
  textChatLogs: TextChatLogProps[],
  params: CustomToolCoreType
) => {
  const { name, description, parameters, functionBody, category } = params;
  logger.tool("Auto-gen Core - Creating Custom Tool", {
    name,
    description,
    parameters: JSON.stringify(parameters),
    category: category || "DEFAULT"
  });

  textChatLogs.push({
    role: "function",
    message: `CORE: Creating custom tool: "${name}" with ${parameters.length} parameter(s)`,
    agentName,
    timestamp: new Date()
  });

  try {
    const customTool = await UTILS_generateDynamicTool({
      name,
      description,
      parameters,
      functionBody
    });
    await UTILS_registerDynamicTool(agentName, name, customTool);

    await SERVER_storeGeneralPurposeData(
      JSON.stringify({
        name,
        description,
        parameters,
        functionBody,
        category
      }),
      name,
      description,
      "",
      `CUSTOM_TOOLS_${agentName}_${userId}`,
      true
    );

    logger.tool("Auto-gen Core - Created Successfully", { name });
    return JSON.stringify({
      success: true,
      message: `Tool "${name}" created successfully and is now available to use`,
      toolName: name
    });
  } catch (error) {
    logger.error("Auto-gen Core - Creation Failed", {
      name,
      error: error instanceof Error ? error.message : "Unknown error"
    });
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Failed to create tool"
    });
  }
};

export const CORE_registerPredefinedTool = async (
  agentName: string,
  userId: string,
  textChatLogs: TextChatLogProps[],
  params: CustomToolCoreType
) => {
    const { name, description, parameters, functionBody, category } = params;
    logger.tool("Auto-gen Core - Registering Predefined Tool", {
      name,
      description,
      parameters: JSON.stringify(parameters),
      category: category || "DEFAULT"
    });

    textChatLogs.push({
      role: "function",
      message: `CORE: Registering predefined tool: "${name}" with ${parameters.length} parameter(s)`,
      agentName,
      timestamp: new Date()
    });

    try {
      const customTool = await UTILS_generateDynamicTool({
        name,
        description,
        parameters,
        functionBody
      });

      // Register directly in global registry
      const loadedTools = global.__loadedTools = global.__loadedTools || {};
      const agentTools = loadedTools[agentName] = loadedTools[agentName] || {};
      agentTools[name] = customTool;

      await SERVER_storeGeneralPurposeData(
        JSON.stringify({
          name,
          description,
          parameters,
          functionBody,
          category,
          isPredefined: true
        }),
        name,
        description,
        "",
        `PREDEFINED_TOOLS_${agentName}_${userId}`,
        true
      );

      logger.tool("Auto-gen Core - Predefined Tool Registered Successfully", { name });
      return JSON.stringify({
        success: true,
        message: `Tool "${name}" registered successfully and is now available as a regular tool`,
        toolName: name
      });
    } catch (error) {
      logger.error("Auto-gen Core - Predefined Tool Registration Failed", {
        name,
        error: error instanceof Error ? error.message : "Unknown error"
      });
      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Failed to register predefined tool"
      });
    }
};

export const CORE_executeTool = async (
    agentName: string,
    textChatLogs: TextChatLogProps[],
    params: { toolName: string; parameters?: Record<string, any> }
): Promise<any> => {
  const { toolName, parameters = {} } = params; // Ensure parameters is an object
  logger.tool("Tool Executor Core - Executing Tool", {
    agentName,
    toolName,
    parameters: JSON.stringify(parameters)
  });

  textChatLogs.push({
    role: "function",
    message: `CORE: Executing custom tool: "${toolName}"`,
    agentName,
    timestamp: new Date()
  });

  try {
    // Check if the tool is already loaded in the registry
    const registry = await getAgentToolsRegistry(agentName);
    let toolFunction = registry[toolName];
    
    // If the tool is not loaded, try to load it from the database
    if (!toolFunction) {
      logger.tool("Tool Executor Core - Tool Not Loaded, Attempting to Load", {
        agentName,
        toolName
      });
      
      const loadResult = await loadToolFromDatabase(agentName, toolName);
      if (!loadResult.success) {
        throw new Error(loadResult.error);
      }
      
      // Re-check registry after loading attempt
      toolFunction = registry[toolName]; 
      if (!toolFunction) {
          // This should ideally not happen if loadToolFromDatabase succeeded
          throw new Error(`Tool "${toolName}" loaded but not found in registry.`);
      }
    }
    
    // Execute the tool with the provided parameters
    // The generated tool object from `ai` library has the execute function correctly structured
    logger.tool("Tool Executor Core - Calling toolFunction.execute", {
      toolName
    });
    
    // The `execute` function from `ai.tool` expects the parameters object
    const result = await toolFunction.execute(parameters);
    
    logger.tool("Tool Executor Core - Execution Complete", {
      toolName,
      // Check if the result itself indicates an error (based on our CORE_createExecuteFunction error structure)
      success: !(result?._isToolError === true)
    });
    
    // Return the result directly (could be success data or the error object from execute)
    return typeof result === 'string' ? result : JSON.stringify(result);

  } catch (error) {
    logger.error("Tool Executor Core - Execution Failed", {
      agentName,
      toolName,
      error: error instanceof Error ? error.message : "Unknown error"
    });
    
    // Return a consistent error format
    return JSON.stringify({
      success: false,
      error: `Failed to execute tool "${toolName}": ${error instanceof Error ? error.message : "Unknown error"}`
    });
  }
};

export const CORE_listTools = async (
  agentName: string,
  userId: string,
  textChatLogs: TextChatLogProps[],
  params: { category?: string }
) => {
  const { category } = params;
  logger.tool("Auto-gen Core - Listing Tools", {
    category: category || "all"
  });

  textChatLogs.push({
    role: "function",
    message: `CORE: Listing custom tools${category ? ` in category: ${category}` : ''}`,
    agentName,
    timestamp: new Date()
  });

  try {
    const toolNamespace = `CUSTOM_TOOLS_${agentName}_${userId}`;
    const storedToolsData: GeneralPurpose[] = await SERVER_getGeneralPurposeDataMany(toolNamespace);

    let tools = storedToolsData.map(data => {
        try {
            const toolData = JSON.parse(data.content || '{}');
            return {
                name: toolData.name || data.meta1 || 'Unknown Name',
                description: toolData.description || data.meta2 || 'No description',
                parameters: toolData.parameters || [],
                category: toolData.category || 'DEFAULT'
            }
        } catch(e) {
            logger.error("Auto-gen Core - Failed to parse stored tool", { id: data.id });
            return null;
        }
    }).filter(tool => tool !== null);

    // Filter by category if provided
    if (category) {
        tools = tools.filter(tool => tool!.category === category);
    }

    logger.tool("Auto-gen Core - Listed Tools Successfully", { count: tools.length, category: category || 'all' });
    return JSON.stringify({
      success: true,
      tools: tools
    });
  } catch (error) {
    logger.error("Auto-gen Core - Listing Tools Failed", {
      error: error instanceof Error ? error.message : "Unknown error"
    });
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Failed to list tools"
    });
  }
};

// Export registry accessor if needed server-side
export const getAgentToolsRegistry = async (agentName: string) => {
  return agentToolsRegistry[agentName] || {};
};

// --- Tool Execution Logic (Moved from tool-executor.ts) ---

/**
 * Load a tool from the database and register it (Internal Core Function)
 */
const loadToolFromDatabase = async (
  agentName: string,
  toolName: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Attempt to retrieve the tool definition from the database
    const storedTool = await SERVER_getGeneralPurposeDataSingle(toolName, `CUSTOM_TOOLS_${agentName}_*`); // Refined query

    if (!storedTool) {
        // Also check predefined tools
        const storedPredefinedTool = await SERVER_getGeneralPurposeDataSingle(toolName, `PREDEFINED_TOOLS_${agentName}_*`);
        if(!storedPredefinedTool) {
            logger.tool("Tool Executor Core - Tool not found in DB", { agentName, toolName });
            return { 
                success: false, 
                error: `Tool "${toolName}" not found for agent "${agentName}"` 
            };
        }
        // If found as predefined, use its data
        // TODO: This part assumes the structure is compatible. Might need adjustments.
        Object.assign(storedTool || {}, storedPredefinedTool); 
    }
    
    // Parse the tool definition
    const toolDefinition = JSON.parse(storedTool.content || '{}') as {
      name: string;
      description: string;
      parameters: any[];
      functionBody: string;
      category?: string;
      isPredefined?: boolean;
    };
    
    // Generate and register the tool
    const generatedTool = await CORE_generateDynamicTool({
      name: toolDefinition.name,
      description: toolDefinition.description,
      parameters: toolDefinition.parameters,
      functionBody: toolDefinition.functionBody,
      category: toolDefinition.category
    });
    
    // Register the tool using the local registry access
    const registry = await getAgentToolsRegistry(agentName);
    registry[toolName] = generatedTool;

    // If it was a predefined tool, also register globally if that's intended
    if (toolDefinition.isPredefined) {
        const loadedTools = global.__loadedTools = global.__loadedTools || {};
        const agentTools = loadedTools[agentName] = loadedTools[agentName] || {};
        agentTools[toolName] = generatedTool;
        logger.tool("Tool Executor Core - Loaded and Registered Predefined Tool Globally", { agentName, toolName });
    }
    
    logger.tool("Tool Executor Core - Loaded Tool from DB Successfully", { agentName, toolName });
    return { success: true };
  } catch (error) {
    logger.error("Tool Executor Core - Load Failed", {
      agentName,
      toolName,
      error: error instanceof Error ? error.message : "Unknown error"
    });
    
    return { 
      success: false, 
      error: `Failed to load tool "${toolName}": ${error instanceof Error ? error.message : "Unknown error"}` 
    };
  }
}; 

// --- Tool Loading Logic (Moved from load-custom-tools.ts) ---

/**
 * Creates an execute function for the tool (Server-Side)
 * NOTE: Duplicates CORE_createExecuteFunction from tool-generator_core. Consider consolidating.
 */
export const createExecuteFunctionForLoading = async (functionBody: string, parameters: ToolParameter[]) => {
  return async (args: any) => {
    try {
      // Apply default values
      parameters
        .filter(param => !param.required && param.default !== undefined)
        .forEach(param => {
          if (args[param.name] === undefined) {
            args[param.name] = param.default;
          }
        });
        
      // Create and execute
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const paramNames = parameters.map(p => p.name);
      const paramValues = paramNames.map(name => args[name]);
      const func = new AsyncFunction(...paramNames, functionBody);
      const result = await func(...paramValues);
      return result;
    } catch (error) {
      logger.error("Loaded Tool Execute - Execution Error", {
        error: error instanceof Error ? error.message : "Unknown error"
      });
      return {
        _isToolError: true,
        error: error instanceof Error ? error.message : "Function execution failed",
        stack: error instanceof Error ? error.stack : undefined
      };
    }
  };
};

/**
 * Loads a predefined tool during agent initialization (Core Function)
 */
export const CORE_customToolWrapper = async (
  toolSchema: CustomToolDefinition,
  agentName: string,
  userId: string
): Promise<Record<string, any>> => {
  const { name, description, parameters, functionBody, category } = toolSchema;
  
  logger.tool("Core - Loading Predefined Tool Wrapper", {
    agentName,
    toolName: name,
    parameters: parameters.length
  });
  
  try {
    // Build schema using the utility
    const parameterSchema = UTILS_buildParameterSchema(parameters);
    
    // Create the tool function using ai.tool
    const generatedTool = {
      [name]: tool({
        description,
        parameters: parameterSchema,
        execute: await createExecuteFunctionForLoading(functionBody, parameters)
      })
    };
    
    // Store for future reference/consistency check
    SERVER_storeGeneralPurposeData(
      JSON.stringify(toolSchema),
      name,
      description,
      category || "", // Use category if available
      `PREDEFINED_TOOLS_${agentName}_${userId}`, // Use a distinct namespace
      true
    ).catch(err => {
      // Log error but don't fail the loading process
      logger.error("Core - Error storing predefined tool definition during load", {
        name,
        error: err instanceof Error ? err.message : "Unknown error"
      });
    });
    
    logger.tool("Core - Predefined Tool Wrapped Successfully", { name });
    
    return generatedTool;
  } catch (error) {
    logger.error("Core - Failed to wrap predefined tool", {
      name,
      error: error instanceof Error ? error.message : "Unknown error"
    });
    return {}; // Return empty on failure
  }
};

/**
 * Loads multiple predefined tools at once (Core Function)
 */
export const CORE_loadCustomTools = async (
  toolSchemas: CustomToolDefinition[],
  agentName: string,
  userId: string
): Promise<Record<string, any>> => {
  logger.tool("Core - Loading Multiple Predefined Tools", {
    agentName,
    toolCount: toolSchemas.length
  });

  const tools: Record<string, any> = {};
  const loadPromises = toolSchemas.map(schema => 
    CORE_customToolWrapper(schema, agentName, userId)
      .then(generatedTool => {
        Object.assign(tools, generatedTool);
      })
      .catch(error => {
        // Log error for the specific tool that failed
        logger.error("Core - Error loading one predefined tool in batch", {
          name: schema.name,
          error: error instanceof Error ? error.message : "Unknown error"
        });
        // Continue loading others
      })
  );

  // Wait for all tools to attempt loading
  await Promise.all(loadPromises);

  logger.tool("Core - Finished Loading Multiple Tools", {
    loadedCount: Object.keys(tools).length,
    requestedCount: toolSchemas.length
  });
  
  return tools;
}; 

// --- Tool Generation Service Logic (Moved from tool-generator-service.ts) ---




/**
 * Schema for the generated function body
 */
const functionBodySchema = z.object({
  functionBody: z.string().min(10)
});

/**
 * Creates a detailed prompt for function body generation (Internal Core Function)
 */
function createFunctionBodyPrompt(toolRequest: ToolRequest): string {
  const inputsDescription = toolRequest.inputs.map(input => 
    `- ${input.name} (${input.type}${input.required === false ? ', optional' : ''}): ${input.description}${input.default !== undefined ? ` Default: ${JSON.stringify(input.default)}` : ''}`
  ).join('\n');
  
  const examplesText = toolRequest.examples && toolRequest.examples.length > 0 
    ? `\n\n<EXAMPLES>\n${toolRequest.examples.map((example, index) => 
        `Example ${index + 1}:\nInput: ${JSON.stringify(example.input, null, 2)}\nExpected Output: ${JSON.stringify(example.output, null, 2)}`
      ).join('\n\n')}\n</EXAMPLES>`
    : '';
  
  return `
<TASK>
  Write JavaScript function body for a tool that will be used in an AI agent system.
  This function will be executed with the 'toolFunction.execute.func(parameters)' pattern.
</TASK>

<TOOL_SPECIFICATIONS>
  Name: ${toolRequest.name}
  Description: ${toolRequest.description}
  Purpose: ${toolRequest.purpose}
  
  Input Parameters:
${inputsDescription}
  
  Expected Output: ${toolRequest.expectedOutput}
  ${toolRequest.additionalContext ? `\nAdditional Context: ${toolRequest.additionalContext}` : ''}
</TOOL_SPECIFICATIONS>${examplesText}

<REQUIREMENTS>
  1. Write ONLY the function body (the code between curly braces)
  2. The function will be executed in an async context
  3. The code should handle errors gracefully and return meaningful error messages
  4. Do not include the function declaration or surrounding curly braces
  5. Parameters will be passed to your function by name (destructured)
  6. The function must explicitly return a value
  7. Keep your code efficient and focused on the specific task
  8. Use only standard JavaScript libraries available in Node.js
</REQUIREMENTS>

<OUTPUT_FORMAT>
  Return only the function body as a string, without function declaration.
  Example:
  \`\`\`
  try {
    // Implementation here
    return result;
  } catch (error) {
    return { error: true, message: error.message };
  }
  \`\`\`
</OUTPUT_FORMAT>
`;
}

/**
 * Generates the function body for a tool using an AI model (Internal Core Function)
 */
async function generateToolFunctionBody(toolRequest: ToolRequest): Promise<string> {
  try {
    // Create a detailed prompt for the model
    const prompt = createFunctionBodyPrompt(toolRequest);
    
    // Generate the function body
    // TODO: Make model configurable
    const modelArgs = UTILS_getModelArgsByName(UTILS_getModelsJSON().Anthropic["claude-3-5-sonnet-20240620"].name);
    const model = await MODEL_getModel_ai(modelArgs); 

    const response = await generateObject({
      model: model, // Use the instantiated model
      schema: functionBodySchema,
      prompt,
      // Provider options might differ based on the actual model provider
      // providerOptions: {
      //   anthropic: {
      //     thinking: { type: "enabled", budgetTokens: 4000 },
      //   },
      // }
    });
    
    if (!response.object.functionBody) {
      throw new Error("AI failed to generate function body");
    }
    
    // Basic validation/cleanup (optional)
    const trimmedBody = response.object.functionBody.trim();
    if (trimmedBody.startsWith('```') && trimmedBody.endsWith('```')) {
        // Remove markdown code blocks if present
        return trimmedBody.substring(trimmedBody.indexOf('\n') + 1, trimmedBody.lastIndexOf('\n')).trim();
    }

    return trimmedBody;

  } catch (error) {
    logger.error("Core - Function Body Generation Failed", {
      toolName: toolRequest.name,
      error: error instanceof Error ? error.message : "Unknown error"
    });
    throw error; // Rethrow to be handled by the caller
  }
}

/**
 * Creates a full tool definition from a high-level tool request (Core Function)
 */
export async function CORE_generateCustomToolDefinition(
  toolRequest: ToolRequest
): Promise<CustomToolDefinition> {
  logger.tool("Tool Generator Service Core - Generating Tool Definition", {
    name: toolRequest.name,
    purpose: toolRequest.purpose?.substring(0, 50) + "..." || "No purpose specified"
  });

  try {
    // Ensure request is unified (assuming adapter is available)
    const unifiedRequest = await ensureUnifiedToolRequest(toolRequest);

    // Map the request inputs to the ToolParameter format
    const parameters: ToolParameter[] = unifiedRequest.inputs.map(input => ({
      name: input.name,
      type: input.type,
      description: input.description,
      required: input.required !== false, // Default to true
      default: input.default
    }));

    // Generate the function body using the AI model
    const functionBody = await generateToolFunctionBody(unifiedRequest);

    // Create and return the complete tool definition
    const toolDefinition: CustomToolDefinition = {
      name: unifiedRequest.name,
      description: unifiedRequest.description,
      parameters,
      functionBody,
      category: unifiedRequest.category || "AUTO_GENERATED"
    };

    logger.tool("Tool Generator Service Core - Tool Definition Generated", {
      name: unifiedRequest.name,
      functionBodyLength: functionBody.length
    });

    return toolDefinition;
  } catch (error) {
    logger.error("Tool Generator Service Core - Generation Failed", {
      name: toolRequest.name, // Log original name
      error: error instanceof Error ? error.message : "Unknown error"
    });
    throw new Error(`Failed to generate tool definition: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Create a tool directly from a request (Core convenience function)
 */
export async function CORE_createToolFromRequest(
  toolRequest: ToolRequest,
  agentName: string,
  userId: string
): Promise<Record<string, any>> {
  // Ensure the tool request is in the unified format
  const unifiedRequest = await ensureUnifiedToolRequest(toolRequest);
  
  // Generate the tool definition
  const toolDefinition = await CORE_generateCustomToolDefinition(unifiedRequest);
  
  // Create and return the tool using the core wrapper function
  return CORE_customToolWrapper(toolDefinition, agentName, userId);
}

/**
 * Create multiple tools from requests (Core convenience function)
 */
export async function CORE_createToolsFromRequests(
  toolRequests: ToolRequest[],
  agentName: string,
  userId: string
): Promise<Record<string, any>> {
  // Ensure all tool requests are in the unified format
  const unifiedRequests = await Promise.all(toolRequests.map(request => ensureUnifiedToolRequest(request)));
  
  // Generate all tool definitions
  const toolDefinitions = await Promise.all(
    unifiedRequests.map(request => CORE_generateCustomToolDefinition(request))
  );
  
  // Create and return the tools using the core loading function
  return CORE_loadCustomTools(toolDefinitions, agentName, userId);
} 

// --- Tool Request Adapter Logic (Moved from tool-request-adapter.ts) ---

// Note: Keeping 'use server' context as this is part of the core server logic flow

/**
 * Adapter to convert from the legacy tool request format to the unified format (Internal Core Function)
 */
async function adaptLegacyToolRequest(legacyRequest: {
  toolName: string;
  toolDescription: string;
  suggestedInputs: string[];
  suggestedOutputs: string[];
}): Promise<ToolRequest> {
  logger.debug("Core - Adapting legacy tool request", { name: legacyRequest.toolName });
  
  const inputs = legacyRequest.suggestedInputs.map(inputName => ({
    name: inputName,
    type: "string" as const,
    description: `Input: ${inputName}`,
    required: true
  }));
  
  return {
    name: legacyRequest.toolName,
    description: legacyRequest.toolDescription,
    inputs,
    expectedOutput: legacyRequest.suggestedOutputs.join(", "),
    purpose: legacyRequest.toolDescription, // Use description as purpose
    
    // Keep legacy fields for reference if needed downstream, though ideally not used
    // toolName: legacyRequest.toolName,
    // toolDescription: legacyRequest.toolDescription,
    // suggestedInputs: legacyRequest.suggestedInputs,
    // suggestedOutputs: legacyRequest.suggestedOutputs
  };
}

/**
 * Adapter to ensure a tool request is in the unified format (Exported Core Function)
 * Use this when you're not sure if you're getting a legacy or unified format
//  */
// export async function ensureUnifiedToolRequest(request: any): Promise<ToolRequest> {
//   // If it's already in the new format (has 'name' property)
//   if (request.name && Array.isArray(request.inputs)) {
//     // Ensure essential fields are present
//     return {
//       ...request,
//       purpose: request.purpose || request.description || "No purpose provided",
//       expectedOutput: request.expectedOutput || 
//         (Array.isArray(request.suggestedOutputs) ? request.suggestedOutputs.join(", ") : "Output value")
//     };
//   }
  
//   // If it's in the legacy format (has 'toolName' property)
//   if (request.toolName && Array.isArray(request.suggestedInputs)) {
//     return await adaptLegacyToolRequest(request);
//   }
  
//   // If it's in neither format, try to salvage
//   logger.warn("Core - Unknown tool request format, attempting salvage", { request });
  
//   const name = request.name || request.toolName || "unnamed_tool";
//   const description = request.description || request.toolDescription || "No description provided";
  
//   return {
//     name,
//     description,
//     inputs: Array.isArray(request.inputs) ? request.inputs : 
//       (Array.isArray(request.suggestedInputs) ? 
//         request.suggestedInputs.map((input: string) => ({
//           name: input,
//           type: "string" as const,
//           description: `Input: ${input}`,
//           required: true
//         })) : 
//         []),
//     expectedOutput: request.expectedOutput || 
//       (Array.isArray(request.suggestedOutputs) ? request.suggestedOutputs.join(", ") : "Output value"),
//     purpose: request.purpose || description
//   };
// } 