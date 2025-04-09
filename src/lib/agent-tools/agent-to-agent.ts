import { tool } from "ai";
import { z } from "zod";
import { agentToAgentChat } from "../agent-channels";
import { updateAssistantMessages, updateUserMessages } from "../message-router";
import {
  AgentFoundationalPromptProps,
  AISessionState,
  ContextContainerProps,
} from "@/src/lib/types";
import { ServerMessage } from "@/src/lib/types";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import {
  TEXT_CHAT_LOG_writeMessagesToFile,
  TextChatLogProps,
} from "../text-chat-log";
import { logger } from '@/src/lib/logger';
import { ANALYSIS_TOOLS_preChatAnalysis } from "../pre-chat-analysis";
import { UTILS_convertLineSetsToContext } from "@/src/lib/utils";

export const AGENT_TOOLS_agentToAgent = async (
  conversationLevel: number,
  agentFoundationalPromptProps: AgentFoundationalPromptProps,
  messageHistory: ServerMessage[],
  state: AISessionState,
  convoTwo: {
    response: string;
    state: AISessionState;
    history: ServerMessage[];
  },
  convoThree: {
    response: string;
    state: AISessionState;
    history: ServerMessage[];
  },
  userId: string,
  teamName: string,
  messageGoRound: boolean,
  contextSets: ContextContainerProps[],
  vc: MemoryVectorStore,
  textChatLogs: TextChatLogProps[]
) => {
  // Track conversations between agent pairs
  const activeChats = new Map<string, boolean>();

  return {
    agentChat: tool({
      description: `communicate with peer agents. Enter the recipient's name as "msgToAgentName", your name as "msgFromAgentName", and the message as "text". Returns a readable string.`,
      parameters: z.object({
        msgToAgentName: z.string().describe("The recipient's name"),
        msgFromAgentName: z.string().describe("Your name"),
        agentToAgentMsg: z.string().describe("The message"),
      }),
      execute: async ({
        msgToAgentName,
        msgFromAgentName,
        agentToAgentMsg,
      }) => {
        const chatKey = `${msgFromAgentName}-${msgToAgentName}`;
        
        if (activeChats.get(chatKey)) {
          return `Please wait... ${msgFromAgentName} is already in conversation with ${msgToAgentName}`;
        }
        
        activeChats.set(chatKey, true);
        
        try {
          // Perform pre-chat analysis before agent communication
          const preCheck = await ANALYSIS_TOOLS_preChatAnalysis(
            agentToAgentMsg,
            msgToAgentName,
            state.currentAgents,
            contextSets,
            agentFoundationalPromptProps,
            state,
            userId,
            teamName
          );

          // Use analyzed message in agent chat
          const agentResponse = await agentToAgentChat(
            conversationLevel,
            msgToAgentName,
            agentFoundationalPromptProps.agentType,
            msgFromAgentName,
            preCheck.updatedMessage || agentToAgentMsg,
            messageHistory,
            convoTwo,
            convoThree,
            state,
            userId,
            teamName,
            vc,
            contextSets,
            textChatLogs! || []
          );

          console.log("AGENT TOOL - Response:", {
            message: agentResponse.response,
            hasContext: !!agentResponse.context,
            contextLength: agentResponse.context?.length
          });

          // Return the full response object
          return {
            message: agentResponse.response,
            context: agentResponse.context,
            state: agentResponse.state
          };
        } catch (error) {
          logger.error("Failed to complete agent conversation", {
            action: "CHAT_ERROR",
            error: error instanceof Error ? error.message : String(error)
          });
          return "An error occurred during the agent to agent chat: " + (error as Error).message;
        } finally {
          activeChats.delete(chatKey);
        }
      },
    }),
  };
};

export const AGENT_TOOLS_agentToAgent_v2 = async (
  availableAgents: string[],
  conversationLevel: number,
  agentFoundationalPromptProps: AgentFoundationalPromptProps,
  messageHistory: ServerMessage[],
  state: AISessionState,
  userId: string,
  teamName: string,
  vc: MemoryVectorStore,
  contextSets: ContextContainerProps[],
  textChatLogs: TextChatLogProps[],
  convoTwo: {
    response: string;
    state: AISessionState;
    history: ServerMessage[];
  },
  convoThree: {
    response: string;
    state: AISessionState;
    history: ServerMessage[];
  },
) => {
  return {
    agentChat: tool({
      description: `communicate with allowed agents. Choose the agent from the list of available agents.`,
      parameters: z.object({
        msgToAgentName: z.enum(['',...availableAgents]).describe("The recipient's name"),
        msgFromAgentName: z.string().describe("Your name"), 
        agentToAgentMsg: z.string().describe("The message"),
      }),
      execute: async ({ msgToAgentName, msgFromAgentName, agentToAgentMsg }) => {
        if (!availableAgents.includes(msgToAgentName)) {
          return `Invalid agent name. Please choose from the list of available agents: ${availableAgents.join(', ')}`;
        }

        const agentResponse = await agentToAgentChat(
          conversationLevel,
          msgToAgentName,
          agentFoundationalPromptProps.agentType,
          msgFromAgentName,
          agentToAgentMsg,
          messageHistory,
          convoTwo,
          convoThree,
          state,
          userId,
          teamName,
          vc,
          contextSets,
          textChatLogs
        );

        return agentResponse;
      }
    })
  }
}
export type SubConversationProps = {
  response: string;
  state: AISessionState;
  history: ServerMessage[];
}
export interface AgentToAgentChatProps {
  availableAgents: string[];
  conversationLevel: number;
  agentFoundationalPromptProps: AgentFoundationalPromptProps;
  messageHistory: ServerMessage[];
  state: AISessionState;
  userId: string;
  teamName: string;
  vc: MemoryVectorStore;
  contextSets: ContextContainerProps[];
  convoTwo: SubConversationProps;
  convoThree: SubConversationProps;
}
export const AGENT_TOOLS_agentToAgent_v3 = async (  props: AgentToAgentChatProps) => {
  return {
    agentChat: tool({
      description: `communicate with allowed agents. Choose the agent from the list of available agents.`,
      parameters: z.object({
        msgToAgentName: z.enum(['',...props.availableAgents]).describe("The recipient's name"),
        msgFromAgentName: z.string().describe("Your name"), 
        agentToAgentMsg: z.string().describe("The message"),
      }),
      execute: async ({ msgToAgentName, msgFromAgentName, agentToAgentMsg }) => {
        if (!props.availableAgents.includes(msgToAgentName)) {
          return `Invalid agent name. Please choose from the list of available agents: ${props.availableAgents.join(', ')}`;
        }

        const agentResponse = await agentToAgentChat(
          props.conversationLevel,
          msgToAgentName,
          props.agentFoundationalPromptProps.agentType,
          msgFromAgentName,
          agentToAgentMsg,
          props.messageHistory,
          props.convoTwo,
          props.convoThree,
          props.state,
          props.userId,
          props.teamName,
          props.vc,
          props.contextSets,
        []
        );

        return agentResponse;
      }
    })
  }
}
