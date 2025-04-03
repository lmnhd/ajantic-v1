import { agentChannelMessageRouter } from "../../../agent-channels";

import {
  AgentComponentProps,
  AgentTypeEnum,
  AgentUserResponse,
  AppFrozenState,
  ContextContainerProps,
} from "@/src/lib/types";

import { ServerMessage } from "@/src/lib/types";

import { AISessionState } from "@/src/lib/types";
import { UTILS_convertLineSetsToContext } from "@/src/lib/utils";
import {
  createAuthPopup,
  GmailAuthBrowser,
} from "../../../agent-tools/gmail-client";
import { CONVERSATION_store } from "../../../conversation";
import { formatDayName } from "../../../conversation";
import { AnalysisStorage } from "../../../storage/analysis-storage";
import { handleInfoRequest } from "./agent-chat-submit/info-request";
import { handleGmailOauthRequest } from "./agent-chat-submit/gmail-oauth-request";
import { handleOauthRequest } from "./agent-chat-submit/oauth-request";
import { logger } from "@/src/lib/logger";

// Compiles all necessary data and sends it to the agentChannelMessageRouter
export async function handleAgentChatSubmit(
  e: React.FormEvent | any,
  get: () => any,

  set: (state: any) => void
) {
  set({ agentActive: true });
  const state = get();
  console.log("MESSAGE_HANDLER STATE", state);

  let {
    localState,
    agentGlobalChatInput,
    currentConversation,
    currentAgentIndex,
  }: {
    localState: AISessionState;
    agentGlobalChatInput: string;
    currentConversation: ServerMessage[];
    currentAgentIndex: number;
  } = state;

  try {
    console.log("handleAgentChatSubmit called", e);
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.target && e.target.value && e.target.value === "") return;

    let _contextSets: ContextContainerProps[] = [] as ContextContainerProps[];
    const currentAgent = localState.currentAgents.agents[currentAgentIndex];
    if (localState.contextSet && localState.contextSet.sets) {
      _contextSets = localState.contextSet.sets as ContextContainerProps[];
    }

    let agentChat = await agentChannelMessageRouter(
      agentGlobalChatInput,
      currentConversation as ServerMessage[],
      localState.currentAgents,
      _contextSets,
      [currentAgent.modelArgs],
      true,
      {
        trainingMode: currentAgent.training || false,
        role: currentAgent.roleDescription ?? "",
        thisAgentName: currentAgent.name,
        agentType: currentAgent.type as AgentTypeEnum,
        userId: localState.userId,
        teamName: localState.currentAgents.name,
        context: UTILS_convertLineSetsToContext(
          _contextSets,
          currentAgent.name
        ),
        mission: localState.currentAgents.objectives ?? "",
        peerAgents: localState.currentAgents.agents
          .filter((a: AgentComponentProps) => a.name !== currentAgent.name)
          .filter((a: AgentComponentProps) => !a.disabled),
        directives: currentAgent.promptDirectives ?? [],
        userName: localState.genericData?.userName ?? "",
        skillSet:
          currentAgent.systemPrompt ?? "You are a helpful AI assistant.",
        tools: currentAgent.tools ?? [],
      },
      localState,
      localState.userId,
      localState.currentAgents.name,
      false
    );

    if (!agentChat?.history?.length) return;

    agentChat = agentChat as AgentUserResponse;

    // Update localState with the server response

    let _updatedState: AISessionState;
    try {
      _updatedState = JSON.parse(
        agentChat.history[agentChat.history.length - 1].currentState ?? ""
      );
      console.log("MESSAGE_HANDLER UPDATED_STATE", _updatedState);
      localState = {
        ...localState,
        contextSet: {
          sets: agentChat.context || [],
          teamName: localState.currentAgents.name || "",
        },
      };
    } catch (error) {
      console.error("Error parsing server state:", error);
    }

    // Handle info request
    if (
      agentChat.postMessageProps &&
      agentChat.postMessageProps?.requestFormSchema &&
      agentChat.postMessageProps.nextFlag === "INFO_REQUEST"
    ) {
      const infoRequest = handleInfoRequest(
        agentChat,
        localState,
        get,
        set,
        currentAgent
      );
      if (infoRequest) {
        agentChat = infoRequest.infoRequestAgentChat;
        localState = infoRequest.infoRequestLocalState;
      }
    }

    // Make sure all history arrays align
    if(agentChat.postMessageProps && agentChat.postMessageProps.chatHistory) {
      agentChat.history = [...agentChat.postMessageProps.chatHistory];
    }
    // Handle auth request
    if (
      agentChat.postMessageProps &&
      agentChat.postMessageProps?.metaData &&
      agentChat.postMessageProps?.metaData?.authUrl &&
      agentChat.postMessageProps?.metaData?.platform
    ) {
      console.log(
        "MESSAGE_HANDLER AUTH_URL:",

        agentChat.postMessageProps.metaData.authUrl
      );
      if (agentChat.postMessageProps.metaData.platform === "gmail") {
        const oauthRequest = await handleGmailOauthRequest(
          agentChat,
          localState,
          currentAgent,
          "gmail"
        );
        if (oauthRequest) {
          agentChat = oauthRequest;
        }
      } else {
        const oauthRequest = await handleOauthRequest(
          agentChat,
          localState,
          currentAgent,
          agentChat.postMessageProps.metaData.platform || ""
        );
        if (oauthRequest) {
          agentChat = oauthRequest;
        }
      }
    }

    // Save conversation to database
    try {
      const dayName = await formatDayName(new Date());
      await CONVERSATION_store({
        dayName,
        userId: localState.userId,
        conversations: agentChat?.history || [],
      });
    } catch (error) {
      console.error("Failed to store conversation:", error);
      // Continue execution even if conversation storage fails
    }

    // Save state to IndexedDB after message
    try {
      const frozenState: AppFrozenState = {
        localState: {
          ...localState,
          contextSet: {
            sets: agentChat?.context || [],
            teamName: localState.currentAgents.name || "",
          },

          genericData: {
            ...localState.genericData,
            // AGENT_GLOBAL_STATE: _agentGlobalState,
          },
        },
        currentConversation: agentChat?.history || [],
        contextSet: {
          sets: agentChat?.context || [],
          teamName: localState.currentAgents.name || "",
        },

        analysisSet: {
          contextSet: {
            sets: agentChat?.context || [],
            teamName: localState.currentAgents.name || "",
          },
          analysisName: localState.currentAgents.name || "",
          userId: localState.userId || "",
        },
      };
      console.log("MESSAGE_HANDLER FROZEN_STATE", frozenState);
      await AnalysisStorage.FROZEN_STATE_saveToIndexDB(frozenState);
    } catch (error) {
      console.error("Error saving frozen state:", error);
      // Continue execution even if saving frozen state fails
    }

    console.log("MESSAGE_HANDLER SETTING_LOCAL_STATE", {
      localState: localState,
      contextSet: agentChat?.context,
      currentConversation: agentChat?.history,
    });

    set({
      localState: {
        ...localState,
      },
      contextSet: {
        sets: agentChat?.context || [],
        teamName: localState.currentAgents.name,
      },
      agentActive: false,
      currentConversation: agentChat?.history || [],
    });

    //   if (agentChat?.history?.length) {
    //     console.log("MESSAGE_HANDLER AGENT_CHAT_HISTORY", agentChat.history);
    //     const lastMessage = agentChat.history[agentChat.history.length - 1];
    //     // Sync any state changes from the server response
    //     if (lastMessage.currentState) {
    //       try {
    //         const parsedState: AISessionState = localState;
    //         // const parsedState: AISessionState = JSON.parse(
    //         //   lastMessage.currentState
    //         // );

    //         if (agentChat.postMessageProps?.requestFormSchema) {
    //           const request = agentChat.postMessageProps.requestFormSchema;
    //           parsedState.contextSet.sets.push({
    //             setName: request.formName,
    //             lines: [],
    //             text: request.requestMessage,
    //             isDisabled: false,
    //             formSchema: {
    //               schema: request.schema,
    //               formName: request.formName,
    //             },
    //             fullScreen: true,
    //             hiddenFromAgents: [],
    //           });
    //         }
    //         // Update both localState and contextSets
    //         console.log("MESSAGE_HANDLER UPDATING_STORE_FOR_COMPLETION...");
    //         set({
    //           localState: {
    //             ...state.localState,
    //             ...parsedState,
    //           },
    //           contextSet: agentChat.context,
    //           agentActive: false,
    //         });

    //         // Save updated state again if changed by server response
    //         await AnalysisStorage.FROZEN_STATE_saveToIndexDB({
    //           ...frozenState,
    //           localState: {
    //             ...state.localState,
    //             ...parsedState,
    //           },
    //           contextSet: {
    //             sets: parsedState.contextSet.sets || state.contextSet.sets,
    //             teamName: localState.currentAgents.name,
    //           },
    //         });
    //       } catch (error) {
    //         console.error("Error parsing server state:", error);
    //       }
    //     }
    //   }

    // Trigger change detection
    get().handleChangeIndex();
  } catch (error) {
    console.error("Error submitting message:", error);
    logger.error("Error submitting message:", {
      error: error,
      message: agentGlobalChatInput,
      localState: localState,
      currentConversation: currentConversation,
    });
    set({
      agentActive: false,
      currentConversation: [
        ...currentConversation,
        {
          content: agentGlobalChatInput,
          role: "user",
          timestamp: new Date().toISOString(),
          currentState: JSON.stringify(localState),
          postMessageProps: {
            requestFormSchema: null,
            metaData: null,
            response: {
              message: "Error submitting message",
              error: error,
            },
          },
        },
        {
          content: "Error submitting message",
          role: "assistant",
          timestamp: new Date().toISOString(),
          currentState: JSON.stringify(localState),
        },
      ],
    });
  }
}
