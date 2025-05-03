'use server';

import { z } from "zod";
import { Prisma } from "@prisma/client"; // Import Prisma for error handling
import { TextChatLogProps } from "../../text-chat-log";
import { logger } from "@/src/lib/logger";
import { tool } from "ai"; // Need tool here for generation
import {
    ToolParameter,
    CustomToolDefinition,
    UTILS_buildParameterSchema
} from "./tool-generator";
import { generateObject } from "ai"; // Ensure generateObject is imported
import { MODEL_getModel_ai } from "@/src/lib/vercelAI-model-switcher";
import { ModelArgs, ModelProviderEnum, ToolRequest } from "@/src/lib/types"; // Consolidated imports
import { ensureUnifiedToolRequest } from "@/src/lib/agent-tools/auto-gen-tool/tool-request-adapter";
import { ToolRegistry } from "../tool-registry/registry";
import { createCustomToolReference, getCustomToolId, isCustomToolReference } from "../tool-registry/custom-tool-ref";
import { ToolFactory } from "../tool-registry/factory"; // Import ToolFactory


// --- Zod Schemas (remain the same) ---
const toolParameterSchema = z.object({
  name: z.string().describe("Parameter name (snake_case)"),
  type: z.enum(["string", "number", "boolean", "array", "object"]).describe("Parameter data type"),
  description: z.string().describe("Parameter description"),
  required: z.boolean().optional().default(true).describe("Is the parameter required?"),
  default: z.any().optional().describe("Optional default value"),
});
const toolParametersSchema = z.array(toolParameterSchema).describe("List of input parameters");
const refinedToolDefinitionSchema = z.object({
    name: z.string().describe("The final, potentially refined, tool name."),
    description: z.string().describe("The final, potentially refined, tool description."),
    inputs: toolParametersSchema.describe("The final, potentially refined, list of input parameters."),
    expectedOutput: z.string().describe("The final, potentially refined, description of the expected output."),
    implementation: z.string().min(1).describe("The generated JavaScript/TypeScript function body code (as a string). MUST NOT be empty."),
}).describe("The complete, potentially refined tool definition including the implementation code.");
type RefinedToolDefinition = z.infer<typeof refinedToolDefinitionSchema>;


// --- Core Logic Functions ---

/**
 * Creates a detailed prompt for function body generation, including instructions
 * for potential structure refinement and modification of existing implementation.
 */
