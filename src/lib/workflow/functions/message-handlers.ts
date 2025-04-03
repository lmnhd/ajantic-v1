import {
  ServerMessage,
  AppFrozenState,
  GlobalMessages,
  AgentComponentProps,
  AISessionState,
  AgentTypeEnum,
  ContextContainerProps,
} from "@/src/lib/types";
import axios from 'axios';
import { AnalysisStorage } from "../../storage/analysis-storage";
import {
  CONVERSATION_store,
  CONVERSATION_handleSummarize,
  formatDayName,
} from "../../conversation";

const ANTHROPIC_API_URL = 'https://api.anthropic.com/sonnet';

async function aider(model: string, apiKey: string) {
  try {
    const response = await axios.post(
      ANTHROPIC_API_URL,
      { model },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error calling the Anthropic API:', error);
    return null;
  }
}

// Existing code...


export function updateMessages(
  messages: ServerMessage[],
  get: Function,
  set: Function
) {
  console.log("!!!UPDATE_MESSAGES!!!", messages);
  const state = get();
  set({ currentConversation: messages });

  const frozenState: AppFrozenState = {
    localState: state.localState,
    currentConversation: messages,
    contextSet: state.contextSet,
    analysisSet: {
      contextSet: state.contextSet,
      analysisName: state.localState.currentAgents?.name || "",
      userId: state.localState.userId,
    },
  };
  AnalysisStorage.FROZEN_STATE_saveToIndexDB(frozenState);
}



export function handleClearMessages(get: Function, set: Function) {
  if (window.confirm("Should we summarize first?")) {
    // Get the summary from the server
    CONVERSATION_handleSummarize(
      get().currentConversation,
      get().localState
    ).then((summary: string | null) => {
      // If we got a summary back, update the messages on the client side
      if (summary) {
        get().updateMessages([
          {
            role: "assistant",
            content: summary,
            agentName: "Summarizer",
            currentState: JSON.stringify(get().localState),
          },
        ]);
      } else {
        get().updateMessages([]);
      }
    });
  } else {
    get().updateMessages([]);
  }
  get().handleChangeIndex();
}

export function syncWithGlobalMessages(
  globalMessages: GlobalMessages,
  get: Function,
  set: Function
) {
  const state = get();
  set({
    localState: {
      ...state.localState,
      ...globalMessages.currentState,
      genericData: {
        ...state.localState.genericData,
        ...globalMessages.currentState.genericData,
      },
    },
  });
}


