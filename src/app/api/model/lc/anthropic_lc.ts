import { ModelNames } from "@/src/lib/types";
import { ChatAnthropic } from "@langchain/anthropic";

export async function MODEL_anthropic_lc(modelName: ModelNames, temperature: number, streaming: boolean){
    return new ChatAnthropic({
        model: modelName || "claude-3-haiku-20240307",
        temperature: temperature || 0,
        //maxTokens: -1,
        streaming: streaming || false,
        maxRetries: 2,
        apiKey: process.env.ANTHROPIC_API_KEY,
    });
}