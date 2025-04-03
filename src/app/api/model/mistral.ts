import { createMistral } from '@ai-sdk/mistral';
import modelsData from './vercel_models.json';

const mistral = createMistral({
  // custom settings
  apiKey: process.env.MISTRAL_API_KEY,
});

// Extract Mistral model names from the JSON file using keys
export type MistralModelNames = keyof typeof modelsData.Mistral;
// Export as enum-like object for backward compatibility
export const MistralModelNames = Object.fromEntries(
  Object.keys(modelsData.Mistral).map(key => [key.replace(/-/g, '_').toUpperCase(), key])
) as Record<string, string>;

export type MistralProps = {
    modelName: MistralModelNames
}

export async function MODEL_mistral({modelName}:MistralProps){
    return mistral(modelName)
}

export async function MODEL_mistral_embeddings(){
    return mistral.embedding('mistral-embed');
}