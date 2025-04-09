import { CoreMessage, generateText, generateObject } from "ai";
import { z } from "zod";
import {
  AgentTurnResult,
  AgentTurnInput,
  OrchestrationPromptContext,
  OrchestrationType2,
  OrchestrationConfig,
} from "../types"; // Use index export from types
import {
  UTILS_convertLineSetsToContext,
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
} from "@/src/lib/types"; // Get enum from original types
import { ORCHESTRATION_PROMPT_SELECT } from "../prompt/orchestration-prompt-select";
import { ORCH_PROMPT_UTILS_message_to_semantic_query } from "../prompt/orch-prompt-utils";
import { LOAD_TYPE_SPECIFIC_TOOLS } from "../../agent-channels";
import { ORCH_LEGACY_UTILS_convertToFoundationalProps } from "./legacy_utilities";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { ORCHESTRATION_load_agent_tools } from "./load-agent-tools";
import { ORCHESTRATION_getProviderOptions } from "./provider-options"; // Import the new function

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

// --- Main Agent Execution Function --- //

/**
 * Executes a single turn for an agent based on the provided input.
 * Adapts the core logic from `basicAgentChat`.
 *
 * @param input Data required for the agent's turn.
 * @returns The result of the agent's turn.
 */
export async function ORCHESTRATION_executeAgentTurn(
  input: AgentTurnInput,
  state: AISessionState,
  config: OrchestrationConfig,
  memStore: MemoryVectorStore
): Promise<AgentTurnResult> {
  await waitForRateLimit();

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

    // 1. Construct Prompt Context
    const promptContext: OrchestrationPromptContext = {
      orchestrationType: orchestrationState.config.type,
      currentAgent: agentConfig,
      allAgents: fullTeam.agents,
      teamName: teamName,
      userId: userId,
      initialMessage: orchestrationState.config.initialMessage,
      teamObjective: orchestrationState.config.objectives,
      currentTaskMessage: message,
      currentRound: orchestrationState.currentRound,
      currentCycleStep: orchestrationState.currentCycleStep,
      currentHistorySnapshot: history, // Use history passed in input
      currentContextSets: contextSets,
      numRounds: orchestrationState.config.numRounds ?? 0,
      // messageSource needs to be determined based on workflow logic if needed
      // messageSource: ...
    };

    // 2. Generate Prompt using the context
    const prompt = await ORCHESTRATION_generatePrompt(promptContext);
    const truncatedPrompt = truncateMessage(prompt);
    logger.prompt(`${agentName} prompt (truncated)`, {
      prompt: truncatedPrompt,
    });

    // 3. Prepare History for Model

    const validCoreRoles: CoreMessage['role'][] = ["user", "assistant", "system"]; // Define valid CoreMessage roles
    const currentConversation = history
        .filter(msg => validCoreRoles.includes(msg.role as CoreMessage['role'])) // Filter based on CoreMessage roles
        .map(msg => ({
             role: msg.role as CoreMessage['role'], // Cast to CoreMessage role
             content: msg.content || "", // Assume string content for CoreMessage
        })) as CoreMessage[]; // Assert the final mapped array type

    // Add the current user message as a CoreMessage
    currentConversation.push({ role: "user", content: message });

    // 4. Load Tools
    let tools = {};
    // More than just 'tool_operator' agents will have tools so this function sorts it out.
    if (orchestrationState.currentAgent){
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
   
    // 5. Get Provider Options
    const providerOptions = ORCHESTRATION_getProviderOptions(agentConfig);

    // 6. Define the schema for structured output
    const contextSetSchema = z.object({
        setName: z.string().describe("The name of the context set."),
        text: z.string().describe("The text content of the context set."),
        hiddenFromAgents: z.array(z.enum(['all', ...fullTeam.agents.map(a => a.name)])).optional().describe("The agents that should not see this context set. Leave empty for all agents to see.")
    })
    
    // Define schema for editing existing context sets
    const editContextSetSchema = z.object({
        originalSetName: z.string().describe("The name of the existing context set to be edited."),
        newSetName: z.string().optional().describe("The new name for the context set (optional)."),
        newText: z.string().describe("The updated text content for the context set."),
        hiddenFromAgents: z.array(z.enum(['all', ...fullTeam.agents.map(a => a.name)])).optional().describe("The agents that should not see this context set. Leave empty for all agents to see.")
    })
    
    const agentResponseSchema = z.object({
      response: z.string().describe("The message to be sent to the user or next agent."),
      messageTo: z.enum(['user', ...fullTeam.agents.map(a => a.name)]).describe("The recipient of the message."),
      newContextSets: z.array(contextSetSchema).optional().describe("Any new context sets to be added to the context. Use this to persist and share information between agents and with the user."),
      editContextSets: z.array(editContextSetSchema).optional().describe("Existing context sets to be edited. Specify the originalSetName to identify which set to update."),
      infoRequest: z.boolean().describe("Set to true if the response is an information request for the user."),
      workflowComplete: z.boolean().describe("Set to true if the workflow should terminate."),
    });

    // 6. Execute Model Call
    const model = await MODEL_getModel_ai(agentConfig.modelArgs);
    logger.log(`Calling model ${model.modelId} for agent ${agentName}`);

    const response = await generateObject({
      model: model,
      schema: agentResponseSchema,
      system: agentConfig.modelArgs.modelName === "o1-mini" ||
              agentConfig.modelArgs.modelName === "o1-preview"
                ? undefined
                : truncatedPrompt,
      messages: currentConversation as CoreMessage[],
      ...(Object.keys(tools).length > 0 ? { tools } : {}),
      ...(Object.keys(providerOptions).length > 0 ? { providerOptions } : {}),
      maxRetries: 1,
    });

    logger.agent(`${agentName} structured response received:`, { 
      response: response.object.response,
      messageTo: response.object.messageTo,
      contextUpdates: response.object.newContextSets ? response.object.newContextSets.length > 0 : false
    });

    // 7. Format Result
    const contextModified = (response.object.newContextSets ? response.object.newContextSets.length > 0 : false) || 
                            (response.object.editContextSets ? response.object.editContextSets.length > 0 : false);

    // Create a complete set of context sets that includes original, new, and edited sets
    let updatedContextCollection = [...contextSets]; // Start with the existing context sets

    // Add any new context sets
    if (response.object.newContextSets && response.object.newContextSets.length > 0) {
        updatedContextCollection = [...updatedContextCollection, ...response.object.newContextSets];
    }
    
    // Apply any edits to existing context sets
    if (response.object.editContextSets && response.object.editContextSets.length > 0) {
        response.object.editContextSets.forEach(edit => {
            const originalSetName = edit.originalSetName;
            const index = updatedContextCollection.findIndex(cs => cs.setName === originalSetName);
            
            if (index >= 0) {
                // Update the existing context set
                updatedContextCollection[index] = {
                    ...updatedContextCollection[index],
                    text: edit.newText,
                    setName: edit.newSetName || updatedContextCollection[index].setName,
                    hiddenFromAgents: edit.hiddenFromAgents || updatedContextCollection[index].hiddenFromAgents
                };
                logger.log(`Updated context set "${originalSetName}" in result object`);
            } else {
                logger.warn(`Couldn't find context set "${originalSetName}" to edit in result object`);
            }
        });
    }

    const result: AgentTurnResult = {
        response: response.object.response,
        agentName: agentName,
        contextModified: contextModified,
        // Include complete set of context sets
        updatedContextSets: response.object.newContextSets,
        editedContextSets: response.object.editContextSets,
        allContextSets: updatedContextCollection, // Add the complete collection
        // Add directives for workflow control
        agentDirectives: {
          nextAgentName: response.object.messageTo === 'user' ? agentName : response.object.messageTo,
          messageForNextAgent: response.object.response,
          redirectToUser: response.object.messageTo === 'user' || response.object.infoRequest,
          workflowComplete: response.object.workflowComplete,
          contextUpdates: contextModified
        }
    };

    return result;
  } catch (error) {
    logger.error(`Error during agent turn execution for ${agentName}`, {
      error,
    });
    return {
      response: `Error processing turn for ${agentName}.`,
      agentName: agentName,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Executes a turn for a manager agent using structured output (generateObject) to provide workflow directives.
 * This specialized function is specifically for the MANAGER_DIRECTED_WORKFLOW.
 * 
 * @param input Data required for the manager's turn.
 * @returns The result of the manager's turn with structured directives.
 */
export async function ORCHESTRATION_executeManagerTurn(
  input: AgentTurnInput,
  state: AISessionState,
  config: OrchestrationConfig,
  memStore: MemoryVectorStore
): Promise<AgentTurnResult> {
  await waitForRateLimit();

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

    // 1. Construct Prompt Context (same as regular execution)
    const promptContext: OrchestrationPromptContext = {
      orchestrationType: orchestrationState.config.type,
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
    const truncatedPrompt = truncateMessage(prompt);
    logger.prompt(`${agentName} prompt (truncated)`, {
      prompt: truncatedPrompt,
    });

    // 3. Prepare History for Model
    const validCoreRoles: CoreMessage['role'][] = ["user", "assistant", "system"];
    const currentConversation = history
        .filter(msg => validCoreRoles.includes(msg.role as CoreMessage['role']))
        .map(msg => ({
             role: msg.role as CoreMessage['role'],
             content: msg.content || "",
        })) as CoreMessage[];

    // Add the current user message as a CoreMessage
    currentConversation.push({ role: "user", content: message });

    // 4. Load Tools
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
   
    // 5. Get Provider Options
    const providerOptions = ORCHESTRATION_getProviderOptions(agentConfig);

    // 6. Define the schema for structured output
    const contextSetSchema = z.object({
        setName: z.string().describe("The name of the context set."),
        text: z.string().describe("The text content of the context set."),
        hiddenFromAgents: z.array(z.enum(['all', ...fullTeam.agents.map(a => a.name)])).optional().describe("The agents that should not see this context set. Leave empty for all agents to see.")
    });
    
    const managerDirectiveSchema = z.object({
      response: z.string().describe("The natural language response content."),
      nextAgentName: z.string().describe(`Name of the agent to handle the next step. Must be one of [${fullTeam.agents.map(a => a.name).join(', ')}].`),
      messageForNextAgent: z.string().describe("The specific message or instructions for the next agent."),
      redirectToUser: z.boolean().describe("Set to true ONLY if the next message should go directly to the user instead of an agent."),
      workflowComplete: z.boolean().describe("Set to true ONLY when all objectives have been met and the workflow should terminate."),
      newContextSets: z.array(contextSetSchema).optional().describe("Any new context sets to be added to the context.")
    });

    // 7. Execute Model Call with generateObject
    const model = await MODEL_getModel_ai(agentConfig.modelArgs);
    logger.log(`Calling model ${model.modelId} for manager agent ${agentName} with structured output`);

    const response = await generateObject({
      model: model,
      schema: managerDirectiveSchema,
      system: truncatedPrompt,
      messages: currentConversation as CoreMessage[],
      ...(Object.keys(tools).length > 0 ? { tools } : {}),
      ...(Object.keys(providerOptions).length > 0 ? { providerOptions } : {}),
      maxRetries: 1,
    });

    logger.agent(`${agentName} structured response received:`, { 
      response: response.object.response,
      directives: {
        nextAgentName: response.object.nextAgentName,
        redirectToUser: response.object.redirectToUser,
        workflowComplete: response.object.workflowComplete
      }
    });

    // 8. Format Result
    const contextModified = response.object.newContextSets ? response.object.newContextSets.length > 0 : false;

    const result: AgentTurnResult = {
        response: response.object.response,
        agentName: agentName,
        contextModified: contextModified,
        updatedContextSets: response.object.newContextSets,
        // Add manager directives to the result
        agentDirectives: {
          nextAgentName: response.object.nextAgentName,
          messageForNextAgent: response.object.messageForNextAgent,
          redirectToUser: response.object.redirectToUser,
          workflowComplete: response.object.workflowComplete,
          contextUpdates: contextModified
        }
    };

    return result;
  } catch (error) {
    logger.error(`Error during manager turn execution for ${agentName}`, {
      error,
    });
    return {
      response: `Error processing manager turn for ${agentName}.`,
      agentName: agentName,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
