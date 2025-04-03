import { ModelProviderEnum, ModelProviderSelectName } from "@/src/lib/types";
//import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { AnthropicModelNames } from "./anthropic";
import { CohereModelNames } from "./cohere";
import { MistralModelNames } from "./mistral";
import { GoogleGenerativeAIModelNames } from "./google";
import { UTILS_getModelsJSON } from "@/src/lib/utils";
//import { BedrockModelNames } from "./bedrock";
export const getOpenAIModelNamesOnline = async () => {
  //console.log("OPENAI_API_KEY", process.env.OPENAI_API_KEY);
  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
    });
    const modelNames: { data: ModelProviderSelectName[] } = await response.json();
    //return Object.values(data.data.map((model: any) => model.id))
    // console.log(
    //   "DATA--",
    //   modelNames.data
    //     .map((model: ModelProviderSelectName) => model.id)
    //     .sort()
    //     .join("\n")
    // );
    return modelNames.data.map((model: ModelProviderSelectName) => model);
  } catch (error: unknown) {
    console.log("Error getting OpenAI model names")
    return null;
  }
};

//GET /foundation-models?byCustomizationType=byCustomizationType&byInferenceType=byInferenceType&byOutputModality=byOutputModality&byProvider=byProvider HTTP/1.1
export type BedrockModelOptions = {
  byCustomizationType?: string;
  byInferenceType?: string;
  byOutputModality?: string;
  byProvider?: string;
};
// export const getBedrockModelNamesOnline: (
//   options: BedrockModelOptions
// ) => Promise<{ data: ModelProviderSelectName[] }> = async ({
//   byCustomizationType = "CONTINUED_PRE_TRAINING",
//   byInferenceType = "ON_DEMAND",
//   byOutputModality = "TEXT",
//   byProvider = "",
// }: BedrockModelOptions) => {
//   try {
//     const response = await fetch(
//       `https://api.bedrock.aws/foundation-models?byCustomizationType=${byCustomizationType}&byInferenceType=${byInferenceType}&byOutputModality=${byOutputModality}&byProvider=${byProvider}`,
//       {
//         headers: {
//           Authorization: `Bearer ${process.env.AWS_ACCESS_KEY_ID}`,
//         },
//       }
//     );
//     const modelNames: { data: ModelProviderSelectName[] } =
//       await response.json();
//     console.log(
//       "DYNAMIC-MODEL-NAMES - getBedrockModelNamesOnline: ",
//       modelNames.data
//         .map((model: any) => model.id)
//         .sort()
//         .join("\n")
//     );
//     return modelNames;
//   } catch (error) {
//     console.error(
//       "DYNAMIC-MODEL-NAMES - getBedrockModelNamesOnline: Error fetching Bedrock model names: ",
//       error
//     );
//     throw error;
//   }
// };

export const getAllModelProvidersFromEnum = (): string[] => {
  const _names = Object.values(ModelProviderEnum).map(
    (provider: ModelProviderEnum) => {
      return provider;
    }
  );
  return _names;
};

export const getAllModelNamesFromProviderNames = async (
  providerNames: string[]
): Promise<ModelProviderSelectName[]> => {
  const _names = await Promise.all(
    providerNames.map(async (provider: string) => {
      switch (provider) {
        case ModelProviderEnum.OPENAI:
          const openaiModelNames = await getOpenAIModelNamesOnline();
          if (openaiModelNames) {
            return openaiModelNames.map(
              (model: ModelProviderSelectName) => ({
                id: model.id,
                name: "OpenAI",
              })
            ) || [];
          }
          return [];
        // case ModelProviderEnum.BEDROCK:
        //   return Object.values(BedrockModelNames).map((model: string) => ({
        //     id: model,
        //     name: "Bedrock",
        //   }));
        case ModelProviderEnum.ANTHROPIC:
          // Get model names directly from the JSON data
          return Object.keys(UTILS_getModelsJSON().Anthropic).map(
            (model: string) => ({ id: model, name: "Anthropic" })
          );
        case ModelProviderEnum.COHERE:
          return Object.keys(UTILS_getModelsJSON().Cohere).map(
            (model: string) => ({ id: model, name: "Cohere" })
          );
        case ModelProviderEnum.MISTRAL:
          return Object.keys(UTILS_getModelsJSON().Mistral).map(
            (model: string) => ({ id: model, name: "Mistral" })
          );
        case ModelProviderEnum.GOOGLE_G:
          return Object.keys(UTILS_getModelsJSON().Google).map(
            (model: string) => ({ id: model, name: "Google GenAI" })
          );
        default:
          return [];
      }
    })
  );
  return _names.flat();
};

export const DYNAMIC_MODEL_NAMES = {
  OpenAI: async () => {
    console.log("GETTING OPENAI MODEL NAMES ONLINE");
    return (await getOpenAIModelNamesOnline()) as ModelProviderSelectName[];
  },
  // Bedrock: async () => {
  //   return (Object.values(BedrockModelNames)).map(
  //     (model: string) => ({ id: model, name: "Bedrock" })
  //   );
  // },
  Anthropic: async () => {
    return (Object.values(AnthropicModelNames) as string[]).map(
      (model: string) => ({ id: model, name: "Anthropic" })
    );
  },
  Cohere: async () => {
    return (Object.values(CohereModelNames) as string[]).map(
      (model: string) => ({ id: model, name: "Cohere" })
    );
  },
  Mistral: async () => {
    return (Object.values(MistralModelNames) as string[]).map(
      (model: string) => ({ id: model, name: "Mistral" })
    );
  },
  GoogleGenAI: async () => {
    return (Object.values(GoogleGenerativeAIModelNames) as string[]).map(
      (model: string) => ({ id: model, name: "Google GenAI" })
    );
  },
  All: async () => {
    const providerNames = getAllModelProvidersFromEnum();
    return await getAllModelNamesFromProviderNames(providerNames);
  },
};
