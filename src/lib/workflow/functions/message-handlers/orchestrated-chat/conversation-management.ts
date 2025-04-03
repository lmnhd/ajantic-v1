import { ContextContainerProps, OrchestrationProps, ServerMessage, OrchestrationType } from '@/src/lib/types';
import { logger } from '@/src/lib/logger';
import { summarizeConversation } from './summarize-conversation';
import { AnalysisState } from '../../../../store/analysis-store';
import { getUserActionMessage } from './extract-user-action-request';

import { extractContextFromConversation } from './extract-context';
import { isConversationMemoryWorthy } from './wf-orch-memory';

import { UTILS_cleanConversationForStorage } from '@/src/lib/utils';
import { AgentComponentProps } from '@/src/lib/types';
import { ModelArgs } from '@/src/lib/types';
import { AGENT_FORM_creator, AGENT_FORM_reWriteRequestMessage } from '@/src/lib/post-message-analysis/agent-request-form-creator';
import { CONVERSATION_store, formatDayName } from '../../../../conversation';
import { MEMORY_store } from '../../../../agent-memory/store-retrieve';


/**
 * Summarizes the current conversation and updates the conversation state
 */
export async function summarizeCurrentConversation(
  currentConversation: ServerMessage[],
  initialMessage: string,
  contextSets: ContextContainerProps[]
): Promise<{
  updatedConversation: ServerMessage[];
  summary: string;
  isInfoNeededFromUser: boolean;
  isUserActionNeeded: boolean;
  isResolvedOrConcluded: boolean;
}> {
  logger.log("Summarizing Conversation...", {
    conversation: currentConversation.map((msg) => msg.content).join("\n"),
  });
  
  // summarize and update currentConversation
  const summary = await summarizeConversation(
    currentConversation,
    (currentConversation[0].content.includes("Conversation Summary: ")) 
      ? currentConversation[0].content 
      : initialMessage,
    contextSets
  );
  
  const updatedConversation = [
    {
      role: "user",
      content: `Continuing previous conversation: ${currentConversation[0].content.replaceAll('Conversation Summary: ', '')}`,
      agentName: "Conversation Summarizer",
    } as ServerMessage,
    {
      role: "assistant",
      content: `Conversation Summary: ${summary.summary.replaceAll('Conversation Summary: ', '')}`,
      agentName: "Conversation Summarizer",
    } as ServerMessage,
  ];
  
  logger.log("Conversation Summarized", {
    summary: summary.summary,
    conversation: updatedConversation,
  });
  
  return {
    updatedConversation,
    summary: summary.summary,
    isInfoNeededFromUser: summary.isInfoNeededFromUser,
    isUserActionNeeded: summary.isUserActionNeeded,
    isResolvedOrConcluded: summary.isResolvedOrConcluded
  };
}

/**
 * Handles creating a form for user input when the orchestration needs more information
 */
export async function handleInfoNeededFromUser(
  currentConversation: ServerMessage[],
  props: OrchestrationProps,
  contextSet: any,
  teamName: string,
  set: (state: Partial<AnalysisState>) => void
): Promise<void> {
  logger.log("INFO_REQUEST received. Creating form schema...");
  
  // Create form schema using AGENT_FORM_creator
  const formSchema = await AGENT_FORM_creator(
    currentConversation.map((msg) => msg.content).join("\n")
  );

  // Add form to context
  const updatedContext = [
    ...contextSet.sets,
    {
      setName: formSchema.formName,
      lines: [],
      text: "",
      isDisabled: false,
      formSchema: formSchema.schema,
      onFormSubmit: () => {},
      requestData: {
        agentName: props.currentAgent.name,
        message: props.initialMessage,
        history: currentConversation,
      },
    },
  ];

  // Rewrite the request message
  const rewrittenMessage = await AGENT_FORM_reWriteRequestMessage(
    props.initialMessage,
    formSchema.formName
  );

  // Add message to conversation indicating form
  const updatedConversation = [
    ...currentConversation,
    {
      role: "assistant",
      content: rewrittenMessage,
      agentName: props.currentAgent.name,
    } as ServerMessage
  ];
  
  // Update state with form and context
  set({
    agentGlobalChatInput: "INFORMATION NEEDED FROM USER!",
    agentActive: false,
    currentConversation: updatedConversation,
    contextSet: {
      sets: updatedContext,
      teamName: teamName,
    } as any,
  });
}

