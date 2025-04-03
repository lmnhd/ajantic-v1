"use server"
import { ModelProviderEnum, ServerMessage } from "@/src/lib/types";
import { generateObject } from "ai";
import { z } from "zod";
import { MODEL_getModel_ai } from "../../../../vercelAI-model-switcher";
import { OpenAIModelNames } from "@/src/app/api/model/openai";
import { logger } from "@/src/lib/logger";

export async function isConversationMemoryWorthy(conversation: ServerMessage[]) {

   const _prompt = `
    You are a helpful assistant that is given a conversation between a team of agents.
    You are to decide if the conversation is worthy of being remembered.
    
    <criteria>
      <remember>
        <criterion>Conversations containing important factual information</criterion>
        <criterion>Discussions where issues or conflicts were successfully resolved</criterion>
        <criterion>Exchanges where misunderstandings were clarified or corrected</criterion>
        <criterion>Cases where problems were identified but could not be resolved</criterion>
      </remember>
      
      <disregard>
        <criterion>Conversations used only to establish context or background</criterion>
        <criterion>Abstract or purely philosophical discussions with no practical content</criterion>
        <criterion>Messages only used to coordinate actions between agents</criterion>
        <criterion>Simple clarification questions that don't lead to substantive insights</criterion>
      </disregard>
    </criteria>
    
    <conversation>
    ${conversation.map(msg => `<message sender="${msg.agentName}">${msg.content}</message>`).join('\n')}
    </conversation>
    
    <instructions>
       Analyze the conversation and determine if it contains information worthy of being remembered.
      Consider the criteria above carefully.
      Return your decision as either "REMEMBER" or "DISREGARD" followed by a brief explanation.
    </instructions>
    `

    const _response = await generateObject({
        model: await MODEL_getModel_ai({
            modelName: OpenAIModelNames["gpt-4o-mini"],
            provider: ModelProviderEnum.OPENAI,
            temperature: 0,
        }),
        prompt: _prompt,
        schema: z.object({
            decision: z.enum(["REMEMBER", "DISREGARD"]),
            explanation: z.string(),
        }),
    });

    logger.log("Conversation Memory Worthy", {
        explanation: _response.object.explanation,
        decision: _response.object.decision,
    });
    return _response.object.decision === "REMEMBER";
}
