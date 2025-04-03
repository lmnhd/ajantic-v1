import { AgentComponentProps, AgentUserResponse, ModelArgs, OrchestrationProps, ServerMessage, ContextContainerProps } from '@/src/lib/types';
import { implicitOrchestratorAnalyze } from './implicit-orchestrator';
import { logger } from '@/src/lib/logger';
import { THINKING_MODELS } from '@/src/app/api/model/model-types';
import { basicAgentChat } from '../../../../agent-channels';
import { ORCHESTRATION_PAUSE_clearContinueFlag, ORCHESTRATION_PAUSE_continueChat, ORCHESTRATION_PAUSE_isChatPaused } from './pause-chat';
import { isChatCancelled, clearCancellationFlag } from './cancel-chat';
import { setCurrentActiveAgent } from './initialize-state';
import { AnalysisState } from '../../../../store/analysis-store';

/**
 * Processes a single agent's turn in the orchestration sequence
 */
export async function processSingleAgentTurn(
  props: OrchestrationProps,
  currentAgents: AgentComponentProps[],
  currentConversation: ServerMessage[],
  localState: any,
  userId: string,
  teamName: string,
  objectives: string,
  contextSets: ContextContainerProps[],
  set: (state: Partial<AnalysisState>) => void,
  isFirstAgentInFirstRound: boolean
): Promise<{
  updatedConversation: ServerMessage[];
  agentResponse: string | null;
  continueProcessing: boolean;
  contextSets: ContextContainerProps[];
  error?: string | null;
}> {
  try {
    // Check if chat is cancelled
    if (isChatCancelled()) {
      clearCancellationFlag();
      set({ agentActive: false });
      logger.log("Chat Cancelled");
      return { updatedConversation: currentConversation, agentResponse: null, continueProcessing: false, contextSets: contextSets };
    }
    
    // Check for pause state
    handleOrchestrationPause(props);
    
    // Set current agent and update UI
    let currentAgent = props.agentOrder === "auto" ? props.currentAgent : currentAgents[props.currentCycleStep];
    props.currentAgent = currentAgent;
    props.extras!.hasKnowledgeBase = currentAgent.hasKnowledgeBase || false;
    props.isThinkingModel = THINKING_MODELS.includes(currentAgent.modelArgs.modelName as string);
    
    await setCurrentActiveAgent(set, localState, currentAgent);
    
    // Determine current message
    const currentMessage = determineCurrentMessage(props, currentConversation);
    props.extras!.query = currentMessage;
    
    // Update UI with current message
    const updatedConversationWithUserMessage = [...currentConversation, {
      role: "user" as const,
      content: currentMessage
    } as ServerMessage];
    
    set({ currentConversation: updatedConversationWithUserMessage });
    
    // Determine response type
    updateResponseType(props);
    
    // Get relevant conversation history for this agent
    const relevantConversation = getRelevantConversationHistory(props, currentConversation);
    
    // Process the agent response
    const result = await basicAgentChat(
      currentMessage,
      "", // No additional query
      relevantConversation,
      { agents: currentAgents, name: teamName, objectives: objectives },
      contextSets,
      null, // No foundational props
      localState,
      userId,
      teamName,
      false, // msgGoRound
      false, // streaming
      [], // No text chat props
      props
    );
    
    // Format the conversation update with the agent's response
    const updatedConversation = formatAgentConversationUpdate(
      currentConversation, 
      currentMessage, 
      result?.response as string || "", 
      props.currentAgent.name,
      isFirstAgentInFirstRound
    );
    
    return {
      updatedConversation,
      agentResponse: result?.response as string || null,
      continueProcessing: true,
      contextSets: result?.context as ContextContainerProps[] || []
    };
  } catch (error) {
    console.error("Error in processSingleAgentTurn", error);
    logger.error("Error in processSingleAgentTurn", {
      error,
      agent: props.currentAgent?.name,
    });
    
    return {
      updatedConversation: currentConversation,
      agentResponse: null,
      continueProcessing: false, // Continue to next agent despite error
      contextSets: contextSets,
      error: `Error in processSingleAgentTurn: ${error}`
    };
  }
}

/**
 * Handles the pause state for orchestration
 */