function createFunctionBodyPrompt(toolRequest: ToolRequest): string {
  // Destructure all relevant fields, including implementation
  const { name, description, purpose, inputs, expectedOutput, additionalContext, modificationRequests, implementation } = toolRequest;

  const parametersString = inputs.map(p =>
    `- ${p.name} (${p.type}): ${p.description}${p.required === false ? ' (optional)' : ''}`
  ).join('\\n') || 'None';

  const modificationString = modificationRequests && modificationRequests.length > 0
    ? `\\n\\nCRITICAL MODIFICATION REQUESTS:\\nPlease apply the following modifications while generating/modifying the code:\\n${modificationRequests.map((mod, i) => `${i + 1}. ${mod}`).join('\\n')}`
    : '';

  // **** ADDED: Conditionally include current implementation ****
  const currentImplementationString = implementation
    ? `\\n\\n**Current Implementation (for modification):**\\n\`\`\`javascript\\n${implementation}\\n\`\`\``
    : '\\n\\n**Note:** No previous implementation provided. Generate the first implementation based on the details.';
  // **** END ADDED ****


  // **** MODIFIED PROMPT INSTRUCTIONS ****
  return `
You are an expert JavaScript/TypeScript developer tasked with creating OR MODIFYING the function body for a custom tool.
Your goal is to generate a robust, efficient, and correct standalone async function implementation based ONLY on the provided details.

**Tool Details:**
*   **Name:** ${name}
*   **Description:** ${description}
*   **Purpose:** ${purpose || description}
*   **Input Parameters:**
${parametersString}
*   **Expected Output:** ${expectedOutput}
${additionalContext ? `*   **Additional Context:** ${additionalContext}` : ''}
${currentImplementationString} // **** Insert current implementation or note here ****
${modificationString}

**Instructions:**

1.  **Generate/Modify Implementation:** Write the complete JavaScript/TypeScript async function body.
    *   **If 'Current Implementation' is provided:** Use it as your starting point and apply the necessary changes based on the tool details and modification requests. Focus on modifying the existing code.
    *   **If no 'Current Implementation' is provided:** Generate the function body from scratch based on the details.
    *   **CRITICAL FORMAT:** The implementation MUST be an asynchronous arrow function expression that accepts a single object argument destructuring the parameters. It MUST start exactly like: \`async ({ ${inputs.map(p => p.name).join(', ')} }) => {\` followed by the function body and ending with \`}\`.
    *   **DO NOT** include a standard function declaration like \`function ${name}(...)\` or \`async function ${name}(...)\`. ONLY provide the arrow function expression as described.
    *   Use standard Node.js built-in modules ONLY if absolutely necessary (like 'fs', 'path', 'crypto'). AVOID external libraries unless explicitly requested.
    *   Include error handling (try/catch blocks inside the arrow function body).
    *   Return a value matching the 'Expected Output' description. Return \`{ success: false, error: 'message' }\` on failure from within the arrow function body.
    *   Focus on clear, readable, and correct code. Ensure the final code aligns with ALL instructions, especially the modification requests.

2.  **Refine Structure (If Necessary):** Review the parameters and output. If modifications are needed based on the purpose or requests, update the \`inputs\` array or \`expectedOutput\` string in your JSON response. Ensure the parameter destructuring in your generated \`implementation\` string matches the *final* \`inputs\` you return. If no structural changes are needed, return the original details.

3.  **Output Format:** Respond ONLY with a JSON object matching the required schema, containing the potentially refined \`name\`, \`description\`, \`inputs\`, \`expectedOutput\`, and the final \`implementation\` string (which must be the async arrow function expression).

**Example Implementation Format:**
\`\`\`javascript
async ({ param1, optionalParam }) => {
  try {
    // Your code here using param1 and optionalParam
    const result = await someAsyncTask(param1);
    return { success: true, data: result };
  } catch (error) {
    console.error('Tool execution failed:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
\`\`\`

**Constraint Checklist & Confidence Score:**
1. Implementation is an async arrow function \`async ({...}) => { ... }\`? Yes
2. Returned data matches expected output description? Yes
3. Handled potential errors within the function body? Yes
4. Avoided external libraries (unless explicitly requested)? Yes
5. If modifying, based changes on Current Implementation? Yes/No/NA // **** ADDED Checklist Item ****
6. Confidence Score (1-5): 5

Provide ONLY the JSON output.
`;
// **** END MODIFIED PROMPT INSTRUCTIONS ****
}

/**
 * Generates a custom tool definition, including the function implementation,
 * based on a detailed request. It may refine the input/output structure.
 *
 * @param toolRequest - The detailed request for the tool.
 * @param modelArgs - The model arguments for generation.
 * @returns A promise resolving to the refined tool definition including implementation.
 * @throws Throws an error if generation fails.
 */
export async function CORE_generateCustomToolDefinition(
  toolRequest: ToolRequest,
  modelArgs: ModelArgs // Add modelArgs parameter
): Promise<RefinedToolDefinition> {
  logger.info(`CORE: Generating definition & implementation for: ${toolRequest.name} using model ${modelArgs.modelName}`);

  // Ensure the request is in the unified format
  const unifiedRequest = await ensureUnifiedToolRequest(toolRequest);

  // --- Use passed modelArgs ---
  // const modelName = "openai:gpt-4o"; // REMOVE Hardcoded model
  // const modelArgs = UTILS_getModelArgsByName(modelName); // REMOVE 
  if (!modelArgs) { // Keep validation for passed args
      // Or handle default if modelArgs is not provided? For now, assume it's required.
      throw new Error(`Model arguments were not provided for generation.`);
  }
  const model = await MODEL_getModel_ai(modelArgs);
  // --- End Use passed modelArgs ---

  const prompt = createFunctionBodyPrompt(unifiedRequest);

  logger.debug(`CORE: Generation Prompt for ${toolRequest.name}:\n${prompt}`);

  logger.prompt(prompt)

  try {
    const { object: generatedDefinition } = await generateObject({
      model: model,
      schema: refinedToolDefinitionSchema, // --- Use the restored schema ---
      prompt: prompt,
      //mode: "json",
      // Pass relevant model settings from modelArgs if needed by generateObject
      temperature: modelArgs.temperature, // Example: pass temperature
      // ...modelArgs, // Avoid spreading potentially incompatible args directly? Check generateObject options.
    });

    logger.info(`CORE: Successfully generated definition & implementation for: ${generatedDefinition.name}`);
    logger.debug("CORE: Generated Object:", generatedDefinition);

    // --- START Validation of generated object ---
    if (!generatedDefinition.implementation || generatedDefinition.implementation.trim() === '') {
        throw new Error("Generated implementation is empty.");
    }
    if (!Array.isArray(generatedDefinition.inputs)) {
        // Attempt fallback if 'inputs' is missing but 'parameters' exists
        if (Array.isArray((generatedDefinition as any).parameters)) {
             logger.warn(`CORE: Generated definition missing 'inputs', using 'parameters' field instead for tool ${generatedDefinition.name}`);
             generatedDefinition.inputs = (generatedDefinition as any).parameters;
        } else {
             throw new Error("Generated 'inputs' field is not an array and 'parameters' fallback is not available/valid.");
        }
    }
    // Validate structure of each input parameter
    generatedDefinition.inputs.forEach((input: any, index: number) => {
        const validationResult = toolParameterSchema.safeParse(input);
        if (!validationResult.success) {
             throw new Error(`Generated input at index ${index} has invalid structure: ${JSON.stringify(input)}. Issues: ${validationResult.error.message}`);
        }
        // Assign validated data back to ensure defaults etc. are applied
        generatedDefinition.inputs[index] = validationResult.data;
    });
    // --- END Validation ---

    return generatedDefinition as RefinedToolDefinition; // Cast after validation

  } catch (error) {
    logger.error(`CORE: Failed to generate definition/implementation for ${toolRequest.name}`, { error });
    if (error instanceof Error) {
        if ((error as any).cause) {
            logger.error("CORE: Generation Error Cause:", (error as any).cause);
        }
        throw new Error(`Failed to generate tool '${toolRequest.name}': ${error.message}`);
    } else {
        throw new Error(`Failed to generate tool '${toolRequest.name}': An unknown error occurred.`);
    }
  }
}


