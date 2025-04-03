import { ModelNames } from "@/src/lib/types";
import { ChatMistralAI } from "@langchain/mistralai";

export async function MODEL_mistral_lc(modelName: ModelNames, temperature: number, streaming: boolean){

    return new ChatMistralAI({
        model: modelName || "mistral-large-latest",
        temperature: temperature || 0,
        maxRetries: 2,
        apiKey: process.env.MISTRAL_API_KEY,
        streaming: streaming || false,
    });
}