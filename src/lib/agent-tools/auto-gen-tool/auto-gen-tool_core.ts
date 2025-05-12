'use server';

import { z } from "zod";
import { Prisma } from "@prisma/client"; // Import Prisma for error handling
import { TextChatLogProps } from "../../text-chat-log";
import { logger } from "@/src/lib/logger";
import { tool, generateObject } from "ai"; // ** Import generateObject **
import {
    ToolParameter,
    CustomToolDefinition,
    UTILS_buildParameterSchema
} from "./tool-generator";
// import { generateObject } from "ai"; // Duplicate removed
import { MODEL_getModel_ai } from "@/src/lib/vercelAI-model-switcher"; // ** Keep this **
import { ModelArgs, ModelProviderEnum, ToolRequest } from "@/src/lib/types"; // Consolidated imports
import { ensureUnifiedToolRequest } from "@/src/lib/agent-tools/auto-gen-tool/tool-request-adapter";
import { ToolRegistry } from "../tool-registry/registry";
import { createCustomToolReference, getCustomToolId, isCustomToolReference } from "../tool-registry/custom-tool-ref";
import { ToolFactory } from "../tool-registry/factory"; // Import ToolFactory
// ** Removed unused UTILS_callLargeLanguageModel import **

// Import StrategyAnalysis type (adjust path as needed)
import { AnalysisResult, PreliminaryResearchIdentifiers } from '../../../app/api/playground/analyze-implementation-strategy/_types';

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
    implementation: z.string().min(1).describe("The generated JavaScript/TypeScript function body code (as a string) OR the API configuration JSON (as a string). MUST NOT be empty."),
    implementationType: z.enum(["api", "function"]).describe("The type of implementation: 'api' for an API configuration JSON, 'function' for a JavaScript/TypeScript arrow function."),
    requiredCredentialNames: z.array(z.object({
        name: z.string().describe("The environment variable style name for the credential, e.g., SERVICE_API_KEY"),
        label: z.string().describe("A user-friendly label for the credential, e.g., Service API Key")
    })).optional().describe("An array of objects detailing required credentials for the tool, if any."),
}).describe("The complete, potentially refined tool definition including the implementation code.");
type RefinedToolDefinition = z.infer<typeof refinedToolDefinitionSchema>;


// --- Core Logic Functions ---

// ** Removed unused createFunctionBodyPrompt function **

/**
 * Generates a custom tool definition, including the function implementation,
 * based on a detailed request using the XML-style prompt and generateObject.
 *
 * @param toolRequest - The detailed request for the tool.
 * @param modelArgs - The model arguments for generation.
 * @param acceptedStrategy - The accepted strategy for generation.
 * @returns A promise resolving to the refined tool definition including implementation.
 * @throws Throws an error if generation fails.
 */
