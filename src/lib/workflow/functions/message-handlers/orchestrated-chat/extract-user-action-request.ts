import { OpenAIModelNames } from "@/src/app/api/model/openai";

import { generateObject } from "ai";

import { MODEL_getModel_ai } from "../../../../vercelAI-model-switcher";

import { ModelProviderEnum, ServerMessage, ModelArgs } from "@/src/lib/types";
import { z } from "zod";
import { UTILS_getModelsJSON } from "@/src/lib/utils";
export const getUserActionMessage = async (
  agentName: string,
  initialMessage: string,
  currentConversation: ServerMessage[],
  userActionModelArgs: ModelArgs
) => {
  const _prompt = `You are an assistant to a team of agents that identifies what actions need to be taken by the user in order to continue the task at hand.
   Please review the following conversation, identify the action needed from the user, and structure a well formed and explicit request to send to the user.
   The request should be in the form of a question or a task that is clear and concise.
   The request should be 1 or 2 sentences.

   <conversation>
    ${currentConversation
      .map((msg) => `${msg.agentName}: ${msg.content}`)
      .join("\n")}
   </conversation>

   <initialMessage>
    ${initialMessage}
   </initialMessage>

   <requestingAgentName>
    ${agentName}
   </requestingAgentName>
   
   `;

  let providerOptions = {};

  if (
    userActionModelArgs.modelName ===
    UTILS_getModelsJSON().Anthropic["claude-3-7-sonnet-20250219"].name
  ) {
    providerOptions = {
      anthropic: { thinking: { type: "enabled", budgetTokens: 12000 } },
    };
  }

  const result = await generateObject({
    model: await MODEL_getModel_ai(userActionModelArgs),
    prompt: _prompt,
    schema: z.object({
      userActionMessage: z.string(),
    }),
    providerOptions: providerOptions,
  });

  return result.object.userActionMessage;
};
