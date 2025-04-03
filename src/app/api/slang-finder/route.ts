////"use server";

import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";

import { RunnableSequence } from "@langchain/core/runnables";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import {
  AgentExecutor,
  AgentFinish,
  AgentStep,
  createOpenAIFunctionsAgent,
} from "langchain/agents";
import { DynamicTool } from "@langchain/core/tools";
import type { FunctionsAgentAction } from "langchain/agents/openai/output_parser";
import { convertToOpenAIFunction } from "@langchain/core/utils/function_calling";

import { NextResponse } from "next/server";
import {
  AIMessage,
  BaseMessage,
  FunctionMessage,
} from "@langchain/core/messages";

import { TavilySearchAPIRetriever } from "@langchain/community/retrievers/tavily_search_api";
import { generateAgent } from "../structuredoutput";
import { ModelArgs, ModelNames, ModelProviderEnum } from "@/src/lib/types";
import { NAMEPROMPT_generateNameForDirectivePrompt, generateNameFromPrompt } from "../name-prompt";

// The truth is always somewhere in the middle

// //export const runtime = "edge";
// export async function testSomething() {
//   return { message: "Hello" };
// }

export async function POST(req: Request) {
  //let response = { message: "Hello" };
  const {
    system,
    useLatestLLM,
    useTools,
    user,
    modelArgs,
  }: {
    system: string;
    user?: string;
    useTools?: boolean;
    useLatestLLM?: boolean;
    modelArgs: ModelArgs;
  } = await req.json();
  // const title = await titleChain(lyrics);
  // console.log('title: ', title);
  console.log("modelArgs", modelArgs);
  console.log("provider", modelArgs.provider);

  return NextResponse.json(await NAMEPROMPT_generateNameForDirectivePrompt(user!, modelArgs));

  const agent = await generateAgent(
    system,
    [
      {
        modelName: modelArgs.modelName as ModelNames,
        provider: modelArgs.provider as ModelProviderEnum,
        temperature: modelArgs.temperature,
      },
    ],
    user,
    true
  );
  console.log("agent", agent);

  const response = await agent.invoke({ input: user });

  console.log("response", response);

  return NextResponse.json({ system, useLatestLLM, useTools, user });
}