export async function CORE_generateCustomToolDefinition(
  toolRequest: ToolRequest,
  modelArgs: ModelArgs,
  acceptedStrategy?: AnalysisResult | null // <-- Changed type to AnalysisResult
): Promise<RefinedToolDefinition> {
  logger.info(`CORE: Generating definition & implementation for: ${toolRequest.name} using model ${modelArgs.modelName}`);
  if (acceptedStrategy) {
    logger.info(`CORE: Using accepted strategy - Type: ${acceptedStrategy.recommendedType}`);
  }

  // Ensure the request is in the unified format (optional, depends on if you need adapter)
  // const unifiedRequest = await ensureUnifiedToolRequest(toolRequest);
  const request = toolRequest; // Using toolRequest directly if adapter is not needed here

  // --- Input Validation ---
  if (!request || !request.name || !request.description || !request.inputs || !request.expectedOutput) {
        logger.error("CORE: Invalid ToolRequest received in CORE_generateCustomToolDefinition", { request });
        throw new Error("Invalid ToolRequest: Missing required fields (name, description, inputs, expectedOutput).");
    }
    if (!modelArgs || !modelArgs.modelName || !modelArgs.provider) {
         logger.error("CORE: Invalid ModelArgs received in CORE_generateCustomToolDefinition", { modelArgs });
        throw new Error("Invalid ModelArgs: Missing required fields (modelName, provider).");
    }
  // --- End Input Validation ---

  // --- Prepare Prompt Components ---
  const parametersString = request.inputs.length > 0
        ? request.inputs.map(p => `- ${p.name} (${p.type}): ${p.description}${p.required === false ? ' (optional)' : ''}${p.default !== undefined ? ` (default: ${JSON.stringify(p.default)})` : ''}`).join('\n')
        : '  (No input parameters defined)';

  // --- Accepted Strategy String for Prompt ---
  let acceptedStrategyString = '(No specific strategy pre-defined, rely on tool details and modification requests.)';
  if (acceptedStrategy) {
    const prelimFindingsStr = acceptedStrategy.preliminaryFindings ? `\n*   **Preliminary Findings:** ${acceptedStrategy.preliminaryFindings}` : "";
    const credNameStr = acceptedStrategy.requiredCredentialName ? `\n*   **Required Credential Name (from strategy):** ${acceptedStrategy.requiredCredentialName}` : "";
    const warningsStr = acceptedStrategy.warnings && acceptedStrategy.warnings.length > 0 ? `\n*   **Warnings:** ${acceptedStrategy.warnings.join('; ')}` : "\n*   **Warnings:** None";
    
    acceptedStrategyString = `
*   **Recommended Type:** ${acceptedStrategy.recommendedType}
*   **Strategy Details:** ${acceptedStrategy.strategyDetails}${warningsStr}${credNameStr}${prelimFindingsStr}
    `.trim();
  }

  // --- XML-Style System Prompt ---
  const systemPrompt = `
You are an expert JavaScript/TypeScript developer tasked with creating OR MODIFYING the function body and structure for a custom tool.
Your goal is to generate a robust, efficient, and correct standalone async function implementation and a refined tool definition based ONLY on the provided details.

<instructions>
1.  **Understand Context:** Review all provided information: \`<tool_details>\`, \`<accepted_strategy>\` (if available), \`<current_implementation>\` (if available), and any \`<modification_requests>\`.
    *   **CRITICAL: If \`<accepted_strategy>\` is provided, it is the PRIMARY GUIDE for your implementation approach and structural decisions.** Adhere to its \`recommendedType\`. Use its \`strategyDetails\` (like API endpoints or suggested helper functions) and heed its \`warnings\`.

2.  **Determine Implementation Type:**
    *   Based on the strategy (especially \`recommendedType\`) or the nature of the tool request, decide if this is an 'api' tool or a 'function' tool.
    *   If the tool is an API integration (based on strategy or requirements), follow the API Implementation Guidelines in point 3. Your \`implementationType\` output MUST be "api".
    *   If the tool requires custom logic or non-API functionality, follow the Function Implementation Guidelines in point 4. Your \`implementationType\` output MUST be "function".

3.  **API Implementation Guidelines:**
    *   For API tools, the implementation field MUST be a JSON string containing the API configuration:
    \`\`\`json
    {
      "endpoint": "https://api.example.com/endpoint",
      "method": "GET|POST|PUT|DELETE",
      "parameterMapping": {
        "query": {
          "apiParam": "toolInput",
          "limit": "maxResults"
        },
        "body": {
          "apiParam": "toolInput",
          "limit": "maxResults"
        }
      }
    }
    \`\`\`
    *   The \`parameterMapping\` object defines how tool input parameters map to API parameters:
      - For GET requests, parameters will be mapped to query parameters
      - For other methods, parameters will be mapped to the request body
      - Each mapping entry specifies how a tool input parameter maps to an API parameter
    *   Example API tool definition with parameter mapping:
    \`\`\`json
    {
      "name": "Search API Tool",
      "description": "Searches the API for matching items",
      "inputs": [
        {
          "name": "searchQuery",
          "type": "string",
          "description": "The search query string",
          "required": true
        },
        {
          "name": "maxResults",
          "type": "number",
          "description": "Maximum number of results to return",
          "required": false,
          "default": 10
        }
      ],
      "expectedOutput": "Returns search results as JSON",
      "implementationType": "api",
      "implementation": "{\\"endpoint\\": \\"https://api.example.com/search\\", \\"method\\": \\"GET\\", \\"parameterMapping\\": {\\"query\\": {\\"q\\": \\"searchQuery\\", \\"limit\\": \\"maxResults\\"}}}"
    }
    \`\`\`
    *   If authentication is required:
      - Add the credential name to the \`requiredCredentialNames\` array in your tool definition
      - The system will automatically handle authentication using the stored credentials
    *   The tool execution system will automatically handle:
      - Authentication using stored credentials
      - Request/response content type handling
      - Error handling and status codes
      - Response parsing (JSON, text, binary)
      - Default timeout of 30 seconds
      - Parameter mapping between tool inputs and API parameters

4.  **Function Implementation Guidelines:**
    *   For non-API tools, write the complete JavaScript/TypeScript async function body.
    *   If '<current_implementation>' is provided, use it as your starting point. Apply necessary changes based on the tool details, accepted strategy, and modification requests.
    *   If no '<current_implementation>' is provided, generate the function body from scratch.
    *   **FORMAT:** The implementation MUST be an asynchronous arrow function expression: \`async ({ param1, param2 }) => { ...body... }\`. It must accept a single object argument destructuring the parameters you define in the final \`inputs\` array of your response.
    *   Use standard Node.js built-in modules ONLY if absolutely necessary. AVOID external libraries unless explicitly requested or indicated as allowed in '<additional_context>' or '<accepted_strategy>' (e.g., for specific helper functions).
    *   Import allowed helpers if needed (e.g., \`const { executeFirecrawlScrape } = await import('@/src/lib/agent-tools/helpers/web-scraping');\`). Check '<additional_context>' and '<accepted_strategy>' for these.
    *   Include robust error handling (try/catch blocks) within the arrow function body. Return a value matching the 'Expected Output' description. On failure, return \`{ success: false, error: 'message' }\`.
    *   Example function implementation:
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

5.  **Refine Tool Definition (VERY IMPORTANT):**
    *   Based on the '<tool_details>', '<modification_requests>', AND ESPECIALLY the '<accepted_strategy>' (if provided), you MUST review and potentially refine the tool's structural elements: 'name', 'description', 'inputs', 'expectedOutput', 'implementationType', and 'requiredCredentialNames'.
    *   **Inputs:** Ensure parameter names, types, descriptions, required status, and default values are appropriate for the chosen implementation.
    *   **Expected Output:** The description should accurately reflect what the generated implementation will return, considering the strategy.
    *   **Implementation Type:** You MUST set the 'implementationType' field to either "api" or "function" based on your decision in step 2.
    *   **Required Credential Names:** If the strategy or your implementation logic identifies a need for credentials (e.g., API keys, tokens), populate the 'requiredCredentialNames' array in your JSON output. Each item should be an object like \`{ "name": "SERVICE_API_KEY", "label": "Service API Key" }\`. Use the specific credential name from the strategy if provided, or a generic one if you infer it.
    *   The final tool definition you output in JSON (name, description, inputs, expectedOutput, implementation, implementationType, requiredCredentialNames) MUST be consistent.

6.  **Output Format:** Respond ONLY with a single JSON object matching the required schema (${JSON.stringify(refinedToolDefinitionSchema.shape, null, 2)}). This object must contain the potentially refined 'name', 'description', 'inputs', 'expectedOutput', 'implementation', 'implementationType', and 'requiredCredentialNames'.
</instructions>

<constraint_checklist>
1. Implementation type correctly determined (API vs Function)? Yes
2. Is the 'implementationType' field in the output JSON correctly set to "api" or "function"? Yes
3. For API tools, included proper configuration JSON in 'implementation'? Yes/NA
4. For Function tools, implementation is an async arrow function in 'implementation'? Yes/NA
5. Returned data structure matches expected output description? Yes
6. Handled potential errors appropriately? Yes
7. Avoided external libraries (unless explicitly requested/allowed)? Yes
8. If modifying, based changes on Current Implementation? Yes/No/NA
9. Added required credentials to requiredCredentialNames? Yes/NA
10. Confidence Score (1-5): [Score]
</constraint_checklist>

--- TOOL INFORMATION FOLLOWS ---

<tool_details>
*   **Name:** ${request.name}
*   **Description:** ${request.description}
*   **Purpose:** ${request.purpose || request.description}
*   **Input Parameters (Initial):**
${parametersString}
*   **Expected Output (Initial):** ${request.expectedOutput}
</tool_details>

<accepted_strategy>
${acceptedStrategyString}
</accepted_strategy>

${request.additionalContext ? `<additional_context>\n${request.additionalContext}\n</additional_context>` : ''}

<current_implementation>
${request.implementation ? `\`\`\`javascript\n${request.implementation}\n\`\`\`` : '(None provided - generate from scratch)'}
</current_implementation>

