"use server";
import { CoreMessage, generateText, generateObject } from "ai";
import { z } from "zod";
import {
  AgentTurnResult,
  AgentTurnInput,
  OrchestrationType2,
  OrchestrationConfig,
} from "../types/base"; 
import { OrchestrationPromptContext } from "../types/prompt";
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
  AgentComponentProps,
} from "@/src/lib/types"; // Get enum from original types
import { ORCHESTRATION_PROMPT_SELECT } from "../prompt/orchestration-prompt-select";
import { ORCH_PROMPT_UTILS_message_to_semantic_query } from "../prompt/orch-prompt-utils";
import { LOAD_TYPE_SPECIFIC_TOOLS } from "../../agent-channels";
import { ORCH_LEGACY_UTILS_convertToFoundationalProps } from "./legacy_utilities";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "@langchain/openai";
import { ORCHESTRATION_load_agent_tools } from "./load-agent-tools";
import { ORCHESTRATION_getProviderOptions } from "./provider-options"; // Import the new function
import { updateUIState } from "../adapter"; // Import the UI state update function




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
  const agentName = agentConfig.name || "Unknown Agent";

  try {
    logger.agent(`Executing turn for ${agentName}...`, {
      message: message.substring(0, 100),
    });

    // Check if there are expectedOutput criteria for this agent's task
    let messageWithCriteria = message;
    
    // Look for the most recent message from the manager to this agent with expectedOutput
    const originalManagerMessage = orchestrationState.conversationHistory.find(msg => 
      msg.agentName?.includes("Manager") && 
      msg.agentDirectives?.messageTo === agentName &&
      msg.expectedOutput
    );
    
    // If found, append the criteria to the message
    if (originalManagerMessage?.expectedOutput) {
      const criteria = JSON.stringify(originalManagerMessage.expectedOutput, null, 2);
      messageWithCriteria = `${message}\n\n--- EXPECTED OUTPUT CRITERIA ---\nPlease ensure your response meets these criteria:\n${criteria}\n\nProvide a complete response that addresses all the requirements above.`;
      
      logger.log(`Including expected output criteria for worker agent ${agentName}`);
    }

    // 1. Construct Prompt Context
    const promptContext: OrchestrationPromptContext = {
      orchestrationType: orchestrationState.config.type,
      agentOrder: orchestrationState.config.agentOrder || "sequential", // Use config's agentOrder or default to sequential
      currentAgent: agentConfig,
      allAgents: fullTeam.agents,
      teamName: teamName,
      userId: userId,
      initialMessage: orchestrationState.config.initialMessage,
      teamObjective: orchestrationState.config.objectives,
      currentTaskMessage: messageWithCriteria,
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
    const validCoreRoles: CoreMessage['role'][] = ["user", "assistant", "system"];
    const currentConversation = history
        .filter(msg => validCoreRoles.includes(msg.role as CoreMessage['role']))
        .map(msg => ({
             role: msg.role as CoreMessage['role'],
             content: msg.content || "",
        })) as CoreMessage[];

    // Add the current user message as a CoreMessage only if it's not already in history
    const isMessageInHistory = history.some(msg => 
      msg.role === "user" && msg.content === messageWithCriteria
    );
    
    if (!isMessageInHistory) {
      currentConversation.push({ role: "user", content: messageWithCriteria });
    }

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

    // 6. Execute Model Call with generateText instead of generateObject
    const model = await MODEL_getModel_ai(agentConfig.modelArgs);
    logger.log(`Calling model ${model.modelId} for agent ${agentName} with generateText`);

    const response = await generateText({
      model: model,
      system: agentConfig.modelArgs.modelName === "o1-mini" ||
              agentConfig.modelArgs.modelName === "o1-preview"
                ? undefined
                : truncatedPrompt,
      messages: currentConversation as CoreMessage[],
      ...(Object.keys(tools).length > 0 ? { tools } : {}),
      ...(Object.keys(providerOptions).length > 0 ? { providerOptions } : {}),
      maxRetries: 1,
      tools: tools,
    });

    logger.agent(`${agentName} text response received:`, { 
      responseLength: response?.response?.messages[0]?.content?.length || 0
    });

    // 7. Format Result
    const result: AgentTurnResult = {
      response: response?.text || "No response received from agent.",
      agentName: agentName,
      contextModified: false,
    };

    // Update UI state after agent turn completes
    await updateUIState(orchestrationState);
    
    return result;
  } catch (error: any) {
    logger.error(`Error during ${agentName} turn:`, { error });
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
    logger.prompt(`${agentName} prompt`, {
      prompt: prompt,
    }); 
    console.log(`${agentName} prompt`, prompt);
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

    // 6. Execute Model Call with generateObject for structured output
    const model = await MODEL_getModel_ai(agentConfig.modelArgs);
    logger.log(`Calling model ${model.modelId} for manager ${agentName} with generateObject`);

    // This version uses generateObject for structured output
    let structuredResponse;
    try {
      structuredResponse = await generateObject({
        model: model,
        system: truncatedPrompt,
        messages: currentConversation as CoreMessage[],
        schema: AgentDirectivesSchema,
        maxRetries: 2,
        providerOptions: providerOptions,
      });

      logger.agent(`${agentName} manager directives received:`, {
        destination: structuredResponse.object.messageTo,
        complete: structuredResponse.object.workflowComplete,
      });
    } catch (error) {
      console.log(`Error during generateObject call for ${agentName}:`, { error });
      logger.error(`Error during generateObject call for ${agentName}:`, { error });
      throw error; // Re-throw to be caught by outer try-catch
    }

    // 7. Format Result
    const result: AgentTurnResult = {
      response: structuredResponse.object.message,
      agentName: agentName,
      // Manager can actually modify context through structured directives
      contextModified: structuredResponse.object.contextUpdates,
      // Include directives
      agentDirectives: structuredResponse.object,
    };

    // Process context modifications - check both info request and explicit updates
    if ((structuredResponse.object.isInfoRequest && structuredResponse.object.messageTo === "user") || 
        (structuredResponse.object.contextUpdates && structuredResponse.object.contextSetUpdate)) {
        
        // Start with current context sets
        let updatedContextSets = [...contextSets];
        
        // Process form request first if needed
        if (structuredResponse.object.isInfoRequest && structuredResponse.object.messageTo === "user") {
            const { processInfoRequestContextForm } = await import("./context-processor");
            const formContextResult = await processInfoRequestContextForm(
                structuredResponse.object.message,
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
        
        // The rest of the commented-out code can be removed as it's handled in manager-directed.ts
    }

    
    
    return result;
  } catch (error: any) {
    logger.error(`Error during manager ${agentName} turn:`, { error });
    return {
      response: `Error during manager execution: ${error.message || "Unknown error"}`,
      agentName: agentName,
      error: error.message || "Unknown error during manager execution",
    };
  }
}
