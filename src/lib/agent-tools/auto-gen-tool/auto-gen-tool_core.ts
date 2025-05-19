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
import { ModelArgs, ModelProviderEnum, ToolRequest, ToolInputParameter } from "@/src/lib/types"; // Consolidated imports
import { ensureUnifiedToolRequest } from "@/src/lib/agent-tools/auto-gen-tool/tool-request-adapter";
import { ToolRegistry } from "../tool-registry/registry";
import { createCustomToolReference, getCustomToolId, isCustomToolReference } from "../tool-registry/custom-tool-ref";
import { ToolFactory } from "../tool-registry/factory"; // Import ToolFactory
// ** Removed unused UTILS_callLargeLanguageModel import **

// Import StrategyAnalysis type (adjust path as needed)
import { AnalysisResult, RecommendedImplementationType } from '../../../app/api/playground/analyze-implementation-strategy/_types';
import { SourceFindingStrategyType, ScrapingToolImplementationConfig, ScrapingActionType } from '../custom-scraper/types'; // Import scraping types
// ADDED IMPORT for the scraping config Zod schema
import { scrapingToolImplementationConfigSchema } from '../custom-scraper/validator';
import { autoGenToolPrompts } from "./auto-gen-prompts";

// --- Zod Schemas (Reverted to array-based inputs) ---
const toolParameterSchema = z.object({
  name: z.string().describe("Parameter name (snake_case)"),
  type: z.enum(["string", "number", "boolean", "array", "object"]).describe("Parameter data type"),
  description: z.string().describe("Parameter description"),
  required: z.boolean().optional().default(true).describe("Is the parameter required?"),
  default: z.any().optional().describe("Optional default value"),
}).describe("Schema for a single tool parameter.");

const toolParametersSchema = z.array(toolParameterSchema).describe("List of input parameters for a tool.");

const scrapingToolImplementationConfigPromptSchemaShape = {
  baseDomain: "string (e.g., 'https://example.com' - Mandatory, MUST include http:// or https://)",
  toolPurposeDescription: "string (e.g., 'Scrapes product details from Example.com')",
  sourceFinderConfig: {
      enabledStrategies: "Array of SourceFindingStrategyType strings",
      urlPatterns: "Array of strings (optional, use {placeholders})",
      siteSearch: {
          searchEngineCx: "string (optional)",
          searchKeywordsTemplate: "string (optional, use {placeholders})"
      },
      sitemap: {
          sitemapUrl: "string (optional)"
      },
      webSearch: {
          searchProvider: "string (optional)",
          searchKeywordsTemplate: "string (optional, use {placeholders})"
      },
      llmNavigation: {
          navigationPrompt: "string (optional)"
      },
      description: "object: How to find the source page/URL."
  },
  authConfig: {
      method: "string (AuthMethod enum: 'none', 'form', etc.)",
      loginUrl: "string (optional)",
      usernameField: "string (optional, CSS selector)",
      passwordField: "string (optional, CSS selector)",
      submitButtonSelector: "string (optional, CSS selector, e.g., 'button[type=\"submit\"]')",
      apiKeyHeaderName: "string (optional)",
      apiKeyPlacement: "string ('header' or 'query', optional)",
      apiQueryParamName: "string (optional)",
      requiredCredentialNames: "Array of {name: string, label: string} (optional)",
      description: "object: Authentication details."
  },
  scrapingMethodsConfig: {
      preferredMethod: "string (ScrapingMethodType enum: 'firecrawl', etc.)",
      firecrawl: {
          mode: "string ('scrape' or 'crawl', optional)",
          pageOptions: "object (optional, Firecrawl page options)",
          extractorOptions: {
               extractionPrompt: "string (optional, LLM prompt, use {placeholders})",
               extractionSchema: "object (optional, JSON schema for LLM)",
               mode: "string ('llm-extraction', 'markdown', etc., optional)"
          },
          crawlerOptions: "object (optional, Firecrawl crawler options)"
      },
      visual: "object (optional, TBD)",
      directHttpFetch: {
          method: "string ('GET', 'POST', etc., optional)",
          headers: "object (optional)",
          body: "object or string (optional)"
      },
      description: "object: Scraping method configurations."
  },
  // dataExtractionChain: "Array of {actionType: string (ScrapingActionType enum), ...} (REQUIRED)" // Temporarily commented out for debugging
};

