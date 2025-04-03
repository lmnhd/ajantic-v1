import { createCohere } from '@ai-sdk/cohere';
import modelsData from './vercel_models.json';

const cohere = createCohere({
  // custom settings
  apiKey: process.env.COHERE_API_KEY,
});

// Extract Cohere model names from the JSON file using keys
export type CohereModelNames = keyof typeof modelsData.Cohere;
// Export as enum-like object for backward compatibility
export const CohereModelNames = Object.fromEntries(
  Object.keys(modelsData.Cohere).map(key => [key.replace(/-/g, '_').toUpperCase(), key])
) as Record<string, string>;

export type CohereProps = {
    modelName: CohereModelNames
}

export async function MODEL_cohere({modelName}:CohereProps){
    return cohere(modelName, {})
}