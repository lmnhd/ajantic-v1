"use server";


import {
  AgentComponentProps,
  AgentVoiceProviderEnum,
  AISessionState,
  ModelProviderEnum,
} from "@/src/lib/types";
import { generateObject, generateText } from "ai";
import { revalidatePath } from "next/cache";
import { MODEL_getModel_ai } from "./vercelAI-model-switcher";

import { z } from "zod";
import { WhisperVoicesEnum } from "@/src/lib/speech/voices-types";
import { AGENT_AUTO_PROMPT } from "../prompts/auto-prompt";
import { UTILS_getGenericData } from "@/src/lib/utils";
import { ServerMessage } from "@/src/lib/types";

export const AGENT_CONVO_SUMMARIZE = async (currentConversation: ServerMessage[]) => {
  console.log("AGENT_CONVO_SUMMARIZE", currentConversation);

  let summary = "";
  try {
    const response = await generateText({
        model: await MODEL_getModel_ai({
          modelName: "gpt-4o-mini",
          provider: ModelProviderEnum.OPENAI,
          temperature: 0.1,
        }),
        messages: [
          {
            role: "system",
            content: `You are a helpful assistant that summarizes conversations to reduce their size to 1000 characters or less. You will only output the summary, no other text.
            Make sure to keep the most important information to maintain the context of the conversation.
            `,
          },
          {
            role: "user",
            content: `Here is the conversation to summarize: 
            ${currentConversation
              .map((m) => m.role + " - " + m.content)
              .join("\n")}`,
          },
      ],
    });
    summary = response.text;
  } catch (error) {
    console.log(error);
    summary = `Error summarizing conversation: ${error}`;
  }

  return summary;
};