const apiImplementationSchema = z.object({
    implementationType: z.literal('api'),
    implementation: z.string().min(1).describe("The API configuration JSON (as a string)."),
    name: z.string().describe("The final, potentially refined, tool name."),
    description: z.string().describe("The final, potentially refined, tool description."),
    inputs: toolParametersSchema,
    expectedOutput: z.string().describe("The final, potentially refined, description of the expected output (usually string from API response)."),
    requiredCredentialNames: z.array(z.object({
        name: z.string().describe("The environment variable style name for the credential, e.g., SERVICE_API_KEY"),
        label: z.string().describe("A user-friendly label for the credential, e.g., Service API Key")
    })).optional().describe("An array of objects detailing required credentials for the tool (API keys), if any."),
});

const functionImplementationSchema = z.object({
    implementationType: z.literal('function'),
    implementation: z.string().min(1).describe("The JavaScript/TypeScript function body code (as a string)."),
    name: z.string().describe("The final, potentially refined, tool name."),
    description: z.string().describe("The final, potentially refined, tool description."),
    inputs: toolParametersSchema,
    expectedOutput: z.string().describe("The final, potentially refined, description of the expected output (usually a string from function return)."),
    requiredCredentialNames: z.array(z.object({
        name: z.string().describe("The environment variable style name for the credential"),
        label: z.string().describe("A user-friendly label for the credential")
    })).optional().describe("An array of objects detailing required credentials, if any (less common for direct functions)."),
});

const scrapingImplementationSchema = z.object({
    implementationType: z.literal('scraping'),
    implementation: scrapingToolImplementationConfigSchema.describe("The Scraping configuration JSON (as an object, not a string). This object must conform to the ScrapingToolImplementationConfig structure."),
    name: z.string().describe("The final, potentially refined, tool name."),
    description: z.string().describe("The final, potentially refined, tool description."),
    inputs: toolParametersSchema,
    expectedOutput: z.string().describe("The final, potentially refined, description of the expected output (usually a string containing the scraped information)."),
    requiredCredentialNames: z.array(z.object({
        name: z.string().describe("The environment variable style name for the credential, e.g., TARGETSITE_USERNAME"),
        label: z.string().describe("A user-friendly label for the credential, e.g., Target Site Username")
    })).optional().describe("An array of objects detailing required credentials for scraping (e.g., login credentials), if any."),
});

const refinedToolDefinitionSchema = z.discriminatedUnion("implementationType", [
    apiImplementationSchema,
    functionImplementationSchema,
    scrapingImplementationSchema
]).describe("The complete, potentially refined tool definition including the implementation details.");

// Wrapper schema for OpenAI compatibility
const wrappedRefinedToolDefinitionSchema = z.object({
    toolDefinition: refinedToolDefinitionSchema
}).describe("Wrapper for the tool definition to ensure OpenAI compatibility.");

type RefinedToolDefinition = z.infer<typeof refinedToolDefinitionSchema>;


// --- Core Logic Functions ---

