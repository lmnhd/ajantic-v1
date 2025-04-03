import { TextChatLogProps } from "@/src/lib/text-chat-log";
import { AISessionState } from "@/src/lib/types";
import { tool } from "ai";
import { z } from "zod";

// Functions can call these from within the execute function of their tool or they can be called directly by agents if the need to access global data.


// DIRECT FUNCTIONS
export function AGENT_GLOBAL_STATE_save(key: string, value: any, state: AISessionState) {
  try {
    if(!state.genericData.AGENT_GLOBAL_STATE) {
      state.genericData.AGENT_GLOBAL_STATE = {};
    }
    state.genericData.AGENT_GLOBAL_STATE[key] = value;
    return state;
  } catch (error) {
    console.error("Error in AGENT_GLOBAL_STATE_save:", error);
    return state;
  }
}

export function AGENT_GLOBAL_STATE_load(key: string, state: AISessionState) {
  try {
    if(!state.genericData.AGENT_GLOBAL_STATE) {
      state.genericData.AGENT_GLOBAL_STATE = {};
      return null;
    }
    return state.genericData.AGENT_GLOBAL_STATE[key];
  } catch (error) {
    console.error("Error in AGENT_GLOBAL_STATE_load:", error);
    return null;
  }
}

// AGENT TOOLS
export const AGENT_TOOLS_agentGlobalState = (state: AISessionState, textChatLogs: TextChatLogProps[]) => {
  return {
    agent_global_state_save_object: tool({
      description: `Save a value to the agent's global state. Share the key with other agents to allow them to see the value.`,
      parameters: z.object({
        key: z.string().describe("The key to save the value under."),
        value: z.any().describe("The value to save."),
      }),
      execute: async ({ key, value }) => {
        textChatLogs.push({
          role: "function",
          message: `Saving value to agent's global state with key ${key}`,
          agentName: "AGENT_GLOBAL_STATE_save",
          timestamp: new Date(),
        });
        return await AGENT_GLOBAL_STATE_save(key, value, state);
      },
    }),
    agent_global_state_load_object: tool({
      description: `See a value from the agent's global state.`,
    parameters: z.object({
      key: z.string().describe("The key of the value to see."),
    }),
    execute: async ({ key }) => {
      textChatLogs.push({
        role: "function",
        message: `Loading value from agent's global state with key ${key}`,
        agentName: "AGENT_GLOBAL_STATE_load",
        timestamp: new Date(),
      });
      return JSON.stringify(AGENT_GLOBAL_STATE_load(key, state));
      },
    }),
  };
};
