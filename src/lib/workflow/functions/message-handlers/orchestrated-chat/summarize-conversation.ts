"use server";

import {
  ContextContainerProps,
  ModelArgs,
  ModelProviderEnum,
  ServerMessage,
} from "@/src/lib/types";
import { generateObject } from "ai";
import { z } from "zod";
import { MODEL_getModel_ai } from "../../../../vercelAI-model-switcher";
import { OpenAIModelNames } from "@/src/app/api/model/openai";
import { AnthropicModelNames } from "@/src/app/api/model/anthropic";
export async function summarizeConversation(
  conversation: ServerMessage[],
  initialMessage: string,
  context: ContextContainerProps[],
  summarizeModelArgs: ModelArgs = {
    modelName: "gpt-4o",
    provider: ModelProviderEnum.OPENAI,
    temperature: 0.5,
  }
): Promise<{
  summary: string;
  isResolvedOrConcluded: boolean;
  isInfoNeededFromUser: boolean;
  isUserActionNeeded: boolean;
}> {
  // Use GPT-4 to summarize the conversation, using generateObject, reducing the entire conversation to a single message no longer than 1000 characters
  // Prompt should be xml style with clear concise instructions
  // Model should return and object with the summarization and the character count

  let providerOptions = {};

  if (summarizeModelArgs.modelName === "claude-3-7-sonnet-20250219") {
    providerOptions = {
      anthropic: { thinking: { type: "enabled", budgetTokens: 12000 } },
    };
  }
  const result = await generateObject({
    model: await MODEL_getModel_ai(summarizeModelArgs),
    prompt: `
              <instructions>
                  <task>Summarize the following conversation into a single message no longer than 1000 characters</task>
                  <important>
                     Remove from summary any data that exists as a context item and reference it in the summary
                  </important>
                  <format>Return a concise summary that captures the key points and conclusions for a continued discussion</format>
                  <resolution_criteria>
                      <task>Determine if the conversation has reached a natural conclusion based on the initial request/message</task>
                       <user-info-needed>
                          - ONLY If the conversation cannot proceed because information is required from the user, Mark as info-needed-from-user
                      </user-info-needed>
                       <user-action-needed>
                          - ONLY If the conversation cannot proceed because and action from the user is required like authorizing an OAuth service, Mark as user-action-needed
                      </user-action-needed>
                      <guidelines>
                          - Mark as resolved if the initial request has been fully addressed
                          - Mark as resolved if a clear conclusion or decision has been reached
                          - Mark as resolved if all participants agree on next steps or final outcome
                          - Mark as unresolved if there are pending questions or unaddressed aspects
                          - Mark as unresolved if there are open action items or decisions
                          - Mark as unresolved if the initial request's goals haven't been fully met
                          - Consider the initial message/request as the primary goal to evaluate resolution
                      </guidelines>
                  </resolution_criteria>
                  <initialMessage>
                      ${initialMessage}
                  </initialMessage>
                  <conversation>
                      ${conversation
                        .map(
                          (msg) =>
                            `<message agent="${msg.agentName}">${msg.content}</message>`
                        )
                        .join("\n")}
                  </conversation>
                  <context>
                      ${context
                        .map(
                          (c) =>
                            `<context-item name="${c.setName}">${c.text}</context-item>`
                        )
                        .join("\n")}
                  </context>
              </instructions>
          `,
    providerOptions: providerOptions,
    schema: z.object({
      summary: z.string().max(1000),
      characterCount: z.number(),
      isResolvedOrConcluded: z
        .boolean()
        .describe(
          "Whether the conversation has reached a natural conclusion based on the initial request"
        ),
      isInfoNeededFromUser: z
        .boolean()
        .describe(
          "Whether the conversation or task cannot proceed until information is recieved from the user"
        ),
      isUserActionNeeded: z
        .boolean()
        .describe(
          "Whether the conversation or task cannot proceed until an action from the user is taken"
        ),
    }),
  });

  // Return the summarized conversation as a single message
  return {
    summary: result.object.summary,
    isResolvedOrConcluded: result.object.isResolvedOrConcluded,
    isInfoNeededFromUser: result.object.isInfoNeededFromUser,
    isUserActionNeeded: result.object.isUserActionNeeded,
  };
}
