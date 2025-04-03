import { DynamicTool, DynamicStructuredTool } from "@langchain/core/tools";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  FunctionMessage,
  BaseMessage,
} from "@langchain/core/messages";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
  PromptTemplate,
} from "@langchain/core/prompts";
import { formatToOpenAIFunctionMessages } from "langchain/agents/format_scratchpad";
import { RunnableSequence } from "@langchain/core/runnables";
import { NextResponse } from "next/server";

import zodToJsonSchema from "zod-to-json-schema";
import {
  FunctionsAgentAction,
  OpenAIFunctionsAgentOutputParser,
} from "langchain/agents/openai/output_parser";
import { convertToOpenAIFunction } from "@langchain/core/utils/function_calling";
import { ChainValues } from "@langchain/core/utils/types";
import { Artist } from "@/src/lib/types";
import { db } from "@/src/lib/db";
import { titleChain } from "../title";
import { getLyricsFromGenius } from "../lyrics/genius";

//export const runtime = "edge";

export async function POST(req: Request) {
  let response: ChainValues | void | string = { message: "Hello" };
  let result: any = "testing";
  const {
    originalLyrics,
    messages,
  }: {
    originalLyrics: string;
    messages: [];
  } = await req.json();

  if (originalLyrics.length === 0) {
    return NextResponse.json({
      message: "No original lyrics to blockarize",
    });
  }
  //console.log('messages ==> ', messages);
  // console.log('userId: ', userId)
  // return NextResponse.json({
  //   message: "Hello",
  // });

  //const responseText = await BlockarizeText(originalLyrics, messages);

  return NextResponse.json({});
}
