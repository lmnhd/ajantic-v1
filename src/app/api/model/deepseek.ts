import { deepseek } from '@ai-sdk/deepseek';
import modelsData from './vercel_models.json';

// Extract DeepSeek model names from the JSON file using keys
export type DeepSeekModelNames = string;

export type DeepSeekProps = {
    modelName: DeepSeekModelNames, 
    temperature: number
}

export async function MODEL_deepseek({modelName, temperature}:DeepSeekProps){
    return deepseek(modelName)
}