/**
 * Creates and registers a custom tool based on a ToolRequest for a specific user.
 * Uses CORE_generateCustomToolDefinition to generate the implementation and potentially refine the structure.
 *
 * @param toolRequest The request defining the tool.
 * @param userId The ID of the user owning the tool.
 * @param modelArgs - The model arguments for generation.
 * @returns A promise resolving to an object containing success status, message, and potentially the definition.
 */
export async function CORE_createToolFromRequest(
  toolRequest: ToolRequest,
  userId: string, // Removed agentName
  modelArgs: ModelArgs
): Promise<{ success: boolean; message: string; toolRef?: string; toolId?: string; definition?: RefinedToolDefinition; errorDetails?: string }> {
  try {
    logger.info(`CORE: Creating tool from request for user '${userId}': ${toolRequest.name}`);
    const refinedDefinition = await CORE_generateCustomToolDefinition(toolRequest, modelArgs);

    // Prepare generic metadata, removing agentId
    const metadata: { [key: string]: any } = {
        // agentId: agentName, // REMOVED
        userId: userId, // Keep userId in metadata for potential logging/reference consistency
        source: "playground-created",
        createdAt: new Date().toISOString(),
        purpose: toolRequest.purpose,
        expectedOutput: refinedDefinition.expectedOutput,
        originalName: toolRequest.name !== refinedDefinition.name ? toolRequest.name : undefined,
        category: toolRequest.category,
        additionalContext: toolRequest.additionalContext,
    };

    // Register tool for the user
    const toolRef = await ToolRegistry.registerTool(
      userId, // Pass userId directly
      refinedDefinition.name,
      refinedDefinition.description,
      refinedDefinition.inputs,
      refinedDefinition.implementation,
      "function",
      metadata // Pass generic metadata
    );

    const toolId = getCustomToolId(toolRef); // Use helper to extract ID
    logger.tool("CORE: Successfully created and registered tool for user", {
      toolRef,
      toolId,
      name: refinedDefinition.name,
      userId,
    });

    return {
      success: true,
      message: `Tool "${refinedDefinition.name}" created and registered successfully.`,
      toolRef,
      toolId,
      definition: refinedDefinition,
    };

  } catch (error: any) {
    logger.error("CORE: Error creating tool from request", {
      error: error.message || "Unknown error",
      toolName: toolRequest.name,
      userId,
    });
    // Handle unique constraint error specifically
    if (error instanceof Error && error.message.includes("already exists for this user")) {
        return {
            success: false,
            message: error.message, // Use the specific error message
            errorDetails: error.message
        };
    }
    return {
      success: false,
      message: `Error creating tool '${toolRequest.name}': ${error.message || "Unknown error"}`,
      errorDetails: error.message
    };
  }
}

/**
 * Creates multiple tools from an array of ToolRequests for a specific user.
 *
 * @param toolRequests Array of tool requests.
 * @param userId User ID.
 * @returns A promise resolving to an object containing results for each tool.
 */