/**
 * Handles user action requests from the orchestration
 */
export async function handleUserActionNeeded(
  currentConversation: ServerMessage[],
  props: OrchestrationProps,
  userActionModelArgs: ModelArgs,
  set: (state: Partial<AnalysisState>) => void
): Promise<void> {
  // Get detailed action message
  const userActionMessage = await getUserActionMessage(
    props.currentAgent.name,
    props.initialMessage,
    currentConversation,
    userActionModelArgs
  );
  
  logger.log("USER_ACTION_REQUEST received. Creating action prompt...");
  
  // Add message to conversation prompting for action
  const updatedConversation = [
    ...currentConversation,
    {
      role: "assistant",
      content: `Please take the following action: ${userActionMessage} \n\nAfter action is complete, submit 'Continue' to continue the conversation`,
      agentName: "User",
    } as ServerMessage
  ];
  
  // Update state with instructions
  set({ 
    currentConversation: updatedConversation,
    agentGlobalChatInput: "Continue...", 
    agentActive: false 
  });
}

/**
 * Stores the conversation in the database
 */
export async function storeConversation(
  conversation: ServerMessage[],
  userId: string
): Promise<void> {
  try {
    await CONVERSATION_store({
      dayName: await formatDayName(new Date()),
      userId: userId,
      conversations: conversation,
    });
  } catch (error) {
    console.error("Error storing conversation:", error);
    logger.error("Failed to store conversation", {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Extracts and updates context from the conversation
 */
export async function updateContextFromConversation(
  conversation: ServerMessage[],
  contextSets: ContextContainerProps[],
  teamName: string,
  set: (state: Partial<AnalysisState>) => void
): Promise<void> {
  // Extract context from conversation
  const updatedSets = await extractContextFromConversation(
    conversation,
    contextSets,
    []
  );
  
  // Update state with new context
  set({ 
    contextSet: { 
      sets: updatedSets, 
      teamName: teamName 
    } as any 
  });
  
  // Give UI time to update
  await new Promise(resolve => setTimeout(resolve, 500));
}

/**
 * Stores the conversation in memory if it's worthy
 */
export async function storeConversationInMemory(
  conversation: ServerMessage[],
  agents: AgentComponentProps[],
  userId: string
): Promise<void> {
  // Check if conversation is worthy of remembering
  if (await isConversationMemoryWorthy(conversation)) {
    try {
      // Store in memory with cleaned conversation
      await MEMORY_store(
        UTILS_cleanConversationForStorage(conversation), 
        agents.map(a => ({
          name: a.name, 
          roleDescription: a.roleDescription, 
          title: a.title
        })), 
        userId
      );
    } catch (error) {
      console.error("Error storing conversation in memory:", error);
      logger.error("Failed to store conversation in memory", {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

/**
 * Finalizes the orchestration by cleaning up state
 */
export function finalizeOrchestration(
  set: (state: Partial<AnalysisState>) => void,
  order: "sequential" | "seq-reverse" | "random" | "auto",
  numRounds: number,
  maxRounds: number,
  chatMode: OrchestrationType,
  customAgentSet: string[]
): void {
  set({ 
    agentGlobalChatInput: "", 
    agentActive: false,
    // Preserve the orchestration state when finalizing
    agentOrder: order,
    rounds: numRounds,
    maxRounds: maxRounds,
    orchestrationMode: chatMode,
    customAgentSet: customAgentSet
  });
} 