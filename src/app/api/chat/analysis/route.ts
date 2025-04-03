import { openai } from "@ai-sdk/openai";
import { Message, convertToCoreMessages, streamText } from "ai";
import { ANALYSIS_query } from ".";
import { ContextContainerProps,  ModelArgs, ModelNames, ModelProvider, ModelProviderEnum } from "@/src/lib/types";

import { AnthropicModelNames } from "../../model/anthropic";
import { MistralModelNames } from "../../model/mistral";
import { CohereModelNames } from "../../model/cohere";
import { GoogleGenerativeAIModelNames, GoogleVertexModelNames } from "../../model/google";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const {
    messages,
    listSets,
    modelArgs,
  }: {
    messages: Message[];
    listSets: ContextContainerProps[];
    modelArgs: ModelArgs,
  } = await req.json();

  console.log("POST-messages", messages);
  console.log("POST-sets", listSets);
  console.log("POST-modelArgs", modelArgs);

  //let result: any;

  return ANALYSIS_query(messages, listSets, modelArgs);
}
