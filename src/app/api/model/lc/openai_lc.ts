import { ModelNames } from "@/src/lib/types";
import { ChatOpenAI } from "@langchain/openai";

export async function MODEL_openai_lc(modelName: ModelNames, temperature: number, streaming: boolean){
    return new ChatOpenAI({
        model: modelName || "gpt-4o-mini",
        temperature: temperature || 0,
        apiKey: process.env.OPENAI_API_KEY,
        verbose: true,
        maxTokens: -1,
        streaming: streaming,
        //streaming: streaming || false,
        // other params...
      });
}

