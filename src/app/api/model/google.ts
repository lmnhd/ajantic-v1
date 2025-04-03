//import { google } from '@ai-sdk/google';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import modelsData from './vercel_models.json';
//import { createVertex } from '@ai-sdk/google-vertex';

// const vertex = createVertex({
//  // project: 'my-project', // optional
//  // location: 'us-central1', // optional
// });

const google = createGoogleGenerativeAI({
  // custom settings
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

// Extract Google model names from the JSON file using keys
export type GoogleGenerativeAIModelNames = keyof typeof modelsData.Google;
// Export as enum-like object for backward compatibility
export const GoogleGenerativeAIModelNames = Object.fromEntries(
  Object.keys(modelsData.Google).map(key => [key.replace(/-/g, '_').toUpperCase().replace(/\//g, '_'), key])
) as Record<string, string>;

export type GoogleGenerativeAIProps = {
    modelName: GoogleGenerativeAIModelNames
}

export async function MODEL_google_generative_AI({modelName}:GoogleGenerativeAIProps){
    return google(modelName, {
        safetySettings: [
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_LOW_AND_ABOVE' },
        ],
      });
}

// Keeping this for potential future use with Vertex
export type GoogleVertexModelNames = 
    | 'gemini-1.5-flash'
    | 'gemini-1.5-pro'
    | 'gemini-1.0-pro-vision'
    | 'gemini-1.0-pro';

export type GoogleVertexProps = {
    modelName: GoogleVertexModelNames
}

// export async function MODEL_google_vertex({modelName}:GoogleVertexProps){
//     return vertex(modelName, {
//         safetySettings: [
//           { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_LOW_AND_ABOVE' },
//         ],
//       });
// }