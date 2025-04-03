import { ModelNames } from "@/src/lib/types";
import { ChatCohere } from "@langchain/cohere";

export async function MODEL_cohere_lc(modelName: ModelNames, temperature: number, streaming: boolean){
    return new ChatCohere({
        model: modelName || "command-r-plus",
        apiKey: process.env.COHERE_API_KEY,
        temperature: 0,
        maxRetries: 2,
        // other params...
        streaming: streaming || false,
      })
}

