"use server";
import { CoreMessage, generateText, generateObject, LanguageModel } from "ai";
import { z } from "zod";
import {
  AgentTurnResult,
  AgentTurnInput,
  OrchestrationType2,
  OrchestrationConfig,
} from "../types/base"; 
import { OrchestrationPromptContext } from "../types/prompt";
import {
  MODEL_JSON,
  UTILS_convertLineSetsToContext,
  UTILS_getModelArgsByName,
  UTILS_loadAgentGlobalPrompt,
} from "@/src/lib/utils"; // Keep existing utils for now
import { MODEL_getModel_ai } from "@/src/lib/vercelAI-model-switcher";
import { logger } from "@/src/lib/logger";
import { AGENT_WORKFLOW_ORCHESTRATION_PROMPT } from "@/src/lib/prompts/workflow-prompt"; // Assuming prompts are accessible
import {
  AgentFoundationalPromptProps,
  AgentTypeEnum,
  AISessionState,
  ModelProviderEnum,
  OrchestrationProps,
  OrchestrationType,
  ServerMessage,
  AgentComponentProps,
} from "@/src/lib/types"; // Get enum from original types
import { ORCHESTRATION_PROMPT_SELECT } from "../prompt/orchestration-prompt-select";

import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "@langchain/openai";
import { ORCHESTRATION_load_agent_tools } from "./load-agent-tools";
import { ORCHESTRATION_getProviderOptions } from "./provider-options"; // Import the new function
import { ValidationSchema } from "../types/base";


/**
 * Internal helper to validate a worker agent's text response against expected criteria.
 */