/**
 * Generates a custom tool definition, including the implementation details (code or config),
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
  acceptedStrategy?: AnalysisResult | null
): Promise<RefinedToolDefinition> {
  logger.info(`CORE: Generating definition & implementation for: ${toolRequest.name} using model ${modelArgs.modelName}`);
  let strategyType = "unknown";
  if (acceptedStrategy) {
    strategyType = acceptedStrategy.recommendedType;
    logger.info(`CORE: Using accepted strategy - Type: ${strategyType}`);
    if (strategyType === RecommendedImplementationType.SCRAPING && acceptedStrategy) {
         logger.info(`CORE: Scraping Hints - Domain: ${acceptedStrategy.suggestedBaseDomain}, Method: ${acceptedStrategy.scrapingMethodHint}, Auth Puppeteer: ${acceptedStrategy.authRequiresPuppeteer}`);
    }
  }

  const request = toolRequest;

  if (!request || !request.name || !request.description || !request.inputs || !request.expectedOutput) {
        logger.error("CORE: Invalid ToolRequest received in CORE_generateCustomToolDefinition", { request });
        throw new Error("Invalid ToolRequest: Missing required fields (name, description, inputs, expectedOutput).");
    }
    if (!modelArgs || !modelArgs.modelName || !modelArgs.provider) {
         logger.error("CORE: Invalid ModelArgs received in CORE_generateCustomToolDefinition", { modelArgs });
        throw new Error("Invalid ModelArgs: Missing required fields (modelName, provider).");
    }

  const parametersString = Array.isArray(request.inputs) && request.inputs.length > 0
        ? request.inputs.map((p: ToolInputParameter) => `- ${p.name} (${p.type}): ${p.description}${p.required === false ? ' (optional)' : ''}${p.default !== undefined ? ` (default: ${JSON.stringify(p.default)})` : ''}`).join('\n')
        : '  (No input parameters defined)';

  let acceptedStrategyString = '(No specific strategy pre-defined, rely on tool details and modification requests.)';
  if (acceptedStrategy) {
    const prelimFindingsStr = acceptedStrategy.preliminaryFindings ? `\n*   **Preliminary Findings:** ${acceptedStrategy.preliminaryFindings}` : "";
    const credNameStr = acceptedStrategy.requiredCredentialName ? `\n*   **Required Credential Name (from strategy):** ${acceptedStrategy.requiredCredentialName}` : "";
    
    let scrapingHintsStr = "";
    if (acceptedStrategy.recommendedType === RecommendedImplementationType.SCRAPING) {
        const domainHint = acceptedStrategy.suggestedBaseDomain 
            ? `Suggested Base Domain: '${acceptedStrategy.suggestedBaseDomain}'`
            : "CRITICAL HINT: 'suggestedBaseDomain' was NOT PROVIDED. The LLM MUST determine an appropriate 'baseDomain' for the scraping configuration from other tool details (e.g., purpose, description) and include it in the 'implementation.baseDomain' field. This field is mandatory for scraping tools.";
        const methodHint = acceptedStrategy.scrapingMethodHint || 'Not Suggested';
        const authPuppeteerHint = acceptedStrategy.authRequiresPuppeteer === true;
        const exampleUrlHint = acceptedStrategy.exampleTargetPageUrl ? `Example Target Page URL: '${acceptedStrategy.exampleTargetPageUrl}'` : 'No example target page URL provided';
        
        scrapingHintsStr = `\n*   **Scraping Specific Hints:**\n        *   ${domainHint}\n        *   Suggested Method: '${methodHint}'\n        *   Auth Requires Puppeteer: '${authPuppeteerHint}'\n        *   ${exampleUrlHint}`;
    }
    
    const warningsStr = acceptedStrategy.warnings && acceptedStrategy.warnings.length > 0 ? `\n*   **Warnings:** ${acceptedStrategy.warnings.join('; ')}` : "\n*   **Warnings:** None";
    
    acceptedStrategyString = `
*   **Recommended Type:** ${acceptedStrategy.recommendedType}
*   **Strategy Details:** ${acceptedStrategy.strategyDetails}${warningsStr}${credNameStr}${scrapingHintsStr}${prelimFindingsStr}
    `.trim();
  }

  const systemPrompt = autoGenToolPrompts.generateToolImplementationPrompt(scrapingToolImplementationConfigPromptSchemaShape, request, parametersString, acceptedStrategyString);

  logger.debug(`CORE: Generation Prompt for ${request.name}`, { systemPromptLength: systemPrompt.length });
  //logger.prompt(systemPrompt)

  try {
    const model = await MODEL_getModel_ai(modelArgs);
    const { object: generatedWrapper } = await generateObject({
      model: model,
      schema: wrappedRefinedToolDefinitionSchema,
      prompt: systemPrompt,
      temperature: modelArgs.temperature,
    });

    const generatedDefinition = generatedWrapper.toolDefinition;

    logger.info(`CORE: Successfully generated definition & implementation for: ${generatedDefinition.name}`);
    logger.debug("CORE: Generated Object (unwrapped):", generatedDefinition);

    if (typeof generatedDefinition.implementation === 'string') {
    if (!generatedDefinition.implementation || generatedDefinition.implementation.trim() === '') {
        throw new Error("Generated string implementation is empty or only whitespace.");
      }
    } else if (typeof generatedDefinition.implementation !== 'object' || generatedDefinition.implementation === null) {
      if(generatedDefinition.implementationType === 'scraping'){
        throw new Error("Generated scraping implementation is not a valid object or is null.");
      }
      else if (!generatedDefinition.implementation) {
        throw new Error("Generated implementation is missing.");
      }
    }

    if (!["api", "function", "scraping"].includes(generatedDefinition.implementationType)) {
        throw new Error(`Generated implementationType is invalid: '${generatedDefinition.implementationType}'. Must be "api", "function", or "scraping".`);
    }

    if (!Array.isArray(generatedDefinition.inputs)) {
        throw new Error("Generated 'inputs' field is not an array.");
    }
    generatedDefinition.inputs.forEach((input: any, index: number) => {
        const validationResult = toolParameterSchema.safeParse(input);
        if (!validationResult.success) {
             throw new Error(`Generated input at index ${index} has invalid structure: ${JSON.stringify(input)}. Issues: ${JSON.stringify(validationResult.error.flatten().fieldErrors)}`);
        }
        generatedDefinition.inputs[index] = validationResult.data;
    });

    return generatedDefinition as RefinedToolDefinition;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`CORE: Failed to generate definition/implementation for ${request.name}`, {
        error: errorMessage,
        modelArgs: modelArgs
    });
    if (error instanceof Error && (error as any).cause) {
            logger.error("CORE: Generation Error Cause:", (error as any).cause);
    }
    throw new Error(`Failed to generate tool '${request.name}' using model ${modelArgs.modelName}: ${errorMessage}`);
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
    const strategyToPass = toolRequest.acceptedStrategy ? toolRequest.acceptedStrategy.analysis : null;
    const refinedDefinition = await CORE_generateCustomToolDefinition(toolRequest, modelArgs, strategyToPass);

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
    if (toolRequest.examples) {
        metadata.examples = toolRequest.examples;
    }

    const inputsForRegistry = Array.isArray(refinedDefinition.inputs) ? refinedDefinition.inputs : [];
    if (!Array.isArray(refinedDefinition.inputs)){
        logger.warn("CORE_createToolFromRequest: refinedDefinition.inputs was not an array. Defaulting to empty array for registry.", {actualInputs: refinedDefinition.inputs});
    }

    const toolRef = await ToolRegistry.registerTool(
      userId,
      refinedDefinition.name,
      refinedDefinition.description,
      inputsForRegistry,
      refinedDefinition.implementation,
      refinedDefinition.implementationType,
      metadata,
      toolRequest.acceptedStrategy ? JSON.stringify(toolRequest.acceptedStrategy) : null
    );

    const toolId = getCustomToolId(toolRef);
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
    if (error instanceof Error && error.message.includes("already exists for this user")) {
        return {
            success: false,
            message: error.message,
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
  userId: string
): Promise<Record<string, { success: boolean; message: string; toolRef?: string; toolId?: string; definition?: RefinedToolDefinition }>> {
    const results: Record<string, any> = {};
    for (const request of toolRequests) {
        const defaultModelArgs: ModelArgs = {
            provider: ModelProviderEnum.OPENAI,
            modelName: "gpt-4o",
            temperature: 0.7
        };
        const result = await CORE_createToolFromRequest(request, userId, defaultModelArgs);
        results[request.name] = result;
    }
    return results;
}


// --- Removed Agent-Specific Caching ---


// CORE_generateDynamicToolWrapper remains useful for ToolFactory, keep it.
export async function CORE_generateDynamicToolWrapper(implementationCode: string, parametersSchema: z.ZodObject<any, any>): Promise<(args: any) => Promise<any>> {
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


// --- Deprecated / Legacy ---

/**
 * @deprecated Prefer CORE_createToolFromRequest for AI generation or ToolRegistry.registerTool for direct registration.
 * Creates a custom tool directly from provided parameters for a specific user.
 */