export async function CORE_createToolsFromRequests(
  toolRequests: ToolRequest[],
  userId: string // Removed agentName
): Promise<Record<string, { success: boolean; message: string; toolRef?: string; toolId?: string; definition?: RefinedToolDefinition }>> {
    const results: Record<string, any> = {};
    for (const request of toolRequests) {
        // Provide default ModelArgs (adjust as needed)
        const defaultModelArgs: ModelArgs = {
            provider: ModelProviderEnum.OPENAI,
            modelName: "gpt-4o", // Ensure this matches your default model identifier if different
            temperature: 0.7
        };
        // Pass userId instead of agentName
        const result = await CORE_createToolFromRequest(request, userId, defaultModelArgs);
        results[request.name] = result;
    }
    return results;
}


// --- Removed Agent-Specific Caching ---
// Remove getAgentToolsRegistry, agentToolsRegistry, __loadedTools declaration
// Remove loadToolsAndBuildRegistry


// CORE_generateDynamicToolWrapper remains useful for ToolFactory, keep it.


// --- Deprecated / Legacy ---

/**
 * @deprecated Prefer CORE_createToolFromRequest for AI generation or ToolRegistry.registerTool for direct registration.
 * Creates a custom tool directly from provided parameters for a specific user.
 */
export async function CORE_createTool(
  // removed agentName
  userId: string,
  textChatLogs: TextChatLogProps[] | null,
  params: any // Consider defining a specific type/schema
) {
  logger.warn("CORE_createTool is deprecated, use CORE_createToolFromRequest or ToolRegistry.registerTool");
   try {
    if (!params.name || !params.description || !params.parameters || !params.functionBody) {
      return {
        success: false,
        message: "Missing required parameters (name, description, parameters, functionBody)"
      };
    }

    const parameters = Array.isArray(params.parameters) ? params.parameters.map((param: any) => ({
      name: param.name, type: param.type, description: param.description,
      required: param.required !== false, default: param.default
    })) : [];

    const paramsValidation = toolParametersSchema.safeParse(parameters);
    if (!paramsValidation.success) {
        return { success: false, message: `Invalid parameters structure: ${paramsValidation.error.message}`};
    }

    // Prepare generic metadata
    const metadata = {
        // agentId: agentName, // REMOVED
        userId: userId, // Keep for reference
        source: "agent-created",
        createdAt: new Date().toISOString(),
        category: params.category
    };

    // Register the tool directly using the user ID
    const toolRef = await ToolRegistry.registerTool(
      userId, // Pass userId directly
      params.name,
      params.description,
      paramsValidation.data,
      params.functionBody,
      "function",
      metadata // Pass generic metadata
    );

    const toolId = getCustomToolId(toolRef);

    logger.tool("Created custom tool (CORE_createTool - deprecated)", {
      toolName: params.name, toolId, userId // Log userId
    });

    if (textChatLogs?.push) {
      textChatLogs.push({
        role: "system",
        message: `Created custom tool "${params.name}" with reference ${toolRef}`,
        // agentName // Removed agentName
      });
    }

    return {
      success: true,
      toolRef: toolRef,
      toolId: toolId,
      message: `Tool ${params.name} created successfully and registered with ID ${toolId}.`
    };
  } catch (error: any) {
    logger.error("Error creating custom tool (CORE_createTool - deprecated)", {
      error: error.message || "Unknown error", toolName: params.name, userId
    });
     if (error instanceof Error && error.message.includes("already exists for this user")) {
        return { success: false, message: error.message };
    }
    return {
      success: false,
      message: `Error creating tool: ${error.message || "Unknown error"}`
    };
  }
}

/**
 * Lists tools for a specific user, optionally filtered by category.
 */
