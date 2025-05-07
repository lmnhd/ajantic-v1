"use server";
import { CoreMessage, generateText, generateObject, LanguageModel } from "ai";
import { z } from "zod";
import {
  AgentTurnResult,
  AgentTurnInput,
  OrchestrationType2,
  OrchestrationConfig,
  AgentTurnStatus,
  ValidationSchema,
} from "../types/base"; 
import { OrchestrationPromptContext } from "../types/prompt";
import {
  MODEL_JSON,
  UTILS_convertLineSetsToContext,
  UTILS_getModelArgsByName,
  UTILS_loadAgentGlobalPrompt,
} from "@/src/lib/utils";
import { MODEL_getModel_ai } from "@/src/lib/vercelAI-model-switcher";
import { logger } from "@/src/lib/logger";
import {
  AgentFoundationalPromptProps,
  AgentTypeEnum,
  AISessionState,
  ModelProviderEnum,
  OrchestrationProps,
  OrchestrationType,
  ServerMessage,
  AgentComponentProps,
} from "@/src/lib/types";
import { ORCHESTRATION_PROMPT_SELECT } from "../prompt/orchestration-prompt-select";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "@langchain/openai";
import { ORCHESTRATION_load_agent_tools } from "./load-agent-tools";
import { ORCHESTRATION_getProviderOptions } from "./provider-options";
import { MissingCredentialError } from "@/src/lib/agent-tools/load-agent-tools";

/**
 * Internal helper to validate a worker agent's text response against expected criteria.
 */