async function _validateWorkerResponse(
  {
    originalTaskMessage,
    expectedOutput,
    agentResponseText,
    validationModel, // Pass the model to use for validation
    agentName,
  }: {
    originalTaskMessage: string;
    expectedOutput: any; // Type appropriately if you have a defined structure
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
      maxRetries: 1, // Allow one retry for the validation call itself if needed
    });
    logger.log(`Validation result for ${agentName}:`, validationResult.object);
    return validationResult.object;
  } catch (error) {
    logger.error(`Error during validation call for ${agentName}:`, { error });
    // Default to failing validation if the validation call itself errors
    return {
      meetsCriteria: false,
      reason: `Validation check failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// --- Helper Functions (Adapted from agent-channels.tsx) --- //

// Basic rate limiting
async function waitForRateLimit() {
  await new Promise((resolve) => setTimeout(resolve, 500)); // Reduced delay for internal calls
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
  // Use the global vector store client instead of creating a new instance
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
// We may not need to revise the text message here. Well see.
  try {
    // const queryForSemanticSearch =
    //   await ORCH_PROMPT_UTILS_message_to_semantic_query(
    //     currentTaskMessage,
    //     currentHistorySnapshot,
    //     currentContextSets,
    //     currentAgent.name
    //   );

    prompt = await ORCHESTRATION_PROMPT_SELECT(
      promptContext,
      currentTaskMessage
      //queryForSemanticSearch
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
): Promise<{ // Define a return type for success/failure
    success: true;
    directives: z.infer<T>;
} | {
    success: false;
    error: string;
    extractedMessage: string | null; // Extracted message from the first failed attempt
}> {
    let attempt = 1;
    let lastError: any = null;
    let extractedMessageFromFirstAttempt: string | null = null;
    let invalidObjectFromFirstAttempt: any = null;

    while (attempt <= 2) { // Allow initial attempt + 1 retry
        logger.log(`Calling model ${model.modelId} for manager ${agentName} with generateObject (Attempt ${attempt})`);
        let currentMessages = initialMessages;
        let currentSystemPrompt = systemPrompt;

        // Modify messages/prompt for retry attempt
        if (attempt > 1 && lastError) {
            // --- Construct Feedback Message ---
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
            // --- End Feedback Construction ---

            currentMessages = [
                ...initialMessages,
                { role: 'assistant', content: JSON.stringify(invalidObjectFromFirstAttempt) || extractedMessageFromFirstAttempt || "Invalid response format." },
                { role: 'user', content: validationFeedback }
            ];
            // Optionally modify system prompt for retry if needed
            // currentSystemPrompt = systemPrompt + "\n\nRETRY ATTEMPT: Please carefully address the validation feedback.";
        }

        try {
            const structuredResponse = await generateObject({
                model: model,
                system: currentSystemPrompt,
                messages: currentMessages,
                schema: schema,
                maxRetries: 0, // No automatic retries within this helper either
                providerOptions: providerOptions,
            });

            logger.agent(`${agentName} manager directives received (Attempt ${attempt} - Success):`, {
                destination: (structuredResponse.object as any)?.messageTo,
                complete: (structuredResponse.object as any)?.workflowComplete,
            });
            // Success! Return the validated object.
            return { success: true, directives: structuredResponse.object };

        } catch (error) {
            lastError = error; // Store error for potential retry feedback
            const isValidationError = error instanceof Error && (
                error.name === 'ZodError' ||
                error.name === 'AI_TypeValidationError' ||
                (error.cause && error.cause instanceof Error && error.cause.name === 'ZodError')
            );

            if (isValidationError) {
                logger.warn(`Manager ${agentName} generateObject validation failed (Attempt ${attempt}):`, { error });
                if (attempt === 1) {
                    // --- Extract Message on First Failure ---
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
                     // --- End Extraction ---
                }
                // Increment attempt and loop continues for retry if attempt < 2
            } else {
                // Handle other unexpected errors immediately
                logger.error(`Unexpected error during generateObject call for ${agentName} (Attempt ${attempt}):`, { error });
                // Bail out on unexpected errors, don't retry
                return {
                    success: false,
                    error: `Unexpected error during generateObject: ${error instanceof Error ? error.message : String(error)}`,
                    extractedMessage: extractedMessageFromFirstAttempt // Return message from first attempt if available
                };
            }
        }
        attempt++; // Increment attempt counter
    }

    // If loop finishes, it means all attempts (initial + retry) failed validation
    logger.error(`Manager ${agentName} generateObject failed validation after all attempts.`);
    return {
        success: false,
        error: `Manager response failed schema validation after all attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
        extractedMessage: extractedMessageFromFirstAttempt // Return message from first attempt
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

  const memStore = await createMemoryStore(); // Keep memory store creation

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

  try {
    logger.agent(`Executing turn for ${agentName}...`, {
      message: message.substring(0, 100),
    });

    // --- Extract Expected Output ---
    let expectedOutputCriteria: any = null; // Initialize criteria as null
    let originalTaskMessageForValidation = message; // Store the original message before modification
    const managerAgent = fullTeam.agents.find(agent => agent.type === AgentTypeEnum.MANAGER);
    const managerMessageIndex = orchestrationState.conversationHistory.findLastIndex(msg => // Find the *most recent* relevant manager message
      msg.agentName === managerAgent?.name &&
      msg.agentDirectives?.messageTo === agentName &&
      msg.expectedOutput
    );

    let messageWithCriteria = message; // Default to original message

    if (managerMessageIndex !== -1) {
        const originalManagerMessage = orchestrationState.conversationHistory[managerMessageIndex];
        if (originalManagerMessage?.expectedOutput) {
            expectedOutputCriteria = originalManagerMessage.expectedOutput;
            // Keep the original task description separate for validation
            originalTaskMessageForValidation = originalManagerMessage.agentDirectives?.message || message;
            const criteriaText = JSON.stringify(expectedOutputCriteria, null, 2);
            // Append criteria *only* if expectedOutputCriteria is found
            messageWithCriteria = `${message}\n\n--- EXPECTED OUTPUT CRITERIA ---\nPlease ensure your response *directly* and *completely* addresses the task according to these criteria:\n${criteriaText}\n\nProvide only the requested output, not just confirmation.`;
            logger.log(`Including expected output criteria for worker agent ${agentName}`);
        }
    }
    // --- End Extract Expected Output ---


    // 1. Construct Prompt Context (Modify this part)
    const promptContext: OrchestrationPromptContext = {
        orchestrationType: orchestrationState.config.type,
        agentOrder: orchestrationState.config.agentOrder || "sequential",
        currentAgent: agentConfig,
        allAgents: fullTeam.agents,
        teamName: teamName,
        userId: userId,
        initialMessage: orchestrationState.config.initialMessage,
        teamObjective: orchestrationState.config.objectives,
        currentTaskMessage: messageWithCriteria, // Use message with criteria details
        currentRound: orchestrationState.currentRound,
        currentCycleStep: orchestrationState.currentCycleStep,
        currentHistorySnapshot: history,
        currentContextSets: contextSets,
        numRounds: orchestrationState.config.numRounds ?? 0,
        expectedOutputCriteria: expectedOutputCriteria, // Pass the found criteria
    };

    // 2. Generate Base Prompt (Now uses the context which includes criteria)
    const basePrompt = await ORCHESTRATION_generatePrompt(promptContext);

    const truncatedPrompt = truncateMessage(basePrompt); // Truncate the prompt generated by ORCHESTRATION_generatePrompt
    logger.prompt(`${agentName} prompt (truncated)`, {
      prompt: truncatedPrompt.substring(0, 500) + "...",
    });

    // 3. Prepare History for Model (Worker agents do not receive history)
    logger.log(`Clearing history for worker agent ${agentName}. Only current task message will be sent.`);
    let currentConversation: CoreMessage[] = []; // Initialize as empty for worker agents

    // Always add the current message (with criteria) for the agent to process
    // Check if it's already the *only* message
    const isCurrentMessageOnly = currentConversation.length === 1 && currentConversation[0].role === "user" && currentConversation[0].content === messageWithCriteria;

    if (!isCurrentMessageOnly) {
         // Ensure the current message is added (it should be the only one initially here)
         currentConversation = currentConversation.filter(msg => !(msg.role === "user" && msg.content === messageWithCriteria)); // Clear potentially duplicated user messages if logic changes later
         currentConversation.push({ role: "user", content: messageWithCriteria });
    }


    // 4. Load Tools (Remains the same)
    let tools = {};
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
    }

    // 5. Get Provider Options (Remains the same)
    const providerOptions = ORCHESTRATION_getProviderOptions(agentConfig);

    // 6. Execute Model Call (Initial Attempt)
    const model = await MODEL_getModel_ai(agentConfig.modelArgs);
    logger.log(`Calling model ${model.modelId} for agent ${agentName} (Attempt 1)`);

    let responseText = ""; // Initialize response text
    let attempt = 1;
    const maxAttempts = expectedOutputCriteria ? 2 : 1; // Allow retry only if criteria exist
    let validationOutcome: z.infer<typeof ValidationSchema> | null = null;

    while (attempt <= maxAttempts) {
        try {
            // --- START: Add Input Size Logging ---
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
            // --- END: Add Input Size Logging ---

            const response = await generateText({
                model: model,
                system: agentConfig.modelArgs.modelName === "o1-mini" || // Handle specific model needs
                        agentConfig.modelArgs.modelName === "o1-preview"
                          ? undefined
                          : truncatedPrompt,
                messages: currentConversation, // Use potentially modified history on retry
                ...(Object.keys(tools).length > 0 ? { tools } : {}),
                ...(Object.keys(providerOptions).length > 0 ? { providerOptions } : {}),
                maxRetries: 0, // Disable automatic retries within generateText
                maxSteps: 10,
            });

            // Simply extract the text, relying on maxSteps to ensure it's the final one
            responseText = response?.text || "";

            logger.agent(`${agentName} final response text received (Attempt ${attempt}):`, { // Changed log slightly
                responseLength: responseText.length,
                firstChars: responseText.substring(0, 100) + "...",
            });

            // --- Validation Step ---
            if (expectedOutputCriteria) {
                // Choose a validation model
                const validationModel = await MODEL_getModel_ai(UTILS_getModelArgsByName(MODEL_JSON().OpenAI["gpt-4.5-preview"].name));

                // Use the responseText directly for validation
                validationOutcome = await _validateWorkerResponse({
                    originalTaskMessage: originalTaskMessageForValidation,
                    expectedOutput: expectedOutputCriteria,
                    agentResponseText: responseText, // Use the simpler responseText
                    validationModel: validationModel,
                    agentName: agentName,
                });

                if (validationOutcome.meetsCriteria) {
                    logger.log(`Validation passed for ${agentName} on attempt ${attempt}.`);
                    break; // Exit loop on successful validation
                } else {
                    logger.warn(`Validation failed for ${agentName} on attempt ${attempt}. Reason: ${validationOutcome.reason}`);
                    if (attempt < maxAttempts) {
                        // --- Prepare for Retry ---
                        const feedbackMessage = `Your previous response did not meet the required criteria.
Reason: ${validationOutcome.reason || 'Not specified.'}
Expected Output Criteria:
---
${JSON.stringify(expectedOutputCriteria, null, 2)}
---
CRITICAL: Review the criteria and your failed response. Revise your response to strictly adhere to *all* expected criteria and provide the complete result *directly*. Do NOT just acknowledge the task. Generate the final output now.`; // Reinforced feedback still useful here

                        // Use the 'responseText' which should now be the failed synthesized response
                        currentConversation = [
                            ...currentConversation,
                            { role: 'assistant', content: responseText },
                            { role: 'user', content: feedbackMessage }
                        ];
                        logger.log(`Preparing retry for ${agentName} (Attempt ${attempt + 1})`);
                    } else {
                         logger.error(`Validation failed for ${agentName} after ${maxAttempts} attempts. Using last response.`);
                         // Optionally modify the responseText to indicate failure?
                         // responseText = `(Validation Failed: ${validationOutcome.reason}) ` + responseText;
                    }
                }
            } else {
                // No criteria to validate, break after first attempt
                break;
            }
            // --- End Validation Step ---

        } catch (genError) {
             logger.error(`Error during generateText call for ${agentName} (Attempt ${attempt}):`, { genError });
             responseText = `Error during agent execution (Attempt ${attempt}): ${genError instanceof Error ? genError.message : String(genError)}`;
             // If the generation itself fails, break the loop, don't retry validation
             break;
        }
        attempt++;
    } // End While Loop


    // 7. Format Result
    const result: AgentTurnResult = {
      // Use the final responseText after attempts/validation
      response: responseText || "No response generated by agent.",
      agentName: agentName,
      contextModified: false, // Worker agents typically don't modify context directly here
      // Optionally include validation status in result if needed for downstream logic
      validationStatus: validationOutcome ?? undefined,
    };

    // Update UI state after agent turn completes (Remains the same)
    // await updateUIState(orchestrationState); // Consider if this should be inside/outside loop or just at end

    return result;

  } catch (error: any) {
    logger.error(`Unhandled error during ${agentName} turn:`, { error });
    return {
      response: `Error during agent execution: ${error.message || "Unknown error"}`,
      agentName: agentName,
      error: error.message || "Unknown error during agent execution",
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
  
  // Create memory store here on the server where it has API key access
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

    // Context sets schema
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

    // Edit context sets schema
    

    // Manager output schema (derived from ManagerDirectiveResult)
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

    // 1. Construct Prompt Context
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

    // 2. Generate Prompt using the context
    const prompt = await ORCHESTRATION_generatePrompt(promptContext);
    logger.prompt(prompt, {
      agentName: agentName,
    }); 
    console.log(`${agentName} prompt`, prompt);
    const truncatedPrompt = truncateMessage(prompt);
    logger.prompt(prompt, {
      agentName: agentName,
    });

    // 3. Prepare History for Model
    const validCoreRoles: CoreMessage['role'][] = ["user", "assistant", "system"];
    const currentConversation = history
        .filter(msg => validCoreRoles.includes(msg.role as CoreMessage['role']))
        .map(msg => ({
             role: msg.role as CoreMessage['role'],
             content: msg.content || "",
        })) as CoreMessage[];

    // Add the current user message as a CoreMessage only if it's not already in history
    const isMessageInHistory = history.some(msg => 
      msg.role === "user" && msg.content === message
    );
    
    if (!isMessageInHistory) {
      currentConversation.push({ role: "user", content: message });
    }

    // 4. Skip tools since generateObject does not support them
    // let tools = {};
    // if (orchestrationState.currentAgent) {
    //      tools = await ORCHESTRATION_load_agent_tools(
    //         orchestrationState.currentAgent,
    //         orchestrationState.config,
    //         contextSets,
    //         history,
    //         memStore,
    //         [],
    //         orchestrationState.config.objectives,
    //         state
    //       );
    // }
   
    // 5. Get Provider Options
    const providerOptions = ORCHESTRATION_getProviderOptions(agentConfig);

    // 6. Execute Model Call using the retry helper function
    const model = await MODEL_getModel_ai(agentConfig.modelArgs);

    // ---- START EDIT ----
    const generationResult = await _generateManagerDirectivesWithRetry({
        model: model,
        systemPrompt: truncatedPrompt,
        initialMessages: currentConversation as CoreMessage[],
        schema: AgentDirectivesSchema,
        providerOptions: providerOptions,
        agentName: agentName,
    });

    // Check if the generation failed after retries
    if (!generationResult.success) {
        // --- Step 5: Fallback Logic ---
        logger.error(`Manager ${agentName} failed to generate valid directives after retry. Implementing fallback.`);

        // Create a default directive to message the user about the failure
        const fallbackDirectives: z.infer<typeof AgentDirectivesSchema> = {
             messageTo: "user", // Direct the message to the user
             message: generationResult.extractedMessage || `I encountered an issue generating my next instruction after multiple attempts. Error: ${generationResult.error}. Please advise or try again.`, // Use extracted message or a generic error
             workflowComplete: false, // Workflow is not complete
             contextUpdates: false, // No reliable context updates were generated
             isInfoRequest: false, // Not an info request
             // No contextSetUpdate or expectedOutput in fallback
        };

        // Return an AgentTurnResult representing this fallback directive
        return {
            response: fallbackDirectives.message, // The message to be sent (to the user)
            agentName: agentName,
            error: generationResult.error, // Include the final error message
            agentDirectives: fallbackDirectives, // Include the fallback directives
            contextModified: false, // Indicate no context was reliably modified
            // Optionally include raw invalid object if useful for debugging
            // invalidRawObject: generationResult.invalidObjectFromFirstAttempt
        };
        // --- End Step 5 ---
    }

    // If successful, the directives are in generationResult.directives
    const finalDirectives = generationResult.directives;
    // ---- END EDIT ----


    // 7. Format Result using the successful directives
    const result: AgentTurnResult = {
      response: finalDirectives.message, // Use message from validated directives
      agentName: agentName,
      // Manager can actually modify context through structured directives
      contextModified: finalDirectives.contextUpdates,
      // Include directives
      agentDirectives: finalDirectives, // Use the validated directives object
    };

    // Process context modifications - check both info request and explicit updates
    if ((finalDirectives.isInfoRequest && finalDirectives.messageTo === "user") ||
        (finalDirectives.contextUpdates && finalDirectives.contextSetUpdate)) {

        // Start with current context sets
        let updatedContextSets = [...contextSets];

        // Process form request first if needed
        if (finalDirectives.isInfoRequest && finalDirectives.messageTo === "user") {
            const { processInfoRequestContextForm } = await import("./context-processor");
            const formContextResult = await processInfoRequestContextForm(
                finalDirectives.message,
                updatedContextSets, // Use already updated context
                agentConfig,
                history,
                orchestrationState.config.teamName
            );

            // Update the context with the correct result
            updatedContextSets = formContextResult.updatedContextSets;

            // Update the result contextSets
            result.allContextSets = updatedContextSets;


            // Append form prompt text
            result.response += "\n\n**Please fill out the form below to provide the requested information.**";
        }

        // Process explicit contextSetUpdate if present (handle potential overlap with form logic if necessary)
        // Note: The original code seemed to defer this to manager-directed.ts, adjust if needed here
        if (finalDirectives.contextUpdates && finalDirectives.contextSetUpdate) {
             logger.log(`Manager ${agentName} provided explicit contextSetUpdate directive.`);
             // Placeholder for processing contextSetUpdate directly if needed
             // Example:
             // const { processContextSetUpdate } = await import('./context-processor');
             // updatedContextSets = processContextSetUpdate(finalDirectives.contextSetUpdate, updatedContextSets);
             // result.allContextSets = updatedContextSets;
        }
    }


    return result;
  } catch (error: any) {
    // This outer catch now primarily handles errors *outside* the generateObject call itself
    logger.error(`Error during manager ${agentName} turn execution:`, { error });
    return {
      response: `Error during manager execution: ${error.message || "Unknown error"}`,
      agentName: agentName,
      error: error.message || "Unknown error during manager execution",
    };
  }
}