export const CORE_listTools = async (
  // removed agentName
  userId: string,
  textChatLogs: TextChatLogProps[] | null,
  params: { category?: string }
) => {
  const { category } = params;
  logger.tool("CORE: Listing Tools for user", { userId, category: category || "all" });

  if (textChatLogs?.push) {
      textChatLogs.push({
        role: "function", // Or system?
        message: `CORE: Listing custom tools for user ${userId}${category ? ` in category: ${category}` : ''}`,
        // agentName, // Removed agentName
        timestamp: new Date()
      });
  }

  try {
    // Use ToolRegistry to list tools for the specific user
    const toolsList = await ToolRegistry.listAllTools(userId); // Pass userId

    // Filter locally by category if provided
    const filteredTools = category
        ? toolsList.filter(tool => {
            try {
                const meta = tool.metadata ? JSON.parse(tool.metadata) : {};
                return meta.category === category;
            } catch { return false; }
        })
        : toolsList;


    // Map to the expected format
    const formattedTools = filteredTools.map(tool => {
        let parsedMetadata: Record<string, any> = {};
        try {
            if (tool.metadata) parsedMetadata = JSON.parse(tool.metadata);
        } catch (e) {
            logger.warn(`CORE listTools: Failed to parse metadata for tool ${tool.name}`, { metadata: tool.metadata });
        }
        let parsedParameters: ToolParameter[] = [];
        try {
            if (tool.parameters) parsedParameters = JSON.parse(tool.parameters);
            if (!Array.isArray(parsedParameters)) parsedParameters = [];
        } catch (e) {
            logger.warn(`CORE listTools: Failed to parse parameters for tool ${tool.name}`, { parameters: tool.parameters });
        }
        return {
            name: tool.name,
            description: tool.description,
            parameters: parsedParameters,
            category: parsedMetadata?.category || 'DEFAULT',
            id: tool.id
        }
    });

    logger.tool("CORE: Listed Tools Successfully for user", { userId, count: formattedTools.length, category: category || 'all' });
    return JSON.stringify({
      success: true,
      tools: formattedTools
    });
  } catch (error) {
    logger.error("CORE: Listing Tools Failed for user", {
      userId, error: error instanceof Error ? error.message : "Unknown error", category
    });
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : "Failed to list tools"
    });
  }
};


/**
 * Executes a specific custom tool identified by its reference, using ToolFactory.
 */
export const CORE_executeTool = async (
    // removed agentName
    textChatLogs: TextChatLogProps[] | null,
    params: { toolRef: string; toolArgs?: Record<string, any> }
): Promise<any> => {
  const { toolRef, toolArgs = {} } = params;
  const toolNameFromRef = toolRef; // For logging before resolution

  if (!toolRef || !toolRef.includes(':')) {
      logger.error("CORE Execute: Invalid toolRef format", { toolRef });
      return { success: false, error: "Invalid tool reference format. Expected 'type:id'."}; // Return object
  }

  // Check if it's specifically a custom tool ref
  if (!isCustomToolReference(toolRef)) {
      logger.error("CORE Execute: toolRef is not a custom tool reference", { toolRef });
       return { success: false, error: `Reference '${toolRef}' is not a valid custom tool reference.`}; // Return object
  }

  logger.tool("CORE Execute: Attempting execution", { toolRef, args: JSON.stringify(toolArgs) });

  if (textChatLogs?.push) {
    textChatLogs.push({
      role: "function",
      message: `CORE: Executing custom tool: "${toolRef}"`,
      // agentName, // Removed agentName
      timestamp: new Date()
    });
  }

  try {
    // 1. Get tool ID from reference
    const toolId = getCustomToolId(toolRef);
    if (!toolId) {
        throw new Error(`Could not extract tool ID from reference: ${toolRef}`);
    }

    // 2. Fetch tool definition directly from the registry using ID
    const toolEntry = await ToolRegistry.getToolById(toolId);
    if (!toolEntry) {
      throw new Error(`Custom tool with reference ${toolRef} (ID: ${toolId}) not found.`);
    }
    const toolName = toolEntry.name; // Get name from the entry

    // 3. Build the executable tool using ToolFactory
    const toolObject = ToolFactory.buildTool(toolEntry);
    const executableTool = toolObject[toolName]; // Extract the ai.tool object

    if (!executableTool || typeof executableTool.execute !== 'function') {
      logger.error("CORE Execute: Failed to build executable tool object", { toolRef, toolName });
      throw new Error(`Failed to build executable tool '${toolName}' from definition.`);
    }

    // 4. Execute the tool
    logger.tool(`CORE Execute: Calling execute on tool '${toolName}' (Ref: ${toolRef})`);
    const result = await executableTool.execute(toolArgs);

    logger.tool(`CORE Execute: Execution complete for '${toolName}'`, { success: !(result?._isToolError === true) });

    // Return result (could be success data or the structured error from the wrapper)
    return result; // Return the object directly

  } catch (error) {
    logger.error("CORE Execute: Execution Failed", {
      toolRef,
      toolName: toolNameFromRef,
      error: error instanceof Error ? error.message : "Unknown error"
    });
    // Return a structured error object
    return {
      success: false,
      _isToolError: true, // Consistent error flag
      error: `Failed to execute tool "${toolNameFromRef}": ${error instanceof Error ? error.message : "Unknown error"}`
    };
  }
};