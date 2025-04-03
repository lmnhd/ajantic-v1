import { SystemPrompts } from "@/src/lib/prompts/system-prompts";
import { ContextContainerProps, ModelArgs, ModelNames, ModelProvider, ModelProviderEnum } from "@/src/lib/types";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { CoreMessage, convertToCoreMessages, generateText, streamText } from "ai";
import { PROMPT_ANALYSIS_QUERY1 } from "./prompts/basic_query";

import {
  AnthropicModelNames,
  AnthropicProps,
  MODEL_Anthropic,
} from "../../model/anthropic";
import { object } from "zod";
import {
  MODEL_openai,
  OpenAIProps,
} from "../../model/openai";
import {
  MODEL_mistral,
  MistralModelNames,
  MistralProps,
} from "../../model/mistral";
import {
  CohereModelNames,
  CohereProps,
  MODEL_cohere,
} from "../../model/cohere";
import {
    GoogleGenerativeAIModelNames,
  GoogleGenerativeAIProps,
  GoogleVertexModelNames,
  MODEL_google_generative_AI,
} from "../../model/google";
import { NextResponse } from "next/server";
import { MODEL_openai_lc } from "../../model/lc/openai_lc";
import { MODEL_anthropic_lc } from "../../model/lc/anthropic_lc";
import { MODEL_mistral_lc } from "../../model/lc/mistral_lc";
import { MODEL_cohere_lc } from "../../model/lc/cohere_lc";
import { MODEL_google_gen_lc } from "../../model/lc/google_gen_lc";

export async function ANALYSIS_query(
  messages: any,
  sets: ContextContainerProps[],
  modelArgs: ModelArgs
) {
  console.log("ANALYSIS_query-messages", messages);
  console.log("ANALYSIS_query-sets", sets);
  console.log("ANALYSIS_query-modelArgs", modelArgs);
  

  console.log(
    "PROMPT_ANALYSIS_QUERY1.general(sets)",
    PROMPT_ANALYSIS_QUERY1.general(sets)
  );
  //const system = {};
  const system = SystemPrompts.songwriterGeniusPrompt1();

  // console.log("system", system);
  // console.log(
  //   "messages",
  //   messages.map((m: CoreMessage) => m.content)
  // );
  console.log("ANALYSIS_query-modelArgs2", modelArgs)

  //return NextResponse.json({'system': system})

 const model = await MODEL_getModel_ai(modelArgs.modelName, modelArgs.provider);

    console.log("Analysis query model", model)
    console.log("Analysis query system", system)
    console.log("Analysis query messages", messages)
    console.log("Analysis query modelArgs", modelArgs)


//return NextResponse.json({'model': 'model'})

  const result = await streamText({
    model: model ? model : openai("gpt-4o-mini"),
    system: system,
    messages: convertToCoreMessages(messages),
    temperature: modelArgs.temperature,
    //prompt: "Analyze the following lyrics",
  });

  // console.log("result", result)
  // return NextResponse.json({'result...': result})

  // const result = await streamText({
  //     model: openai("gpt-4o"),

  //     messages: convertToCoreMessages(messages),
  //     //prompt: "Analyze the following lyrics",
  // })
  return result.toDataStreamResponse();

  //return system;
}

export async function MODEL_getModel_ai(modelName: ModelNames, provider: ModelProviderEnum){
  let model: any;
  switch (provider) {
    case "OPENAI":
      model = await MODEL_openai({ modelName } as OpenAIProps);

      break;
    case "ANTHROPIC":
      model = await MODEL_Anthropic({ modelName } as AnthropicProps);

      break;
    case "MISTRAL":
      model = await MODEL_mistral({ modelName } as MistralProps);

      break;
    case "COHERE":
      model = await MODEL_cohere({ modelName } as CohereProps);

      break;
    case "GOOGLE_G":
      model = await MODEL_google_generative_AI({
        modelName,
      } as GoogleGenerativeAIProps);

      break;

    default:
      break;
  }
  return model;
}

// langchain version
export async function MODEL_getModel_lc(modelName: ModelNames, provider: ModelProviderEnum, temperature: number, streaming: boolean): Promise<any>{
  let model: any;
  switch (provider) {
    case "OPENAI":
      model = await MODEL_openai_lc(modelName, temperature, streaming);

      break;
    case "ANTHROPIC":
      model = await MODEL_anthropic_lc(modelName, temperature, streaming);
      break;
    case "MISTRAL":
      model = await MODEL_mistral_lc(modelName, temperature, streaming);
      break;
    case "COHERE":
      model = await MODEL_cohere_lc(modelName, temperature, streaming);
      break;
    case "GOOGLE_G":
      model = await MODEL_google_gen_lc(modelName, temperature, streaming);
      break;
  }
  return model;
}
