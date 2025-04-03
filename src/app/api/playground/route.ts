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
  HumanMessage,
  MessageType,
} from "@langchain/core/messages";

import { TavilySearchAPIRetriever } from "@langchain/community/retrievers/tavily_search_api";
import {
  convertServerMessagesToBaseMessages,
  generateAgent,
} from "../structuredoutput";
import { ModelArgs, ModelNames, ModelProviderEnum } from "@/src/lib/types";
import {
  NAMEPROMPT_generateNameForDirectivePrompt,
  generateNameFromPrompt,
} from "../name-prompt";
import { FORMAT_generateFormattedPrompt } from "../format-prompt";

import { ServerMessage } from "@/src/lib/types";

//import { PLAYGROUND_testAgentic } from ".";


// The truth is always somewhere in the middle

// //export const runtime = "edge";
// export async function testSomething() {
//   return { message: "Hello" };
// }

export async function POST(req: Request) {
  //let response = { message: "Hello" };
  const {
    content,
    messages,
    serializedState,
  }: // system,
  // useLatestLLM,


  // useTools,
  // user,
  // modelArgs,
  {
    content: string;
    messages: ServerMessage[];
    serializedState: string;
    system: string;
    user?: string;
    useTools?: boolean;
    useLatestLLM?: boolean;
    modelArgs: ModelArgs;
  } = await req.json();
  // const title = await titleChain(lyrics);
  // console.log('title: ', title);
  // console.log("modelArgs", modelArgs);
  // console.log("provider", modelArgs.provider);

  // console.log("content", content);
  // console.log("messages", messages);
  // const response = await langChainBasicAgent(
  //   content,
  //   await convertServerMessagesToBaseMessages(messages) );

  // const response = await ANALYSIS_TOOLS_agentTester2({
  //   message: content,
  //   chatHistory: messages,
  //   index: 0,
  //   serializedState: serializedState,
  // });

  const response = ""
  console.log("response", response);

  //return NextResponse.json(await NAMEPROMPT_generateNameForDirectivePrompt(user!, modelArgs));

  // const promptName = await NAMEPROMPT_generateNameForDirectivePrompt(user!, modelArgs);

  // const formattedPrompt = await FORMAT_generateFormattedPrompt(user!);

  //   return NextResponse.json({ promptName, formattedPrompt });
  return NextResponse.json({ content: response });
}
