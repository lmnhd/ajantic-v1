////"use server";

import { ChatOpenAI, OpenAI, OpenAIEmbeddings } from "@langchain/openai";

import {
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from "@langchain/core/prompts";

import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";

import {
  StringOutputParser,
  BytesOutputParser,
} from "@langchain/core/output_parsers";
import { HttpResponseOutputParser } from "langchain/output_parsers";
import { NAMEPROMPT_generateNameForDirectivePrompt } from "../name-prompt";
import { ModelArgs } from "@/src/lib/types";
import { db } from "@/src/lib/db";
import { GeneralPurpose } from "@prisma/client";

//const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
// const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
// //import { MemoryVectorStore } from "langchain/vectorstores/memory";
// const { MemoryVectorStore } = require("langchain/vectorstores/memory");
// import { RunnableSequence, RunnablePick } from "@langchain/core/runnables";
// import { NextResponse } from "next/server";
// import { db } from "@/lib/db";
// import { loadSummarizationChain } from "langchain/chains";
// //import { TokenTextSplitter } from "langchain/text_splitter";
// const { TokenTextSplitter } = require("langchain/text_splitter");
// import { PromptTemplate } from "@langchain/core/prompts";
// import { ChatAnthropic } from "@langchain/anthropic";

export async function FORMAT_generateFormattedPrompt(
  roughPrompt: string
): Promise<string> {
  const model = new ChatOpenAI({ modelName: "gpt-3.5-turbo" });

  const promptTemplate = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(
      `You are a helpful assistant that formats user prompts into clear, concise, and well-structured instructions.
      Format the prompt in the form of instructions that can be added to a larger prompt to give more clarity about the overall task of the prompt.
      The instructions should be in the following format:
<example>
        - Shift the narrative to first-person perspective, focusing on personal experiences and their impact on others.
        - Center lyrics around themes of longing and obsession, emphasizing intense emotional experiences.
        - Adopt a playful, confident, and energetic tone in your writing.
        - Incorporate modern, playful metaphors with contemporary references for humor and relatability.
        - Use contemporary and vivid imagery that your audience can easily visualize and connect with.
        - Introduce repetition of key phrases to create catchy hooks and emphasize important emotions or ideas.
        - Use short, direct sentences and phrases to convey your message clearly and concisely.
        - Employ a simple AABB rhyme scheme for enhanced lyrical flow and predictability.
        - Increase pacing with shorter lines and frequent repetition to create urgency and energy.
        - Aim for clarity and immediacy in your lyrics while maintaining depth.
</example>

Return only the instructions, no intro, no explanation, no nothing, just the instructions.
      `
    ),
    HumanMessagePromptTemplate.fromTemplate(
      "Please format the following rough prompt into a clear and concise instruction:\n\n{rough_prompt}"
    ),
  ]);

  const chain = promptTemplate.pipe(model).pipe(new StringOutputParser());

  const response = await chain.invoke({
    rough_prompt: roughPrompt,
  });

  return response.trim();
}

export async function PROMPTTOOLS_nameAndFormatPrompt(
  roughPrompt: string,
  modelArgs: ModelArgs,
  userId: string
): Promise<GeneralPurpose> {
  const promptName = await NAMEPROMPT_generateNameForDirectivePrompt(
    roughPrompt,
    modelArgs
  );

  const formattedPrompt = await FORMAT_generateFormattedPrompt(roughPrompt);

  const result = {
    promptName,
    formattedPrompt,
  };
  // add to db
  const dbName = `PromptDirective_${userId}`;
  const saved = db.generalPurpose.create({
    data: {
      name: dbName,
      content: formattedPrompt,
      meta1: promptName,
      meta2: userId,
      meta3: modelArgs.provider,
    },
  });
  return saved;
}
