import { createOpenAI, openai as openai_ai_sdk } from '@ai-sdk/openai';
import modelsData from './vercel_models.json';

const openai = createOpenAI({
   apiKey: process.env.OPENAI_API_KEY,
})

// Extract OpenAI model names from the JSON file using keys
export type OpenAIModelNames = keyof typeof modelsData.OpenAI;
// Export as enum-like object for backward compatibility
export const OpenAIModelNames = Object.fromEntries(
  Object.keys(modelsData.OpenAI).map(key => [key.replace(/-/g, '_').toUpperCase(), key])
) as Record<string, string>;

export type OpenAIProps = {
    modelName: string, 
    temperature: number
}

export async function MODEL_openai({modelName, temperature}:OpenAIProps){
    console.log("Calling MODEL_openai with modelName", modelName)
    return openai(modelName)
}