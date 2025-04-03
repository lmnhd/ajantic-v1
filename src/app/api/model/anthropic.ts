import { anthropic } from '@ai-sdk/anthropic';
import { createAnthropic } from '@ai-sdk/anthropic';
import modelsData from './vercel_models.json';

// Extract Anthropic model names from the JSON file using keys
export type AnthropicModelNames = keyof typeof modelsData.Anthropic;
// Export as enum-like object for backward compatibility
export const AnthropicModelNames = Object.fromEntries(
  Object.keys(modelsData.Anthropic).map(key => [key.replace(/-/g, '_').toUpperCase(), key])
) as Record<string, string>;

export type AnthropicProps = {
    modelName: AnthropicModelNames
}

export async function MODEL_Anthropic({modelName}:AnthropicProps){
    const anthropic = createAnthropic({
        // custom settings
        baseURL: 'https://api.anthropic.com/v1',
        apiKey: process.env.ANTHROPIC_API_KEY,
    });
    
    return anthropic(modelName, {})
}