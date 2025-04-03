import { AnalysisState } from '../../../../store/analysis-store';
import { AgentComponentProps, AISessionState, ContextContainerProps, OrchestrationProps, OrchestrationType, ServerMessage } from '@/src/lib/types';
import { logger } from '@/src/lib/logger';

/**
 * Initializes state variables and extracts required data from the analysis state for orchestration
 */
export function initializeOrchestrationState(
  get: () => AnalysisState,
  set: (state: Partial<AnalysisState>) => void,
  customAgentSet: string[] = []
): {
  localState: AISessionState;
  currentConversation: ServerMessage[];
  teamName: string;
  objectives: string;
  currentAgents: AgentComponentProps[];
  userId: string;
  contextSet: { sets: ContextContainerProps[]; teamName: string; };
  agentGlobalChatInput: string;
} {
  set({ agentActive: true });
  
  // Give UI time to update
  logger.log("Initializing orchestration state...");
  
  const analysisState = get();
  
  const {
    localState,
    currentConversation,
    contextSetStore,
    agentGlobalChatInput: rawAgentGlobalChatInput,
  } = analysisState;
  
  // Handle special input format if present
  let agentGlobalChatInput = rawAgentGlobalChatInput;
  if (agentGlobalChatInput.includes(":::")) {
    agentGlobalChatInput = agentGlobalChatInput.split(":::")[1].trim();
  }
  
  // Extract required data from local state
  const { contextSet, userId } = localState;
  const teamName = localState.currentAgents.name;
  const objectives = localState.currentAgents.objectives;
  
  // Filter and prepare the agent list based on custom set or default behavior
  const currentAgents = customAgentSet.length > 0
    ? customAgentSet.map(
        (agent) =>
          localState.currentAgents.agents.find(
            (a) => a.name === agent
          ) as AgentComponentProps
      )
    : localState.currentAgents.agents.filter(
        (agent) => !agent.disabled && agent.type !== "manager"
      );
      
  return {
    localState,
    currentConversation,
    teamName,
    objectives,
    currentAgents,
    userId,
    contextSet,
    agentGlobalChatInput
  };
}

/**
 * Sets the current agent in the sequence to the active agent
 */
export async function setCurrentActiveAgent(
  set: (state: Partial<AnalysisState>) => void,
  localState: any,
  currentAgent: AgentComponentProps
) {
  set({
    currentAgentIndex: localState.currentAgents.agents.findIndex(
      (agent: AgentComponentProps) => agent.name === currentAgent.name
    ),
  });
  
  // Give UI time to update
  await new Promise(resolve => setTimeout(resolve, 500));
}

/**
 * Creates the orchestration props object that controls flow
 */
export function createOrchestrationProps(
  chatMode: OrchestrationType,
  order: "sequential" | "seq-reverse" | "random" | "auto",
  agents: AgentComponentProps[],
  currentAgent: AgentComponentProps,
  initialMessage: string,
  userId: string,
  teamName: string,
  teamObjective: string
): OrchestrationProps {
  return {
    agentOrder: order,
    allAgents: agents,
    chatMode: chatMode,
    currentAgent: currentAgent,
    currentCycleStep: 0,
    currentRound: 0,
    currentStepResponseType: "initial-thought",
    isFinalRoundAndStep: false,
    numRounds: 0,
    numAgents: agents.length,
    initialMessage: initialMessage,
    requestFormSchema: undefined,
    isThinkingModel: false,
    extras: {
      hasKnowledgeBase: currentAgent.hasKnowledgeBase || false,
      query: initialMessage,
      userId: userId,
      teamName: teamName,
    },
    autoProps: {
      initialMessage: initialMessage,
      messageHistory: [],
      currentMessage: initialMessage,
      messageFrom: "user",
      contextSets: [],
      summarizeConversation: false,
      result: "continue",
      nextAgent: currentAgent,
      allAvailableAgents: agents,
      currentMessageRewritten: "",
      taskCompletionQuery: "",
    
    },
    teamObjective: teamObjective
  };
} 