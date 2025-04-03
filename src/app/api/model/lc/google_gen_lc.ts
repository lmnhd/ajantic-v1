import { ModelNames } from "@/src/lib/types";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

export async function MODEL_google_gen_lc(modelName: ModelNames, temperature: number, streaming: boolean){

    return new ChatGoogleGenerativeAI({
        model: modelName || "gemini-1.5-pro-preview-0307",
        temperature: temperature || 0,
        maxRetries: 2,
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
        streaming: streaming || false,
    });
}