export async function handleOrchestrationPause(props: OrchestrationProps): Promise<void> {
  ORCHESTRATION_PAUSE_clearContinueFlag();
  
  if ((props.currentCycleStep !== 0 || props.currentRound > 0) && ORCHESTRATION_PAUSE_isChatPaused()) {
    // Loop until the chat is unpaused
    while (ORCHESTRATION_PAUSE_isChatPaused() && !ORCHESTRATION_PAUSE_continueChat()) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

/**
 * Determine the current message to send to the agent
 */
export function determineCurrentMessage(props: OrchestrationProps, currentConversation: ServerMessage[]): string {
  return props.currentRound === 0 && props.currentCycleStep === 0
    ? props.currentSummary ? `${props.initialMessage}` : props.initialMessage
    : `From ${currentConversation[currentConversation.length - 1].agentName}: ${
        currentConversation[currentConversation.length - 1].content
      }`;
}

/**
 * Update the response type based on current position in orchestration
 */
export function updateResponseType(props: OrchestrationProps): void {
  if (props.currentRound === 0 && props.currentCycleStep === 0) {
    props.currentStepResponseType = "initial-thought";
  } else if (
    props.currentRound === props.numRounds - 1 &&
    props.currentCycleStep === props.numAgents - 1
  ) {
    props.currentStepResponseType = "final-thought";
    props.isFinalRoundAndStep = true;
  } else {
    props.currentStepResponseType = "follow-up-thought";
  }
}

/**
 * Get the relevant conversation history for the current agent
 */
export function getRelevantConversationHistory(props: OrchestrationProps, currentConversation: ServerMessage[]): ServerMessage[] {
  if (props.currentRound === 0 && props.currentCycleStep === 0) {
    return currentConversation;
  } else {
    // Remove the last 2 messages (which would be the query to this agent we just added and the previous response)
    return currentConversation.slice(0, currentConversation.length - 2);
  }
}

/**
 * Format the conversation update with the agent's response
 */
export function formatAgentConversationUpdate(
  currentConversation: ServerMessage[],
  message: string,
  response: string,
  agentName: string,
  isFirstAgentInFirstRound: boolean
): ServerMessage[] {
  if (isFirstAgentInFirstRound) {
    return [
      ...currentConversation,
      {
        role: "user",
        content: message,
        agentName: agentName,
        createdAt: new Date(),
      } as ServerMessage,
      {
        role: "assistant",
        content: response,
        agentName: agentName,
        createdAt: new Date(),
      } as ServerMessage,
    ];
  } else {
    return [
      ...currentConversation,
      {
        role: "user",
        content: `${agentName}, what are your thoughts on this?`,
        agentName: agentName,
        createdAt: new Date(),
      } as ServerMessage,
      {
        role: "assistant",
        content: response,
        agentName: agentName,
        createdAt: new Date(),
      } as ServerMessage,
    ];
  }
}

/**
 * Handles agent sequence reordering using the implicit orchestrator
 */
export async function handleAgentSequenceReordering(
  props: OrchestrationProps,
  message: string,
  currentConversation: ServerMessage[],
  currentAgents: AgentComponentProps[],
  agentProcessCount: Map<string, number>
): Promise<{ 
  updatedAgents: AgentComponentProps[];
  updatedCurrentStep: number;
}> {
  // Only attempt reordering after the first agent or round
  if ((props.currentRound === 0 && props.currentCycleStep > 0) || (props.currentRound > 0)) {
    const redirect = await implicitOrchestratorAnalyze(
      message,
      currentConversation,
      props.currentAgent.name,
      currentAgents.filter(a => a.name !== props.currentAgent.name),
      // Agents before this message
      currentAgents.slice(0, props.currentCycleStep).map(a => a.name),
      // Agents remaining in sequence
      currentAgents.slice(props.currentCycleStep + 1).map(a => a.name)
    );
    
    if (redirect?.redirect) {
      // Validate and filter new sequence
      const filteredSequence = redirect.newAgentSequence!
        .filter(agentName => {
          const availableAgent = props.allAgents.find(a => a.name === agentName);
          const currentCount = agentProcessCount.get(agentName) || 0;
          return availableAgent && currentCount < 3;
        });

      // Insert new sequence after current position
      const updatedAgents = [
        ...currentAgents.slice(0, props.currentCycleStep),
        ...filteredSequence.map(name => 
          props.allAgents.find(a => a.name === name)!
        )
      ];
      
      logger.log("Agent sequence updated with reprocessing", {
        newSequence: updatedAgents.map(a => a.name),
        currentStep: props.currentCycleStep + 1
      });
      
      return {
        updatedAgents,
        updatedCurrentStep: props.currentCycleStep + 1
      };
    }
  }
  
  return {
    updatedAgents: currentAgents,
    updatedCurrentStep: props.currentCycleStep
  };
} 