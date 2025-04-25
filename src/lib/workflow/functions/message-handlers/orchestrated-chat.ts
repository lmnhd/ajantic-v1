// This file runs on the client side by default
import {
  AgentComponentProps,
  AgentFoundationalPromptProps,
  AgentTypeEnum,
  AgentUserResponse,
  AISessionState,
  AutoOrchestrationProps,
  ContextContainerProps,
  ContextSet,
  ModelArgs,
  ModelProviderEnum,
  OrchestrationProps,
  ServerMessage,
} from "@/src/lib/types";
import { OrchestrationType2 } from "@/src/lib/orchestration/types/base";
import { AnalysisState } from "../../../store/analysis-store";

import { updateMessages } from "../message-handlers";
import { logger } from "@/src/lib/logger";
import { summarizeConversation } from "./orchestrated-chat/summarize-conversation";
import {
  clearCancellationFlag,
  isChatCancelled,
  ORCHESTRATION_CANCEL_clearAllFlags,
} from "./orchestrated-chat/cancel-chat";

import { TextChatLogProps } from "@/src/lib/text-chat-log";

import {
  ORCHESTRATION_PAUSE_isChatPaused,
  ORCHESTRATION_PAUSE_clearFlag,
  ORCHESTRATION_PAUSE_clearContinueFlag,
  ORCHESTRATION_PAUSE_continueChat,
  ORCHESTRATION_PAUSE_resetAllFlags,
} from "./orchestrated-chat/pause-chat";
import { isConversationMemoryWorthy } from "./orchestrated-chat/wf-orch-memory";
import { THINKING_MODELS } from "@/src/app/api/model/model-types";
import {
  UTILS_cleanConversationForStorage,
  UTILS_getModelArgsByName,
  UTILS_getModelsJSON,
} from "@/src/lib/utils";

// New imports for refactored modules
import {
  initializeOrchestrationState,
  setCurrentActiveAgent,
  createOrchestrationProps,
} from "./orchestrated-chat/initialize-state";
import {
  processSingleAgentTurn,
  handleOrchestrationPause,
  handleAgentSequenceReordering,
} from "./orchestrated-chat/agent-processing";
import {
  summarizeCurrentConversation,
  handleInfoNeededFromUser,
  handleUserActionNeeded,
  storeConversation,
  updateContextFromConversation,
  storeConversationInMemory,
  finalizeOrchestration,
} from "./orchestrated-chat/conversation-management";
import {
  autoRedirectOrchestrator,
  autoRedirectOrchestrator2,
  autoRedirectOrchestrator3,
  handleNextAutoAgent,
} from "./orchestrated-chat/auto-agent-next";
import { toast } from "@/components/ui/use-toast";
import { ORCHESTRATION_autoModeRedirect } from "./orchestrated-chat/auto-redirect";

// New orchestration adapter imports
import { 
  runOrchestration, 
  createOrchestrationConfig,
  createInitialOrchestrationState 
} from "@/src/lib/orchestration/adapter";
import { 
  extractStateFromAnalysisStore,
  createOrchestrationState,
} from "@/src/lib/orchestration/utils/state-creation";
import { MemoryVectorStore } from "langchain/vectorstores/memory";

// Server-related imports using next.js patterns
import { CONVERSATION_store, formatDayName } from "../../../conversation";
import { MEMORY_store } from "../../../agent-memory/store-retrieve";

export interface BasicAgentChatProps {
  message: string;
  query: string;
  currentConversation: ServerMessage[];
  agentsByName: {
    agents: AgentComponentProps[];
    name: string;
    objectives: string;
  };
  contextSets: ContextContainerProps[];
  foundationalProps: AgentFoundationalPromptProps | null;
  localState: AISessionState;
  userId: string;
  teamName: string;
  msgGoRound: boolean;
  streaming: boolean;
  textChatProps: TextChatLogProps[];
  orchestrationProps: OrchestrationProps;
}

/**
 * Main client-side orchestration handler
 * Handles the orchestration process and UI updates, making server calls only when necessary
 * 
 * @todo Complete the migration to OrchestrationType2 fully after testing
 */
