import { z } from "zod";
import { AGENT_TOOLS_pinecone } from "./pinecone-db/pinecone";
import { AGENT_TOOLS_splitters } from "./pinecone-db/pinecone";
import {
  AI_Agent_Tools,
  AISessionState,
  ContextContainerProps,
  ModelProviderEnum,
} from "@/src/lib/types";
import { AGENT_TOOLS_word } from "./word-tools";
import { AGENT_TOOLS_agentGlobalState } from "@/src/app/api/pinecone/agent_global_state";
import { AGENT_TOOLS_video } from "./video-gen/runway-video-tool";

import {
  AGENT_TOOLS_generateReferenceDocuments,
  AGENT_TOOLS_urlScrape,
} from "./url-scrape/url-scrape";
import { AGENT_TOOLS_contextSets } from "./context-sets/context-sets";
import { AGENT_TOOLS_fetch } from "./fetch/fetch";
import { AGENT_TOOLS_puppeteer } from "./puppeteer-tool/puppeteer";
import { VectorStoreRetriever } from "@langchain/core/vectorstores";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "@langchain/openai";
import { TextChatLogProps } from "../text-chat-log";
import { AGENT_TOOLS_dynamicScript } from "./dynamic-tool/dynamic-action";
import { AGENT_TOOLS_gmail } from "./gmail";
import { AGENT_TOOLS_NEXT_AUTH } from "./next-auth-tool/next-auth-tool";
import { AGENT_TOOLS_s3Store } from "./s3-store-tool";
import { AGENT_TOOLS_DOCUMENT_PARSE } from "./documents-tools/document-parse-tool";
import { AGENT_TOOLS_autoGenTool } from "./auto-gen-tool/auto-gen-tool";
import { logger } from "@/src/lib/logger";
import { AGENT_TOOLS_database } from "./database-tool/database-tool";
import { AGENT_TOOLS_knowledgeBase } from "./knowledgebase-tool/kb-tool";
import { AGENT_TOOLS_documentProcessor } from "./documents-tools/document-processor";
import { AGENT_TOOLS_perplexity2 } from "./perplexity2";
export const LOAD_AGENT_TOOLS = (
  toolNames: AI_Agent_Tools[] | string[],
  loadedTools: any = {},
  sets: ContextContainerProps[],
  vc: MemoryVectorStore,
  textChatLogs: TextChatLogProps[],
  state: AISessionState,
  agentName: string,
  userID: string,
  query: string
) => {
  const allAgents = state.currentAgents.agents;
  const currentAgent = allAgents.find((agent) => agent.name === agentName);
  if (!currentAgent) {
    throw new Error(`Current agent not found: ${agentName}`);
  }
  
  // Custom tools are now directly handled through the loadCustomToolsForOrchestration function
  // and passed in the unified tools array, so we don't need to handle them separately here

  // Process all tool names (standard and custom references)
  toolNames.forEach(async (toolName) => {
    // Handle string tool names (custom) vs enum tool names (standard)
    const toolNameStr = toolName.toString();

    // Skip if not a standard tool
    if (
      !Object.values(AI_Agent_Tools).includes(toolNameStr as AI_Agent_Tools)
    ) {
      return; // Skip - custom tool references are handled by loadCustomToolsForOrchestration
    }

    switch (toolNameStr as AI_Agent_Tools) {
      case AI_Agent_Tools.PINECONE:
        loadedTools = {
          ...loadedTools,
          ...AGENT_TOOLS_pinecone(textChatLogs || []),
        };
        break;
      case AI_Agent_Tools.TEXT_SPLITTER:
        loadedTools = {
          ...loadedTools,
          ...AGENT_TOOLS_splitters(state, textChatLogs || []),
        };
        break;
      case AI_Agent_Tools.AGENT_GLOBAL_STATE:
        loadedTools = {
          ...loadedTools,
          ...AGENT_TOOLS_agentGlobalState(state, textChatLogs || []),
        };
        break;
      case AI_Agent_Tools.WORD:
        loadedTools = {
          ...loadedTools,
          ...AGENT_TOOLS_word(textChatLogs || []),
        };
        break;
      case AI_Agent_Tools.PERPLEXITY:
        loadedTools = {
          ...loadedTools,
          ...AGENT_TOOLS_perplexity2(),
        };
        break;
      case AI_Agent_Tools.URL_SCRAPE:
        loadedTools = {
          ...loadedTools,
          ...AGENT_TOOLS_urlScrape(textChatLogs || []),
        };
        break;
      case AI_Agent_Tools.CREATE_REFERENCE_DOCUMENT:
        loadedTools = {
          ...loadedTools,
          ...AGENT_TOOLS_generateReferenceDocuments(textChatLogs || []),
        };
        break;
      case AI_Agent_Tools.CONTEXT_SETS:
        loadedTools = {
          ...loadedTools,
          ...AGENT_TOOLS_contextSets(
            sets,
            textChatLogs || [],
            currentAgent,
            allAgents.map((agent) => agent.name)
          ),
        };
        break;
      case AI_Agent_Tools.FETCH:
        loadedTools = {
          ...loadedTools,
          ...AGENT_TOOLS_fetch(textChatLogs || []),
        };
        break;
      case AI_Agent_Tools.PUPPETEER:
        //console.log("LOAD_AGENT_TOOLS - AI_Agent_Tools.PUPPETEER")
        // const vc = await MemoryVectorStore.fromDocuments(
        //   [],
        //   new OpenAIEmbeddings()
        // );
        const pup = AGENT_TOOLS_puppeteer("local", vc, textChatLogs || []);
        //console.log("pup", pup);
        loadedTools = {
          ...loadedTools,
          ...pup,
        };
        break;
      case AI_Agent_Tools.DYNAMIC_SCRIPT:
        loadedTools = {
          ...loadedTools,
          ...AGENT_TOOLS_dynamicScript(agentName, userID, textChatLogs || []),
          ...AGENT_TOOLS_perplexity2(),
        };
        break;
      case AI_Agent_Tools.GMAIL:
        loadedTools = {
          ...loadedTools,
          ...AGENT_TOOLS_gmail(textChatLogs || [], userID),
        };
        break;
      case AI_Agent_Tools.OAUTH_PROVIDER:
        loadedTools = {
          ...loadedTools,
          ...AGENT_TOOLS_NEXT_AUTH(
            userID,
            query,
            currentAgent,
            sets,
            vc,
            textChatLogs || []
          ),
          ...(!toolNames.includes(AI_Agent_Tools.FILE_STORE) &&
            AGENT_TOOLS_s3Store(sets, currentAgent)),
        };
        break;
      case AI_Agent_Tools.FILE_STORE:
        loadedTools = {
          ...loadedTools,
          ...AGENT_TOOLS_s3Store(sets, currentAgent),
        };
        break;
      case AI_Agent_Tools.DOCUMENT_PARSE:
        loadedTools = {
          ...loadedTools,
          ...AGENT_TOOLS_DOCUMENT_PARSE(),
        };
        break;
      case AI_Agent_Tools.AUTO_GEN_TOOL:
        loadedTools = {
          ...loadedTools,
          ...AGENT_TOOLS_autoGenTool(agentName, userID, textChatLogs || []),
        };
        break;
      case AI_Agent_Tools.DATABASE:
        loadedTools = {
          ...loadedTools,
          ...AGENT_TOOLS_database(sets, userID, agentName),
        };
        break;
      case AI_Agent_Tools.KNOWLEDGE_BASE:
        loadedTools = {
          ...loadedTools,
          ...AGENT_TOOLS_knowledgeBase(userID, agentName, textChatLogs || []),
        };
        break;
      case AI_Agent_Tools.DOCUMENT_PROCESSOR:
        loadedTools = {
          ...loadedTools,
          ...AGENT_TOOLS_documentProcessor(userID, currentAgent.name, textChatLogs || []),
        };
        break;
      case AI_Agent_Tools.VIDEO_GEN:
        loadedTools = {
          ...loadedTools,
          ...AGENT_TOOLS_video(userID, agentName),
        };
        break;
      default:
        break;
    }
  });
  return loadedTools;
};

export const _testAgentTool = async () => {
  // let vc: VectorStoreRetriever = new VectorStoreRetriever({vectorStore: new MemoryVectorStore({})});
  // const response = await generateText({
  //   model: await MODEL_getModel_ai({modelName: "gpt-4o-mini", provider: ModelProviderEnum.OPENAI, temperature: 0}),
  //   prompt: "Give me a random word from the random word tool.",
  //   tools: LOAD_AGENT_TOOLS([AI_Agent_Tools.WORD], {}, [], vc),
  //   maxSteps: 10
  // })
  // console.log("response", response.text);
  // return response.text;
};
