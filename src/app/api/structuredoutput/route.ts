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

import { generateAgent } from ".";

// The truth is always somewhere in the middle

//export const runtime = "edge";

export async function POST(req: Request) {
  let response = { message: "Hello" };
  const {
    system,
    useLatestLLM,
    useTools,
    user,
  }: {
    system: string;
    user?: string;
    useTools?: boolean;
    useLatestLLM?: boolean;
  } = await req.json();
  // const title = await titleChain(lyrics);
  // console.log('title: ', title);

  return NextResponse.json({}
    // generateAgent("Your are a helpful assistant. Use your tools if needed and return your answer\s using the structured output tool. ", "Hi, return a list of 5 seperate single line lyrics about perverted rats.", true, false)
  );
}