export async function CORE_createTool(
  userId: string,
  textChatLogs: TextChatLogProps[] | null,
  params: any
) {
  logger.warn("CORE_createTool is deprecated, use CORE_createToolFromRequest or ToolRegistry.registerTool");
   try {
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

    const metadata = {
        userId: userId,
        source: "agent-created-deprecated",
        createdAt: new Date().toISOString(),
        category: params.category
    };

    const toolRef = await ToolRegistry.registerTool(
      userId,
      params.name,
      params.description,
      paramsValidation.data,
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
     if (error instanceof Prisma.PrismaClientKnownRequestError) {
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
        role: "system",
        message: `CORE: Listing custom tools for user ${userId}${category ? ` in category: ${category}` : ''}`,
        timestamp: new Date()
      });
  }

  try {
    const toolsList = await ToolRegistry.listAllTools(userId);
    const filteredTools = category
        ? toolsList.filter(tool => {
            try {
                const meta = tool.metadata ? JSON.parse(tool.metadata) : {};
                return meta.category === category;
            } catch(e) {
                logger.warn(`CORE listTools: Failed to parse metadata for tool ID ${tool.id}`, { metadata: tool.metadata, error: e });
                return false;
             }
        })
        : toolsList;

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
                const validationResult = toolParametersSchema.safeParse(parsed);
                if (validationResult.success) {
                    parsedParameters = validationResult.data as ToolParameter[];
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
            parameters: parsedParameters,
            category: parsedMetadata?.category || 'DEFAULT',
            id: tool.id,
            reference: createCustomToolReference(tool.id)
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
    textChatLogs: TextChatLogProps[] | null,
    params: { toolRef: string; toolArgs?: Record<string, any> }
): Promise<any> => {
  const { toolRef, toolArgs = {} } = params;
  let toolNameForLogging = toolRef;

  if (!toolRef || typeof toolRef !== 'string' || !toolRef.includes(':')) {
      logger.error("CORE Execute: Invalid toolRef format", { toolRef });
      return { success: false, _isToolError: true, error: "Invalid tool reference format. Expected 'type:id'."};
  }

  if (!isCustomToolReference(toolRef)) {
      logger.error("CORE Execute: toolRef is not a custom tool reference", { toolRef });
       return { success: false, _isToolError: true, error: `Reference '${toolRef}' is not a valid custom tool reference.`};
  }

  logger.tool("CORE Execute: Attempting execution", { toolRef, args: toolArgs });

  if (textChatLogs?.push) {
    textChatLogs.push({
      role: "system",
      message: `CORE: Executing custom tool: "${toolRef}"`,
      timestamp: new Date()
    });
  }

  try {
    const toolId = getCustomToolId(toolRef);
    if (!toolId) {
        throw new Error(`Could not extract tool ID from reference: ${toolRef}`);
    }

    const toolEntry = await ToolRegistry.getToolById(toolId);
    if (!toolEntry) {
      throw new Error(`Custom tool with reference ${toolRef} (ID: ${toolId}) not found in registry.`);
    }
    toolNameForLogging = toolEntry.name;

    const toolObject = ToolFactory.buildTool(toolEntry);
    const executableTool = toolObject[toolNameForLogging];

    if (!executableTool || typeof executableTool.execute !== 'function') {
      logger.error("CORE Execute: Failed to build executable tool object from factory", { toolRef, toolName: toolNameForLogging });
      throw new Error(`Failed to build executable tool '${toolNameForLogging}' from definition.`);
    }

    logger.tool(`CORE Execute: Calling execute on tool '${toolNameForLogging}' (Ref: ${toolRef}`);
    const result = await executableTool.execute(toolArgs);

    logger.tool(`CORE Execute: Execution complete for '${toolNameForLogging}'`, { success: !(result?._isToolError === true), hasResult: result !== undefined });

    return result;

  } catch (error) {
    logger.error("CORE Execute: Execution Failed", {
      toolRef,
      toolName: toolNameForLogging,
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined
    });
    return {
      success: false,
      _isToolError: true,
      error: `Failed to execute tool "${toolNameForLogging}": ${error instanceof Error ? error.message : "Unknown error"}`
    };
  }
};