${request.modificationRequests && request.modificationRequests.length > 0 ? `<modification_requests>\n*   ${request.modificationRequests.join('\n*   ')}\n</modification_requests>` : ''}

Provide ONLY the JSON output matching the schema.
`;
  // --- End XML-Style System Prompt ---

  logger.debug(`CORE: Generation Prompt for ${request.name}`);
  // logger.prompt(systemPrompt) // Optional: Log full prompt if needed for debugging

  try {
    // Get the Vercel AI SDK model object
    const model = await MODEL_getModel_ai(modelArgs);

    // Call generateObject using the consistent pattern
    const { object: generatedDefinition } = await generateObject({
      model: model,
      schema: refinedToolDefinitionSchema, // Use the Zod schema for the output
      prompt: systemPrompt, // Pass the full prompt
      // Note: Depending on the provider/model, 'prompt' might be used,
      // or you might need to separate into 'system' and 'prompt'/'user'
      // Adjust based on MODEL_getModel_ai and generateObject behavior
      temperature: modelArgs.temperature, // Pass temperature
      // Add other relevant modelArgs if supported by generateObject and the model
      // maxTokens: modelArgs.maxOutputTokens, // Example
    });

    logger.info(`CORE: Successfully generated definition & implementation for: ${generatedDefinition.name}`);
    logger.debug("CORE: Generated Object:", generatedDefinition);

    // --- START Validation of generated object ---
    // Basic validation (can enhance further)
    if (!generatedDefinition.implementation || generatedDefinition.implementation.trim() === '') {
        throw new Error("Generated implementation is empty.");
    }
    if (generatedDefinition.implementationType !== "api" && generatedDefinition.implementationType !== "function") {
        throw new Error(`Generated implementationType is invalid: ${generatedDefinition.implementationType}. Must be "api" or "function".`);
    }
    if (!Array.isArray(generatedDefinition.inputs)) {
        throw new Error("Generated 'inputs' field is not an array.");
    }
    // Validate structure of each input parameter using Zod schema
    generatedDefinition.inputs.forEach((input: any, index: number) => {
        const validationResult = toolParameterSchema.safeParse(input);
        if (!validationResult.success) {
             throw new Error(`Generated input at index ${index} has invalid structure: ${JSON.stringify(input)}. Issues: ${validationResult.error.message}`);
        }
        // Assign validated data back to ensure defaults etc. are applied
        generatedDefinition.inputs[index] = validationResult.data;
    });
    // --- END Validation ---

    // Cast is safe here after successful parsing and validation against the schema
    return generatedDefinition as RefinedToolDefinition;

  } catch (error) {
    logger.error(`CORE: Failed to generate definition/implementation for ${request.name}`, {
        error: error instanceof Error ? error.message : String(error),
        modelArgs: modelArgs // Log args used during failure
    });
    if (error instanceof Error) {
        if ((error as any).cause) {
            logger.error("CORE: Generation Error Cause:", (error as any).cause);
        }
        // Re-throw a more specific error message
        throw new Error(`Failed to generate tool '${request.name}' using model ${modelArgs.modelName}: ${error.message}`);
    } else {
        throw new Error(`Failed to generate tool '${request.name}' using model ${modelArgs.modelName}: An unknown error occurred.`);
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
  userId: string,
  modelArgs: ModelArgs
): Promise<{ success: boolean; message: string; toolRef?: string; toolId?: string; definition?: RefinedToolDefinition; errorDetails?: string }> {
  try {
    logger.info(`CORE: Creating tool from request for user '${userId}': ${toolRequest.name}`);
    const refinedDefinition = await CORE_generateCustomToolDefinition(toolRequest, modelArgs);

    // Prepare generic metadata
    const metadata: { [key: string]: any } = {
        userId: userId,
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
      userId,
      refinedDefinition.name,
      refinedDefinition.description,
      refinedDefinition.inputs, // Pass the potentially refined inputs
      refinedDefinition.implementation,
      refinedDefinition.implementationType, // Pass the determined implementationType
      metadata,
      toolRequest.acceptedStrategy ? JSON.stringify(toolRequest.acceptedStrategy) : null // Stringify acceptedStrategy
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
            message: error.message,
            errorDetails: error.message
        };
    }
    // Handle potential Prisma-related errors during registration if needed
    // if (error instanceof Prisma.PrismaClientKnownRequestError) { ... }

    // General error return
    return {
      success: false,
      message: `Error creating tool '${toolRequest.name}': ${error.message || "Unknown error"}`,
      errorDetails: error.message // Provide error details for frontend if helpful
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
  userId: string
): Promise<Record<string, { success: boolean; message: string; toolRef?: string; toolId?: string; definition?: RefinedToolDefinition }>> {
    const results: Record<string, any> = {};
    for (const request of toolRequests) {
        // Provide default ModelArgs (adjust as needed or ensure they are passed in)
        const defaultModelArgs: ModelArgs = {
            provider: ModelProviderEnum.OPENAI,
            modelName: "gpt-4o", // Or your preferred default
            temperature: 0.7
        };
        // Ensure acceptedStrategy is correctly passed; assuming it's part of ToolRequest
        const result = await CORE_createToolFromRequest(request, userId, defaultModelArgs);
        results[request.name] = result;
    }
    return results;
}


// --- Removed Agent-Specific Caching ---


// CORE_generateDynamicToolWrapper remains useful for ToolFactory, keep it.
// ** This function seems missing from previous versions, but let's assume it exists **
// ** or should be added if ToolFactory depends on it. Add placeholder if needed. **
/*
export function CORE_generateDynamicToolWrapper(implementationCode: string, parametersSchema: z.ZodObject<any, any>): (args: any) => Promise<any> {
    // Implementation to evaluate the code string and create the execution wrapper
    // Be extremely careful with eval or similar approaches due to security risks.
    // Consider using safer alternatives like vm2 if possible.
    logger.warn("CORE_generateDynamicToolWrapper: Using dynamic code execution. Ensure security measures are in place.");
    // Placeholder implementation:
    try {
        // This is a simplified and potentially insecure example.
        // You'll need a robust and secure way to execute this code.
        const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
        const toolFunction = new AsyncFunction('args', `
            const toolLogic = ${implementationCode};
            return toolLogic(args);
        `);

        return async (args: any) => {
            // Validate args against parametersSchema before executing
            const validatedArgs = parametersSchema.parse(args);
            return await toolFunction(validatedArgs);
        };
    } catch (error) {
        logger.error("Failed to generate dynamic tool wrapper", { error });
        throw new Error("Failed to create executable tool function from implementation code.");
    }
}
*/


// --- Deprecated / Legacy ---

/**
 * @deprecated Prefer CORE_createToolFromRequest for AI generation or ToolRegistry.registerTool for direct registration.
 * Creates a custom tool directly from provided parameters for a specific user.
 */
export async function CORE_createTool(
  userId: string,
  textChatLogs: TextChatLogProps[] | null,
  params: any // Consider defining a specific type/schema
) {
  logger.warn("CORE_createTool is deprecated, use CORE_createToolFromRequest or ToolRegistry.registerTool");
   try {
    // Basic validation for required fields in params
    const requiredFields = ['name', 'description', 'parameters', 'functionBody'];
    for (const field of requiredFields) {
        if (!params[field]) {
            return { success: false, message: `Missing required parameter: ${field}` };
        }
    }
    if (!Array.isArray(params.parameters)) {
         return { success: false, message: "Parameter 'parameters' must be an array." };
    }


    const parameters = params.parameters.map((param: any) => ({
      name: param.name, type: param.type, description: param.description,
      required: param.required !== false, default: param.default
    }));

    const paramsValidation = toolParametersSchema.safeParse(parameters);
    if (!paramsValidation.success) {
        return { success: false, message: `Invalid parameters structure: ${paramsValidation.error.message}`};
    }

    // Prepare generic metadata
    const metadata = {
        userId: userId,
        source: "agent-created-deprecated", // Indicate source
        createdAt: new Date().toISOString(),
        category: params.category
    };

    // Register the tool directly using the user ID
    const toolRef = await ToolRegistry.registerTool(
      userId,
      params.name,
      params.description,
      paramsValidation.data, // Use validated data
      params.functionBody,
      "function",
      metadata
    );

    const toolId = getCustomToolId(toolRef);

    logger.tool("Created custom tool (CORE_createTool - deprecated)", {
      toolName: params.name, toolId, userId
    });

    if (textChatLogs?.push) {
      textChatLogs.push({
        role: "system",
        message: `Created custom tool (deprecated method) "${params.name}" with reference ${toolRef}`,
      });
    }

    return {
      success: true,
      toolRef: toolRef,
      toolId: toolId,
      message: `Tool ${params.name} created successfully (using deprecated method) and registered with ID ${toolId}.`
    };
  } catch (error: any) {
    logger.error("Error creating custom tool (CORE_createTool - deprecated)", {
      error: error.message || "Unknown error", toolName: params?.name || 'Unknown', userId
    });
     if (error instanceof Error && error.message.includes("already exists for this user")) {
        return { success: false, message: error.message };
    }
     // Catch potential Prisma errors during registration
     if (error instanceof Prisma.PrismaClientKnownRequestError) {
         // Log specific Prisma error code if helpful
         logger.error("Prisma Error during deprecated tool creation", { code: error.code });
         return { success: false, message: `Database error during tool creation: ${error.message}` };
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
  userId: string,
  textChatLogs: TextChatLogProps[] | null,
  params: { category?: string }
) => {
  const { category } = params;
  logger.tool("CORE: Listing Tools for user", { userId, category: category || "all" });

  if (textChatLogs?.push) {
      textChatLogs.push({
        role: "system", // More appropriate than 'function' for internal logging
        message: `CORE: Listing custom tools for user ${userId}${category ? ` in category: ${category}` : ''}`,
        timestamp: new Date()
      });
  }

  try {
    // Use ToolRegistry to list tools for the specific user
    const toolsList = await ToolRegistry.listAllTools(userId);

    // Filter locally by category if provided
    const filteredTools = category
        ? toolsList.filter(tool => {
            try {
                // Safely parse metadata
                const meta = tool.metadata ? JSON.parse(tool.metadata) : {};
                return meta.category === category;
            } catch(e) {
                logger.warn(`CORE listTools: Failed to parse metadata for tool ID ${tool.id}`, { metadata: tool.metadata, error: e });
                return false;
             }
        })
        : toolsList;


    // Map to the expected format, ensuring parameters are parsed safely
    const formattedTools = filteredTools.map(tool => {
        let parsedMetadata: Record<string, any> = {};
        try {
            if (tool.metadata) parsedMetadata = JSON.parse(tool.metadata);
        } catch (e) {
            logger.warn(`CORE listTools: Failed to parse metadata again for tool ID ${tool.id}`, { metadata: tool.metadata });
        }
        let parsedParameters: ToolParameter[] = [];
        try {
            if (tool.parameters) {
                const parsed = JSON.parse(tool.parameters);
                 // Validate that parsed is an array of objects matching the schema
                const validationResult = toolParametersSchema.safeParse(parsed);
                if (validationResult.success) {
                    parsedParameters = validationResult.data;
                } else {
                    logger.warn(`CORE listTools: Parsed parameters for tool ID ${tool.id} failed schema validation`, { parameters: tool.parameters, error: validationResult.error });
                }
            }
        } catch (e) {
            logger.warn(`CORE listTools: Failed to parse parameters JSON for tool ID ${tool.id}`, { parameters: tool.parameters, error: e });
        }
        return {
            name: tool.name,
            description: tool.description,
            parameters: parsedParameters, // Use safely parsed parameters
            category: parsedMetadata?.category || 'DEFAULT', // Provide default category
            id: tool.id,
            reference: createCustomToolReference(tool.id) // Include reference
        }
    });

    logger.tool("CORE: Listed Tools Successfully for user", { userId, count: formattedTools.length, category: category || 'all' });
    return JSON.stringify({ // Return JSON string as before if required by caller
      success: true,
      tools: formattedTools
    });
  } catch (error) {
    logger.error("CORE: Listing Tools Failed for user", {
      userId, error: error instanceof Error ? error.message : "Unknown error", category
    });
    return JSON.stringify({ // Return JSON string as before if required by caller
      success: false,
      error: error instanceof Error ? error.message : "Failed to list tools"
    });
  }
};


/**
 * Executes a specific custom tool identified by its reference, using ToolFactory.
 */
export const CORE_executeTool = async (
    textChatLogs: TextChatLogProps[] | null,
    params: { toolRef: string; toolArgs?: Record<string, any> }
): Promise<any> => {
  const { toolRef, toolArgs = {} } = params;
  let toolNameForLogging = toolRef; // Initial value for logging

  if (!toolRef || typeof toolRef !== 'string' || !toolRef.includes(':')) {
      logger.error("CORE Execute: Invalid toolRef format", { toolRef });
      return { success: false, _isToolError: true, error: "Invalid tool reference format. Expected 'type:id'."};
  }

  // Check if it's specifically a custom tool ref
  if (!isCustomToolReference(toolRef)) {
      logger.error("CORE Execute: toolRef is not a custom tool reference", { toolRef });
       return { success: false, _isToolError: true, error: `Reference '${toolRef}' is not a valid custom tool reference.`};
  }

  logger.tool("CORE Execute: Attempting execution", { toolRef, args: toolArgs }); // Log args directly

  if (textChatLogs?.push) {
    textChatLogs.push({
      role: "system", // More appropriate than 'function'
      message: `CORE: Executing custom tool: "${toolRef}"`,
      timestamp: new Date()
    });
  }

  try {
    // 1. Get tool ID from reference
    const toolId = getCustomToolId(toolRef);
    if (!toolId) {
        // This case should ideally be caught by isCustomToolReference, but check again
        throw new Error(`Could not extract tool ID from reference: ${toolRef}`);
    }

    // 2. Fetch tool definition directly from the registry using ID
    const toolEntry = await ToolRegistry.getToolById(toolId);
    if (!toolEntry) {
      throw new Error(`Custom tool with reference ${toolRef} (ID: ${toolId}) not found in registry.`);
    }
    toolNameForLogging = toolEntry.name; // Update name for logging

    // 3. Build the executable tool using ToolFactory
    const toolObject = ToolFactory.buildTool(toolEntry);
    const executableTool = toolObject[toolNameForLogging]; // Extract the ai.tool object

    if (!executableTool || typeof executableTool.execute !== 'function') {
      logger.error("CORE Execute: Failed to build executable tool object from factory", { toolRef, toolName: toolNameForLogging });
      throw new Error(`Failed to build executable tool '${toolNameForLogging}' from definition.`);
    }

    // 4. Execute the tool
    logger.tool(`CORE Execute: Calling execute on tool '${toolNameForLogging}' (Ref: ${toolRef})`);
    const result = await executableTool.execute(toolArgs);
    // The result here might already contain { success: boolean, ... } if the tool implementation follows that pattern
    // Or it might be the raw return value, or an error thrown by the implementation.
    // The wrapper in ToolFactory likely handles errors thrown by the implementation.

    logger.tool(`CORE Execute: Execution complete for '${toolNameForLogging}'`, { success: !(result?._isToolError === true), hasResult: result !== undefined });

    // Return result (could be success data or the structured error from the wrapper)
    return result; // Return the object/value directly

  } catch (error) {
    // This catch block handles errors *outside* the tool's own try/catch,
    // e.g., tool not found, factory build failure, potentially errors during execute if not caught by wrapper.
    logger.error("CORE Execute: Execution Failed", {
      toolRef,
      toolName: toolNameForLogging,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined
    });
    // Return a structured error object
    return {
      success: false,
      _isToolError: true, // Consistent error flag
      error: `Failed to execute tool "${toolNameForLogging}": ${error instanceof Error ? error.message : "Unknown error"}`
    };
  }
};