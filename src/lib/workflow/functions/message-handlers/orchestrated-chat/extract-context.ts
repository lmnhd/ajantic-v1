
"use server"
import { ContextContainerProps, ModelProviderEnum, ServerMessage } from "@/src/lib/types";
import { generateObject } from "ai";
import { z } from "zod";
import { MODEL_getModel_ai } from "../../../../vercelAI-model-switcher";

export async function extractContextFromConversation(conversation: ServerMessage[], context: ContextContainerProps[], hiddenFromAgents: string[]): Promise<ContextContainerProps[]> {
  try {
    const _text = conversation.map(msg => `${msg.agentName}: ${msg.content}`).join("\n");

    const _prompt = `
 <purpose>
     You are an AI context analyzer responsible for maintaining shared knowledge between AI team agents.
 </purpose>
 
 <task>
     Extract important information from conversations that should be preserved in the team's context.
 </task>
 
 <instructions>
     <instruction>Review the conversation and existing context items</instruction>
     <instruction>Identify critical information not yet captured in context</instruction>
     <instruction>Format new context items using markdown (preferred), XML, or JSON</instruction>
     <instruction>Return empty array if no new critical information found</instruction>
 </instructions>
 
 <format_preferences>
     <primary>Markdown</primary>
     <alternate>XML</alternate>
     <alternate>JSON</alternate>
 </format_preferences>
 
 <conversation>
 ${_text}
 </conversation>
 
 <current-context>
 ${context.map(item => `<set-name>${item.setName}</set-name>\n<text>${item.text}</text>`).join("\n")}
 </current-context>
 `;
 
    const _result = await generateObject({
     model: await MODEL_getModel_ai({provider: ModelProviderEnum.OPENAI, modelName: "gpt-4o-mini", temperature: 0}),
     prompt: _prompt,
     schema: z.object({
        sets: z.array(z.object({
          text: z.string().describe("The text of the context item"),
          setName: z.string().describe("The name of the set that the context belongs to"),
          
      })),
     }),
     
    });
 
    if (_result.object.sets.length > 0) {
     context.push(..._result.object.sets.map(item => ({
         text: item.text,
         setName: item.setName,
         lines: [],
         isDisabled: false,
         hiddenFromAgents: hiddenFromAgents,
     } as ContextContainerProps)));
    }
 
    return context;
  } catch (error) {
    console.error(error);
    return context;
  }
}
