import { AnthropicProps, MODEL_Anthropic } from "@/src/app/api/model/anthropic";
// import { BedrockProps } from "@/src/app/api/model/bedrock";
// import { MODEL_bedrock } from "@/src/app/api/model/bedrock";
import { CohereProps, MODEL_cohere } from "@/src/app/api/model/cohere";
import { DeepSeekProps } from "@/src/app/api/model/deepseek";
import { MODEL_deepseek } from "@/src/app/api/model/deepseek";
import {
  GoogleGenerativeAIProps,
  MODEL_google_generative_AI,
} from "@/src/app/api/model/google";
import { MistralProps, MODEL_mistral } from "@/src/app/api/model/mistral";
import { MODEL_openai, OpenAIProps } from "@/src/app/api/model/openai";
import { ModelArgs } from "@/src/lib/types";

export async function MODEL_getModel_ai(modelArgs: ModelArgs) {
  let model: any;

  switch (modelArgs.provider.toUpperCase()) {
    case "OPENAI":
      model = await MODEL_openai({
        modelName: modelArgs.modelName,
      } as OpenAIProps);

      break;
    case "ANTHROPIC":
      model = await MODEL_Anthropic({
        modelName: modelArgs.modelName,
      } as AnthropicProps);

      break;
    case "MISTRAL":
      model = await MODEL_mistral({
        modelName: modelArgs.modelName,
      } as MistralProps);

      break;
    case "COHERE":
      model = await MODEL_cohere({
        modelName: modelArgs.modelName,
      } as CohereProps);

      break;
    case "GOOGLE_G":
      model = await MODEL_google_generative_AI({
        modelName: modelArgs.modelName,
      } as GoogleGenerativeAIProps);

      break;
    case "BEDROCK":
      //model = await MODEL_bedrock({ modelName: modelArgs.modelName } as BedrockProps);
      break;

    case "DEEPSEEK":
      model = await MODEL_deepseek({
        modelName: modelArgs.modelName,
      } as DeepSeekProps);
      break;

    default:
      model = await MODEL_openai({
        modelName: modelArgs.modelName,
      } as OpenAIProps);

      break;
  }
  return model;
}
