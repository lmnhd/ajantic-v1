import { tool } from "ai";
import { z } from "zod";
import { TextChatLogProps } from "../../text-chat-log";
import {
  CORE_analyzeRequirements,
  CORE_createAndExecute,
  CORE_saveScript,
  CORE_deleteScript,
  CORE_getScript
} from "./dynamic-action_handlers";


export const AGENT_TOOLS_dynamicScript = (agentName: string, userId: string, textChatLogs: TextChatLogProps[]) => ({
  ANALYZE_REQUIREMENTS: tool({
    description: "Analyze requirements for a dynamic script",
    parameters: z.object({
      prompt: z.string(),
      context: z.string().optional(),
    }),
    execute: async (params) => {
      return await CORE_analyzeRequirements(agentName, userId, textChatLogs, params);
    },
  }),

  CREATE_AND_EXECUTE: tool({
    description: "Create and execute a dynamic script with full validation",
    parameters: z.object({
      prompt: z.string(),
      context: z.string().optional(),
      forceNew: z.boolean().optional(),
    }),
    execute: async (params) => {
      return await CORE_createAndExecute(agentName, userId, textChatLogs, params);
    },
  }),

  SAVE_SCRIPT: tool({
    description: "Save a script to the database",
    parameters: z.object({
      name: z.string(),
      description: z.string(),
      script: z.string(),
      parameters: z.any().optional(),
    }),
    execute: async (params) => {
      return await CORE_saveScript(agentName, userId, textChatLogs, params);
    },
  }),

  DELETE_SCRIPT: tool({
    description: "Delete a script from the database",
    parameters: z.object({
      name: z.string(),
    }),
    execute: async (params) => {
      return await CORE_deleteScript(agentName, userId, textChatLogs, params);
    },
  }),

  GET_SCRIPT: tool({
    description: "Get a script from the database",
    parameters: z.object({
      name: z.string(),
    }),
    execute: async (params) => {
      return await CORE_getScript(agentName, userId, textChatLogs, params);
    },
  }),
});