export async function handleOrchestratedChatSubmit(
  orchType: OrchestrationType2,
  numRounds: number, // 0 means unlimited rounds up to maxRounds - will stop when a natural conclusion is reached
  maxRounds: number = 10, // Only has effect if numRounds is 0
  order: "sequential" | "seq-reverse" | "random" = "sequential",
  get: () => AnalysisState,
  set: (state: Partial<AnalysisState>) => void,
  customAgentSet: string[] = [],
  implicitOrchestratorModelArgs: ModelArgs = UTILS_getModelArgsByName(
    UTILS_getModelsJSON().OpenAI["gpt-3.5-turbo-0125"].name,
    0
  ),
  userActionModelArgs: ModelArgs = UTILS_getModelArgsByName(
    UTILS_getModelsJSON().OpenAI["gpt-3.5-turbo-0125"].name,
    0
  ),
  factCheck: boolean = false
) {
  logger.log("Orchestrated chat starting with params:", {
    orchType, numRounds, maxRounds, order, customAgentSet
  });

  try {
    // Extract state data - runs on client
    const stateData = extractStateFromAnalysisStore(get, set, customAgentSet);
    
    // Set UI to active state - runs on client
    set({ agentActive: true });
    await new Promise(resolve => setTimeout(resolve, 500));

    // Add the manager agent to the agents array if this is a dynamic workflow
    const allAgents = stateData.localState.currentAgents;
    let agents: AgentComponentProps[] = (customAgentSet && customAgentSet.length > 0) ? allAgents.agents.filter(agent => customAgentSet.includes(agent.name)) : allAgents.agents;
    if ((orchType === OrchestrationType2.LLM_ROUTED_WORKFLOW || orchType === OrchestrationType2.MANAGER_DIRECTED_WORKFLOW) && !agents.some(agent => agent.type === "manager")) {
      agents.push(allAgents.agents.find(agent => agent.type === "manager")!);
      agents.reverse();
    }
    
    
    // Create orchestration config - runs on client
    const config = {
      type: orchType,
      initialMessage: stateData.initialMessage,
      agents: agents,
      teamName: stateData.teamName, 
      objectives: stateData.objectives,
      userId: stateData.userId,
      initialContext: stateData.contextSets,
      maxRounds,
      numRounds,
      customAgentSet,
      streaming: true,
      agentOrder: order
    };
    
    // Create initial orchestration state - runs on client
    const initialState = createOrchestrationState(
      config,
      stateData.currentConversation
    );
    
    logger.log("Running orchestration with type:", { orchType });
    
    // Run the orchestration process on the client 
    // The orchestration itself will make server calls when needed for LLM operations
    const result = await runOrchestration(
      orchType,
      order,
      initialState,
      stateData.localState
    );
    
    logger.log("Orchestration completed with status:", { status: result.status });
    
    // Get the current client-side context sets BEFORE setting the final state
    const currentClientContextSet = get().localState.contextSet;

    // Check for context deletion metadata in the conversation history
    const deletedContextSets = new Set<string>();
    result.finalConversationHistory.forEach(message => {
      if (message.contextDeleted && message.contextDeleted.length > 0) {
        message.contextDeleted.forEach(deletion => {
          deletedContextSets.add(deletion.deletedSet);
        });
      }
    });
    
    if (deletedContextSets.size > 0) {
      logger.log("Detected explicitly deleted context sets:", { deletedSets: [...deletedContextSets] });
    }

    // Perform the merge logic similar to updateLocalState
    const incomingSets = result.finalContextSets ?? [];
    const currentClientSets = currentClientContextSet?.sets ?? [];

    const incomingSetsMap = new Map(incomingSets.map(set => [set.setName, set]));
    
    // Only preserve disabled sets that weren't explicitly deleted
    const disabledSetsToPreserve = currentClientSets.filter(
      set => set.isDisabled && 
            !incomingSetsMap.has(set.setName) && 
            !deletedContextSets.has(set.setName)
    );
    
    if (disabledSetsToPreserve.length > 0) {
      logger.log("Preserving disabled context sets:", { 
        preservedSets: disabledSetsToPreserve.map(s => s.setName) 
      });
    }
    
    const finalMergedSets = [...incomingSets, ...disabledSetsToPreserve];

    // Update the UI with the MERGED result
    set({
      agentActive: false,
      currentConversation: result.finalConversationHistory,
      contextSet: {
        sets: finalMergedSets, // Use the merged sets
        teamName: stateData.teamName // Keep existing team name or use one from result if available
      }
    });

    // Persist the updated state to prevent it from reverting
    await get().saveState();
    
    // If there was an error, show a toast - runs on client
    if (result.status === "error" && result.error) {
      toast({
        title: "Orchestration Error",
        description: result.error,
        variant: "destructive",
      });
    }
    
    // Store conversation to database using server action
    await storeResults(
      result.finalConversationHistory,
      stateData.userId,
      stateData.agents,
      stateData.teamName
    );
    
    // Reset all control flags for cleanup - runs on client
    ORCHESTRATION_PAUSE_clearFlag();
    ORCHESTRATION_CANCEL_clearAllFlags();
              
  } catch (error) {
    logger.error("Error in handleOrchestratedChatSubmit:", { error });
    
    // Show error to user - runs on client
    toast({
      title: "Orchestration Failed",
      description: error instanceof Error ? error.message : "Unknown error occurred",
      variant: "destructive",
    });

    // Reset UI state - runs on client
    set({ agentActive: false });
    
    // Reset control flags - runs on client
    ORCHESTRATION_PAUSE_resetAllFlags();
    ORCHESTRATION_CANCEL_clearAllFlags();
    
    throw error; // Re-throw to preserve the original error
  }
}

/**
 * Handle storing results to the database and memory
 * This is a server function to access the database
 */

async function storeResults(
  finalConversationHistory: ServerMessage[],
  userId: string,
  agents: AgentComponentProps[],
  teamName: string
): Promise<void> {
  try {
    // Get formatted day name
    const today = new Date();
    const dayName = await formatDayName(today);
    
    // Store conversation to database
    await CONVERSATION_store({
      dayName,
      userId: userId,
      conversations: UTILS_cleanConversationForStorage(finalConversationHistory)
    });
    
    // Store in memory if worthy
    if (await isConversationMemoryWorthy(finalConversationHistory)) {
      // Create agent info for memory
      const agentInfos = agents.map(agent => ({
        name: agent.name,
        roleDescription: agent.roleDescription || "",
        title: agent.title || ""
      }));
      
      await MEMORY_store(
        finalConversationHistory,
        agentInfos,
        userId
      );
    }
  } catch (error) {
    logger.error("Error storing results:", { error });
    // Don't throw - we want to continue even if storage fails
  }
}

//this agent will add nuance and subtlety to the conversations and will also be critical of whether or not the team is making progress with the task or discussion

//TODO: Lets brainstorm and create a verified list of common day use cases for AI automation that have not been overwhelmingly addressed by existing AI tools
//TODO: develop a system to help market an AI company
//TODO: clickbank
//TODO: pull random lyric, make description, test several models, see which writes similar to lyrics

//Provides radical new ideas and unique innovative solutions to an AI think tank