async function _validateWorkerResponse(
  {
    originalTaskMessage,
    expectedOutput,
    agentResponseText,
    validationModel,
    agentName,
  }: {
    originalTaskMessage: string;
    expectedOutput: any;
    agentResponseText: string;
    validationModel: LanguageModel;
    agentName: string;
  }
): Promise<z.infer<typeof ValidationSchema>> {
  const systemPrompt = `You are an expert validation assistant. Your task is to determine if a given agent's response strictly meets the specified output criteria for an assigned task. Focus *only* on whether the response fulfills the requirements described in the 'Expected Output Criteria'. Ignore conversational filler or pleasantries unless the criteria specifically demand them.`;

  const userMessage = `
Original Task Request:
---
${originalTaskMessage}
---

Expected Output Criteria:
---
${JSON.stringify(expectedOutput, null, 2)}
---

Agent's Response:
---
${agentResponseText}
---

Based *only* on the provided Expected Output Criteria, does the Agent's Response comprehensively meet *all* the requirements? Consider the requested format, required elements, and the overall goal implied by the criteria.`;

  try {
    logger.log(`Validating response from ${agentName} using ${validationModel.modelId}...`);
    const validationResult = await generateObject({
      model: validationModel,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      schema: ValidationSchema,
      maxRetries: 1,
    });
    logger.log(`Validation result for ${agentName}:`, validationResult.object);
    return validationResult.object;
  } catch (error) {
    logger.error(`Error during validation call for ${agentName}:`, { error });
    return {
      meetsCriteria: false,
      reason: `Validation check failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// --- Helper Functions (Adapted from agent-channels.tsx) --- //

// Basic rate limiting
async function waitForRateLimit() {
  await new Promise((resolve) => setTimeout(resolve, 500));
}

// Truncate message helper
const truncateMessage = (msg: string, maxLength: number = 12000) => {
  return msg.length > maxLength ? msg.slice(0, maxLength) + "..." : msg;
};

/**
 * Creates a memory vector store for use with LLM operations
 * This needs to be created on the server with API key access
 */
async function createMemoryStore(): Promise<MemoryVectorStore> {
  const { GLOBAL_getVectorStoreClient } = await import("@/src/lib/vectorstore_client");
  return GLOBAL_getVectorStoreClient();
}

/**
 * Generates the system prompt for an agent based on the orchestration context.
 * It selects the appropriate prompt generation logic (standard, dynamic manager, dynamic processor).
 *
 * @param promptContext The context containing all necessary info for prompt generation.
 * @returns The generated system prompt string.
 */
async function ORCHESTRATION_generatePrompt(
  promptContext: OrchestrationPromptContext
): Promise<string> {
  let prompt = "You are a helpful assistant.";

  const {
    currentAgent,
    currentTaskMessage,
    currentContextSets,
    currentHistorySnapshot,
  } = promptContext;

  try {
    prompt = await ORCHESTRATION_PROMPT_SELECT(
      promptContext,
      currentTaskMessage
    );
  } catch (error) {
    console.log(
      "Error during agent turn execution for ",
      currentAgent.name,
      error
    );
    prompt = "You are a helpful assistant.";
  }

  return prompt;
}

/**
 * Internal helper to call generateObject for manager directives with validation and retry logic.
 */
async function _generateManagerDirectivesWithRetry<T extends z.ZodSchema>(
    {
        model,
        systemPrompt,
        initialMessages,
        schema,
        providerOptions,
        agentName,
    }: {
        model: LanguageModel;
        systemPrompt: string;
        initialMessages: CoreMessage[];
        schema: T;
        providerOptions: Record<string, any>;
        agentName: string;
    }
): Promise<{
    success: true;
    directives: z.infer<T>;
} | {
    success: false;
    error: string;
    extractedMessage: string | null;
}> {
    let attempt = 1;
    let lastError: any = null;
    let extractedMessageFromFirstAttempt: string | null = null;
    let invalidObjectFromFirstAttempt: any = null;

    while (attempt <= 2) {
        logger.log(`Calling model ${model.modelId} for manager ${agentName} with generateObject (Attempt ${attempt})`);
        let currentMessages = initialMessages;
        let currentSystemPrompt = systemPrompt;

        if (attempt > 1 && lastError) {
            let validationFeedback = `Your previous response failed schema validation. Error: ${lastError instanceof Error ? lastError.message : String(lastError)}.`;
            let zodIssues: any[] | undefined = undefined;
            if (lastError instanceof Error) {
                if (lastError.name === 'ZodError' && Array.isArray((lastError as any).issues)) {
                    zodIssues = (lastError as any).issues;
                } else if (lastError.cause instanceof Error && lastError.cause.name === 'ZodError' && Array.isArray((lastError.cause as any).issues)) {
                    zodIssues = (lastError.cause as any).issues;
                }
            }
            if (zodIssues) {
                try { validationFeedback += ` Specific issues: ${JSON.stringify(zodIssues, null, 2)}`; }
                catch (stringifyError) { validationFeedback += ` Specific issues were found but could not be displayed.`; }
            }
            const snippet = JSON.stringify(invalidObjectFromFirstAttempt || extractedMessageFromFirstAttempt).substring(0, 200);
            validationFeedback += ` The invalid response started like this: ${snippet}... Please review the error message and issues above, then provide a response that strictly adheres to the required schema.`;

            currentMessages = [
                ...initialMessages,
                { role: 'assistant', content: JSON.stringify(invalidObjectFromFirstAttempt) || extractedMessageFromFirstAttempt || "Invalid response format." },
                { role: 'user', content: validationFeedback }
            ];
        }

        try {
            const structuredResponse = await generateObject({
                model: model,
                system: currentSystemPrompt,
                messages: currentMessages,
                schema: schema,
                maxRetries: 0,
                providerOptions: providerOptions,
            });

            logger.agent(`${agentName} manager directives received (Attempt ${attempt} - Success):`, {
                destination: (structuredResponse.object as any)?.messageTo,
                complete: (structuredResponse.object as any)?.workflowComplete,
            });
            return { success: true, directives: structuredResponse.object };

        } catch (error) {
            lastError = error;
            const isValidationError = error instanceof Error && (
                error.name === 'ZodError' ||
                error.name === 'AI_TypeValidationError' ||
                (error.cause && error.cause instanceof Error && error.cause.name === 'ZodError')
            );

            if (isValidationError) {
                logger.warn(`Manager ${agentName} generateObject validation failed (Attempt ${attempt}):`, { error });
                if (attempt === 1) {
                    if (error && typeof error === 'object') {
                        const potentialValue = (error as any).value ?? (error as any).cause?.value;
                        if (potentialValue && typeof potentialValue === 'object') {
                            invalidObjectFromFirstAttempt = potentialValue;
                            if (typeof invalidObjectFromFirstAttempt.message === 'string') {
                                extractedMessageFromFirstAttempt = invalidObjectFromFirstAttempt.message;
                                console.log(`Extracted message from invalid object (Attempt 1): "${extractedMessageFromFirstAttempt}"`);
                            }
                        }
                    }
                    if (!extractedMessageFromFirstAttempt) {
                        extractedMessageFromFirstAttempt = `Manager response failed schema validation: ${error instanceof Error ? error.message : String(error)}`;
                    }
                }
            } else {
                logger.error(`Unexpected error during generateObject call for ${agentName} (Attempt ${attempt}):`, { error });
                return {
                    success: false,
                    error: `Unexpected error during generateObject: ${error instanceof Error ? error.message : String(error)}`,
                    extractedMessage: extractedMessageFromFirstAttempt
                };
            }
        }
        attempt++;
    }

    logger.error(`Manager ${agentName} generateObject failed validation after all attempts.`);
    return {
        success: false,
        error: `Manager response failed schema validation after all attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
        extractedMessage: extractedMessageFromFirstAttempt
    };
}

// --- Main Agent Execution Function --- //

/**
 * Executes a single turn for an agent based on the provided input.
 * This is a server function that handles LLM operations.
 *
 * @param input Data required for the agent's turn.
 * @param state Session state for tools and context
 * @param config Orchestration configuration
 * @returns The result of the agent's turn.
 */
export async function ORCHESTRATION_executeAgentTurn(
  input: AgentTurnInput,
  state: AISessionState,
  config: OrchestrationConfig
): Promise<AgentTurnResult> {
  await waitForRateLimit();

  const memStore = await createMemoryStore();

  const {
    agentConfig,
    message,
    history,
    contextSets,
    userId,
    teamName,
    orchestrationState,
    fullTeam,
  } = input;
  const agentName = agentConfig.name || "Unknown Agent";

  let tools = {};

  try {
    logger.agent(`Executing turn for ${agentName}...`, {
      message: message.substring(0, 100),
    });

    let expectedOutputCriteria: any = null;
    let originalTaskMessageForValidation = message;
    const managerAgent = fullTeam.agents.find(agent => agent.type === AgentTypeEnum.MANAGER);
    const managerMessageIndex = orchestrationState.conversationHistory.findLastIndex(msg =>
      msg.agentName === managerAgent?.name &&
      msg.agentDirectives?.messageTo === agentName &&
      msg.expectedOutput
    );

    let messageWithCriteria = message;

    if (managerMessageIndex !== -1) {
        const originalManagerMessage = orchestrationState.conversationHistory[managerMessageIndex];
        if (originalManagerMessage?.expectedOutput) {
            expectedOutputCriteria = originalManagerMessage.expectedOutput;
            originalTaskMessageForValidation = originalManagerMessage.agentDirectives?.message || message;
            const criteriaText = JSON.stringify(expectedOutputCriteria, null, 2);
            messageWithCriteria = `${message}\n\n--- EXPECTED OUTPUT CRITERIA ---\nPlease ensure your response *directly* and *completely* addresses the task according to these criteria:\n${criteriaText}\n\nProvide only the requested output, not just confirmation.`;
            logger.log(`Including expected output criteria for worker agent ${agentName}`);
        }
    }

    const promptContext: OrchestrationPromptContext = {
        orchestrationType: orchestrationState.config.type,
        agentOrder: orchestrationState.config.agentOrder || "sequential",
        currentAgent: agentConfig,
        allAgents: fullTeam.agents,
        teamName: teamName,
        userId: userId,
        initialMessage: orchestrationState.config.initialMessage,
        teamObjective: orchestrationState.config.objectives,
        currentTaskMessage: messageWithCriteria,
        currentRound: orchestrationState.currentRound,
        currentCycleStep: orchestrationState.currentCycleStep,
        currentHistorySnapshot: history,
        currentContextSets: contextSets,
        numRounds: orchestrationState.config.numRounds ?? 0,
        expectedOutputCriteria: expectedOutputCriteria,
    };

    const basePrompt = await ORCHESTRATION_generatePrompt(promptContext);

    const truncatedPrompt = truncateMessage(basePrompt);
    logger.prompt(`${agentName} prompt (truncated)`, {
      prompt: truncatedPrompt.substring(0, 500) + "...",
    });

    logger.log(`Clearing history for worker agent ${agentName}. Only current task message will be sent.`);
    let currentConversation: CoreMessage[] = [];

    const isCurrentMessageOnly = currentConversation.length === 1 && currentConversation[0].role === "user" && currentConversation[0].content === messageWithCriteria;

    if (!isCurrentMessageOnly) {
         currentConversation = currentConversation.filter(msg => !(msg.role === "user" && msg.content === messageWithCriteria));
         currentConversation.push({ role: "user", content: messageWithCriteria });
    }

    try {
    if (orchestrationState.currentAgent) {
         tools = await ORCHESTRATION_load_agent_tools(
            orchestrationState.currentAgent,
            orchestrationState.config,
            contextSets,
            history,
            memStore,
            [],
            orchestrationState.config.objectives,
            state
          );
         logger.tool(`Tools loaded successfully for ${agentName}`, { toolCount: Object.keys(tools).length });
      } else {
        logger.warn(`Cannot load tools for ${agentName} as currentAgent is missing in orchestrationState.`);
      }
    } catch (error) {
      if (error instanceof MissingCredentialError) {
        const credName = (error as any).credentialName ?? 'UNKNOWN';
        logger.warn(`Credential required for ${agentName}: ${credName}`);
        return {
          status: 'REQUIRES_CREDENTIAL_INPUT' as const,
          message: `Agent ${agentName} requires the credential '${credName}' to proceed.`,
          credentialName: credName,
          agentName: agentName,
          response: "",
          contextModified: false,
        };
      } else {
        logger.error(`Unexpected error loading tools for ${agentName}:`, { error });
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          status: 'ERROR',
          message: `Failed to load tools for agent ${agentName}: ${errorMessage}`,
          agentName: agentName,
          response: "",
          contextModified: false,
        };
      }
    }

    const providerOptions = ORCHESTRATION_getProviderOptions(agentConfig);

    const model = await MODEL_getModel_ai(agentConfig.modelArgs);
    logger.log(`Calling model ${model.modelId} for agent ${agentName} (Attempt 1)`);

    let responseText = "";
    let attempt = 1;
    const maxAttempts = expectedOutputCriteria ? 2 : 1;
    let validationOutcome: z.infer<typeof ValidationSchema> | null = null;

    while (attempt <= maxAttempts) {
        try {
            const systemPromptLength = truncatedPrompt?.length || 0;
            const conversationLength = currentConversation.reduce(
                (sum, msg) => sum + (msg.content?.length || 0),
                0
            );
            const totalApproxInputChars = systemPromptLength + conversationLength;

            logger.debug(`[${agentName}] Preparing generateText Call (Attempt ${attempt})`, {
                modelId: model.modelId,
                systemPromptChars: systemPromptLength,
                conversationMessages: currentConversation.length,
                conversationChars: conversationLength,
                totalApproxInputChars: totalApproxInputChars,
                currentUserMessageStart: typeof messageWithCriteria === 'string'
                    ? messageWithCriteria.substring(0, 150) + (messageWithCriteria.length > 150 ? '...' : '')
                    : 'N/A'
            });

            if (totalApproxInputChars > 18000) {
                 logger.warn(`[${agentName}] Approaching Anthropic token limit. Input ~${totalApproxInputChars} chars.`);
            }

            const response = await generateText({
                model: model,
                system: agentConfig.modelArgs.modelName === "o1-mini" ||
                        agentConfig.modelArgs.modelName === "o1-preview"
                          ? undefined
                          : truncatedPrompt,
                messages: currentConversation,
                ...(Object.keys(tools).length > 0 ? { tools } : {}),
                ...(Object.keys(providerOptions).length > 0 ? { providerOptions } : {}),
                maxRetries: 0,
                maxSteps: 10,
            });

            responseText = response?.text || "";

            logger.agent(`${agentName} final response text received (Attempt ${attempt}):`, {
                responseLength: responseText.length,
                firstChars: responseText.substring(0, 100) + "...",
            });

            if (expectedOutputCriteria) {
                const validationModel = await MODEL_getModel_ai(UTILS_getModelArgsByName(MODEL_JSON().OpenAI["gpt-4.5-preview"].name));

                validationOutcome = await _validateWorkerResponse({
                    originalTaskMessage: originalTaskMessageForValidation,
                    expectedOutput: expectedOutputCriteria,
                    agentResponseText: responseText,
                    validationModel: validationModel,
                    agentName: agentName,
                });

                if (validationOutcome.meetsCriteria) {
                    logger.log(`Validation passed for ${agentName} on attempt ${attempt}.`);
                    break;
                } else {
                    logger.warn(`Validation failed for ${agentName} on attempt ${attempt}. Reason: ${validationOutcome.reason}`);
                    if (attempt < maxAttempts) {
                        const feedbackMessage = `Your previous response did not meet the required criteria.
Reason: ${validationOutcome.reason || 'Not specified.'}
Expected Output Criteria:
---
${JSON.stringify(expectedOutputCriteria, null, 2)}
---
CRITICAL: Review the criteria and your failed response. Revise your response to strictly adhere to *all* expected criteria and provide the complete result *directly*. Do NOT just acknowledge the task. Generate the final output now.`;

                        currentConversation = [
                            ...currentConversation,
                            { role: 'assistant', content: responseText },
                            { role: 'user', content: feedbackMessage }
                        ];
                        logger.log(`Preparing retry for ${agentName} (Attempt ${attempt + 1})`);
                    } else {
                         logger.error(`Validation failed for ${agentName} after ${maxAttempts} attempts. Using last response.`);
                    }
                }
            } else {
                break;
            }

        } catch (genError) {
             logger.error(`Error during generateText call for ${agentName} (Attempt ${attempt}):`, { genError });
             responseText = `Error during agent execution (Attempt ${attempt}): ${genError instanceof Error ? genError.message : String(genError)}`;
             break;
        }
        attempt++;
    }

    let finalStatus: AgentTurnStatus = 'COMPLETED';
    let finalMessage = responseText || "No response generated by agent.";
    if (expectedOutputCriteria && validationOutcome && !validationOutcome.meetsCriteria) {
        finalStatus = 'VALIDATION_FAILED'; finalMessage = `Validation Failed: ${validationOutcome.reason}`;
    } else if (expectedOutputCriteria && validationOutcome?.meetsCriteria) {
        finalStatus = 'COMPLETED_AND_VALIDATED';
    }

    const result: AgentTurnResult = {
      response: finalMessage,
      agentName: agentName,
      contextModified: false,
      status: finalStatus,
      validationStatus: validationOutcome ?? undefined,
    };

    return result;

  } catch (error) {
    logger.error(`Critical error during agent turn execution for ${agentName}:`, {
      error,
    });
    const criticalErrorMessage = error instanceof Error ? error.message : String(error);
    return {
      status: 'ERROR',
      message: `Agent ${agentName} encountered a critical error: ${criticalErrorMessage}`,
      agentName: agentName,
      response: "",
      contextModified: false,
    };
  }
}

