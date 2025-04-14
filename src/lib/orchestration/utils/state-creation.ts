import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { AgentComponentProps, ServerMessage, AISessionState, ContextContainerProps, ContextSet } from "@/src/lib/types";
import { OrchestrationConfig, OrchestrationState } from "../types";
import { AnalysisState } from "@/src/lib/store/analysis-store";
import { logger } from "@/src/lib/logger";
import { OpenAIEmbeddings } from "@langchain/openai";

/**
 * Extracts agent information from the analysis state
 */
export function extractAgentsFromAnalysisState(
  analysisState: AnalysisState,
  customAgentSet: string[] = []
): AgentComponentProps[] {
  const { localState } = analysisState;
  
  // Filter and prepare the agent list based on custom set or default behavior
  if (customAgentSet.length > 0) {
    return customAgentSet
      .map(agentName => 
        localState.currentAgents.agents.find(a => a.name === agentName)
      )
      .filter(agent => agent !== undefined) as AgentComponentProps[];
  } else {
    return localState.currentAgents.agents.filter(
      agent => !agent.disabled && agent.type !== "manager"
    );
  }
}

/**
 * Initialize state from the AnalysisState getter/setter
 */
export function extractStateFromAnalysisStore(
  get: () => AnalysisState,
  set: (state: Partial<AnalysisState>) => void,
  customAgentSet: string[] = []
): {
  localState: AISessionState;
  currentConversation: ServerMessage[];
  teamName: string;
  objectives: string;
  agents: AgentComponentProps[];
  userId: string;
  contextSets: ContextContainerProps[];
  initialMessage: string;
} {
  set({ agentActive: true });
  logger.log("Extracting orchestration state from analysis store...");
  
  const analysisState = get();
  const {
    localState,
    currentConversation,
    agentGlobalChatInput: rawInput,
  } = analysisState;
  
  // Handle special input format if present
  let initialMessage = rawInput;
  if (initialMessage.includes(":::")) {
    initialMessage = initialMessage.split(":::")[1].trim();
  }
  
  // Extract required data
  const { userId } = localState;
  const teamName = localState.currentAgents.name;
  const objectives = localState.currentAgents.objectives;
  const contextSets = localState.contextSet.sets;
  
  // Get agents (filtered by customAgentSet if provided)
  const agents = extractAgentsFromAnalysisState(analysisState, customAgentSet);
  
  return {
    localState,
    currentConversation,
    teamName,
    objectives,
    agents,
    userId,
    contextSets,
    initialMessage
  };
}

/**
 * Create an initial orchestration state from configuration
 */
export function createOrchestrationState(
  config: OrchestrationConfig,
  existingHistory: ServerMessage[] = []
): OrchestrationState {
  // Add initial user message if there's no history
  let history = [...existingHistory];
  if (history.length === 0 && config.initialMessage) {
    history = [{
      role: "user",
      content: config.initialMessage,
      agentName: "User"
    }];
  }
  
  return {
    config,
    status: "initializing",
    currentRound: 0,
    currentCycleStep: 0,
    currentAgent: null,
    conversationHistory: history,
    contextSets: config.initialContext || [],
    pauseRequested: false,
    cancelRequested: false,
    continueFromPauseSignal: false
  };
}

/**
 * Initialize orchestration memory vector store
 */

export async function createMemoryStore(): Promise<MemoryVectorStore> {
  // Use the global vector store client instead of creating a new instance
  const { GLOBAL_getVectorStoreClient } = await import("@/src/lib/vectorstore_client");
  return GLOBAL_getVectorStoreClient();
} 