import { ServerMessage } from "@/src/lib/types";
import { generateObject } from 'ai';
import { z } from 'zod';
import { MODEL_getModel_ai } from '@/src/lib/vercelAI-model-switcher';
import { ModelArgs, ModelProviderEnum } from '@/src/lib/types';
import { logger } from "@/src/lib/logger";
import { ContextContainerProps } from "@/src/lib/types";// Use new types

/**
 * Summarizes a single message, prioritizing the first sentence or truncating.
 * Copied and adapted from `auto-redirect.ts`.
 */
export function ORCHESTRATION_summarizeMessage(
  message: string,
  maxLength: number = 100
): string {
  if (!message || message.length <= maxLength) {
    return message;
  }

  // Extract first sentence
  const firstSentenceMatch = message.match(/^[^.!?]*[.!?]/);
  const firstSentence = firstSentenceMatch ? firstSentenceMatch[0].trim() : "";

  // Return first sentence if found, otherwise truncate
  return firstSentence || message.substring(0, maxLength) + "...";
}

/**
 * Summarizes a conversation history into a string format (e.g., XML-like).
 * Takes the most recent messages and applies `ORCHESTRATION_summarizeMessage` to each.
 * Optionally skips summarization based on a flag (e.g., for non-manager agents in auto mode).
 * Copied and adapted from `auto-redirect.ts`.
 *
 * @param messages The array of ServerMessage objects.
 * @param maxMessages The maximum number of recent messages to include.
 * @param shouldSummarize If false, returns an empty string.
 * @returns A string representation of the summarized history.
 */
export function ORCHESTRATION_summarizeHistoryToString(
  messages: ServerMessage[],
  maxMessages: number = 5,
  shouldSummarize: boolean = true
): string {
  // Option to skip summarization entirely
  if (!shouldSummarize) {
    return "";
  }

  if (!messages || messages.length === 0) {
    return "";
  }

  // Keep only recent messages
  const recentMessages = messages.slice(-maxMessages);

  // Create summaries for each message in the specified string format
  return recentMessages
    .map(
      (m) =>
        `<message from="${m.agentName || 'Unknown'}" content="${ORCHESTRATION_summarizeMessage(
          m.content || ''
        )}" />`
    )
    .join("\n");
}

/**
 * Creates a summarized version of the conversation history, returning an array of ServerMessages.
 * This version is more aligned with the logic potentially used in `createSummarizedHistory`
 * from `agent-channels.tsx` for use within the orchestration loop itself.
 *
 * @param history The array of ServerMessage objects.
 * @param maxMessages The maximum number of recent messages to keep.
 * @param keepLastDetailed Number of most recent messages to keep less summarized (longer).
 * @returns A new array containing summarized ServerMessage objects.
 */
export function ORCHESTRATION_getSummarizedHistory(
    history: ServerMessage[],
    maxMessages: number = 8,
    keepLastDetailed: number = 2
): ServerMessage[] {
    if (!history || history.length === 0) {
        return [];
    }

    // Keep only recent messages
    const recentHistory = history.slice(-maxMessages);

    // Create summaries for each message
    return recentHistory.map((msg, index) => {
        // Determine if this message should be kept more detailed
        const isRecent = index >= recentHistory.length - keepLastDetailed;
        const detailMaxLength = isRecent ? 150 : 100; // Allow more length for recent messages

        // Keep system messages or very short messages as is
        if (msg.role === "system" || (msg.content?.length || 0) < 120) {
            return msg;
        }

        // Create a summarized version
        return {
            ...msg,
            content: ORCHESTRATION_summarizeMessage(msg.content || "", detailMaxLength),
        };
    });
}

/**
 * Uses an LLM to generate a concise summary string of the conversation.
 * Adapted from the core logic of `summarizeConversation`.
 *
 * @param conversation The conversation history.
 * @param initialMessage The initial user message for context.
 * @param context Current context sets.
 * @param summarizeModelArgs Model arguments for the summarization LLM.
 * @returns A promise resolving to the summary string, or an empty string if summarization fails.
 */
export async function ORCHESTRATION_getLLMSummary(
    conversation: ServerMessage[],
    initialMessage: string,
    context: ContextContainerProps[],
    summarizeModelArgs: ModelArgs = {
        modelName: "gpt-4o-mini", // Use a faster model for summarization
        provider: ModelProviderEnum.OPENAI,
        temperature: 0.3,
    }
): Promise<string> {
    if (!conversation || conversation.length === 0) {
        return "";
    }

    const prompt = `
        <instructions>
            <task>Summarize the following conversation into a single, concise paragraph capturing the key points, decisions, and current status relevant for continuing the discussion.</task>
            <important>Focus on the essence of the conversation, omitting redundant details. If context items cover specific details, reference them briefly (e.g., "Details in context item X") rather than repeating them.</important>
            <maxLength>Aim for roughly 500-700 characters.</maxLength>
            <initialMessage>${initialMessage}</initialMessage>
            <conversation>
                ${conversation
                    .map((msg) => `<message agent="${msg.agentName || 'User'}">${msg.content}</message>`)
                    .join("\n")}
            </conversation>
            <context>
                ${context
                    .map((c) => `<context-item name="${c.setName}">${c.text?.substring(0, 100)}...</context-item>`)
                    .join("\n")}
            </context>
        </instructions>
    `;

    try {
        const result = await generateObject({
            model: await MODEL_getModel_ai(summarizeModelArgs),
            prompt: prompt,
            schema: z.object({
                summary: z.string().max(1000),
            }),
        });
        return result.object.summary;
    } catch (error) {
        logger.error("Failed to generate LLM summary", { error });
        return ""; // Return empty string on failure
    }
}

// TODO: Implement separate functions for the checks previously done within summarizeConversation:
// - ORCHESTRATION_checkIfResolved(history, initialMessage, context): boolean
// - ORCHESTRATION_checkIfUserInfoNeeded(history, lastResponse): boolean
// - ORCHESTRATION_checkIfUserActionNeeded(history, lastResponse): boolean 