/**
 * Executes a turn for a manager agent, using structured output to provide workflow directives.
 * This is a server function that handles LLM operations with a structured output schema.
 *
 * @param input Data required for the manager's turn.
 * @param state Session state for tools and context
 * @param config Orchestration configuration
 * @returns The result of the manager's turn with structured directives.
 */
export async function ORCHESTRATION_executeManagerTurn(
  input: AgentTurnInput,
  state: AISessionState,
  config: OrchestrationConfig
): Promise<AgentTurnResult> {
  await waitForRateLimit();
  
  const memStore = await createMemoryStore();

  const {
    agentConfig,
    message,
    history,
    contextSets,
    userId,
    teamName,
    orchestrationState,
    fullTeam,
  } = input;
  const agentName = agentConfig.name || "Unknown Manager";

  try {
    logger.agent(`Executing manager turn for ${agentName}...`, {
      message: message.substring(0, 100),
    });

    const newContextSetsSchema = z.object({
      contextSets: z.array(z.object({
        name: z.string().describe("The name of the context set. If the set exists, it will be updated. If not, it will be created."),
        context: z.string().describe("The content for the context set. An empty string will remove the context set if it exists."),
        visibleToAgents: z.union([
          z.literal("none").describe("Context set is visible to no agents."),
          z.literal("all").describe("Context set is visible to all agents."),
          z.array(
            z.string().refine(
              (val) => config.agents.map((agent) => agent.name).includes(val),
              { message: "Invalid agent name in array." }
            )
          ).describe("Context set is visible only to the specified list of agent names."),
          z.string().refine(
            (val) => config.agents.map((agent) => agent.name).includes(val),
            { message: "Invalid single agent name." }
          ).describe("Context set is visible only to the specified single agent name.")
        ])
        .describe("Specify which agents can see this context set. Use 'none', 'all', an array of agent names, or a single agent name.")
        .optional()
        .default("all"),
      })),
    });

    const AgentDirectivesSchema = z.object({
      messageTo: z.enum(["user", ...config.agents.filter(agent => agent.type !== AgentTypeEnum.MANAGER).map(agent => agent.name)]).describe("Who you are sending this message to."),
      message: z.string().describe("Your message."),
      workflowComplete: z.boolean().describe("Set to true if you believe the overall workflow is complete."),
      contextUpdates: z.boolean().describe("Whether the context in this message contains important updates that should be stored. Set to false if this is just a routing decision."),
      isInfoRequest: z.boolean().default(false).describe("Set to true if this message is requesting information from the user that should be represented as a form."),
      contextSetUpdate: z.optional(newContextSetsSchema).describe("If you need to create or update context sets, use this object."),
      expectedOutput: z.optional(z.object({
        criteria: z.string().describe("What output we're looking for from the target agent."),
        format: z.optional(z.string()).describe("Expected format of the response (e.g., Markdown, XML, JSON, list, paragraph, etc.)"),
        requiredElements: z.optional(z.array(z.string())).describe("Specific elements that must be present in the response"),
        validationStrategy: z.optional(
          z.enum(["exact", "semantic", "contains", "custom", "simple"])
        ).describe("How to validate the response matches criteria"),
      })).describe("Optional criteria for the expected output from the next agent."),
    });

    const promptContext: OrchestrationPromptContext = {
      orchestrationType: orchestrationState.config.type,
      agentOrder: orchestrationState.config.agentOrder || "sequential",
      currentAgent: agentConfig,
      allAgents: fullTeam.agents,
      teamName: teamName,
      userId: userId,
      initialMessage: orchestrationState.config.initialMessage,
      teamObjective: orchestrationState.config.objectives,
      currentTaskMessage: message,
      currentRound: orchestrationState.currentRound,
      currentCycleStep: orchestrationState.currentCycleStep,
      currentHistorySnapshot: history,
      currentContextSets: contextSets,
      numRounds: orchestrationState.config.numRounds ?? 0,
    };

    const prompt = await ORCHESTRATION_generatePrompt(promptContext);
    logger.prompt(prompt, {
      agentName: agentName,
    }); 
    console.log(`${agentName} prompt`, prompt);
    const truncatedPrompt = truncateMessage(prompt);
    logger.prompt(prompt, {
      agentName: agentName,
    });

    const validCoreRoles: CoreMessage['role'][] = ["user", "assistant", "system"];
    const currentConversation = history
        .filter(msg => validCoreRoles.includes(msg.role as CoreMessage['role']))
        .map(msg => ({
             role: msg.role as CoreMessage['role'],
             content: msg.content || "",
        })) as CoreMessage[];

    const isMessageInHistory = history.some(msg => 
      msg.role === "user" && msg.content === message
    );
    
    if (!isMessageInHistory) {
      currentConversation.push({ role: "user", content: message });
    }

    const model = await MODEL_getModel_ai(agentConfig.modelArgs);
    const generationResult = await _generateManagerDirectivesWithRetry({
        model: model,
        systemPrompt: truncatedPrompt,
      initialMessages: currentConversation,
        schema: AgentDirectivesSchema,
      providerOptions: ORCHESTRATION_getProviderOptions(agentConfig),
        agentName: agentName,
    });

    if (!generationResult.success) {
        logger.error(`Manager ${agentName} failed to generate valid directives after retry. Implementing fallback.`);
        const fallbackDirectives: z.infer<typeof AgentDirectivesSchema> = {
            messageTo: "user",
            message: generationResult.extractedMessage || `I encountered an issue generating my next instruction after multiple attempts. Error: ${generationResult.error}. Please advise or try again.`,
            workflowComplete: false,
            contextUpdates: false,
            isInfoRequest: false,
       };
        return {
           response: fallbackDirectives.message,
           message: fallbackDirectives.message,
            agentName: agentName,
           error: generationResult.error,
           agentDirectives: fallbackDirectives,
           contextModified: false,
           status: 'ERROR' as const,
       };
    }

    const finalDirectives = generationResult.directives;

    const result: AgentTurnResult = {
      response: finalDirectives.message,
      message: finalDirectives.message,
      agentName: agentName,
      contextModified: finalDirectives.contextUpdates,
      agentDirectives: finalDirectives,
      status: 'COMPLETED' as const,
    };

    if ((finalDirectives.isInfoRequest && finalDirectives.messageTo === "user") ||
        (finalDirectives.contextUpdates && finalDirectives.contextSetUpdate)) {
        let updatedContextSets = [...contextSets];
        if (finalDirectives.isInfoRequest && finalDirectives.messageTo === "user") {
            const { processInfoRequestContextForm } = await import("./context-processor");
            const formContextResult = await processInfoRequestContextForm(
                finalDirectives.message,
                 updatedContextSets,
                agentConfig,
                history,
                orchestrationState.config.teamName
            );
            updatedContextSets = formContextResult.updatedContextSets;
            result.allContextSets = updatedContextSets;
            result.response += "\n\n**Please fill out the form below to provide the requested information.**";
             if(result.message) result.message += "\n\n**Please fill out the form below to provide the requested information.**";
        }
        if (finalDirectives.contextUpdates && finalDirectives.contextSetUpdate) {
             logger.log(`Manager ${agentName} provided explicit contextSetUpdate directive.`);
        }
    }

    return result;
  } catch (error: any) {
    logger.error(`Error during manager ${agentName} turn execution:`, { error });
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      response: `Error during manager execution: ${errorMessage}`,
      message: `Error during manager execution: ${errorMessage}`,
      agentName: agentName,
      error: errorMessage,
      status: 'ERROR' as const,
      contextModified: false,
    };
  }
}
