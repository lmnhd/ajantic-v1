"use server";

import { PINECONE_storeData, PINECONE_search } from "@/src/app/api/pinecone";
import {
  SERVER_deleteGeneralPurposeData,
  SERVER_getGeneralPurposeDataMany,
  SERVER_getGeneralPurposeDataSingle,
  SERVER_storeGeneralPurposeData,
} from "@/src/lib/server";
import { createOpenAI, openai } from "@ai-sdk/openai";
import { generateText, tool } from "ai";
import z from "zod";
import { MODEL_getModel_ai } from "../vercelAI-model-switcher";
import { ModelProviderEnum } from "@/src/lib/types";
import { DYNAMIC_NAMES } from "../dynamic-names";
import { TextChatLogProps } from "../text-chat-log";
import { logger } from '@/src/lib/logger';

export const AGENT_TOOLS_agentDiary = async (
  agentName: string,
  teamName: string,
  userId: string,
  textChatLogs: TextChatLogProps[]
) => {
  return {
    JOURNAL_write: tool({
      description: "Add information to an agent's private journal",
      parameters: z.object({
        agentName: z
          .string()
          .describe("The name of the agent writing the entry"),
        thought: z.string().describe("The thought to enter into the diary"),
      }),
      async execute({ agentName, thought }) {
        logger.tool("Recording agent thought", {
          action: "JOURNAL_WRITE",
          agent: agentName,
          team: teamName,
          thoughtLength: thought.length
        });
        
        textChatLogs.push({
          role: "function",
          message: `${agentName} writing journal entry: ${thought}`,
          agentName: "JOURNAL_write",
          timestamp: new Date(),
        });
        
        const result = await agentDiary({ thought, agentName, teamName, userId });
        logger.tool("Agent Diary Tool - Entry Written", { 
          agent: agentName,
          success: !result.includes("Error")
        });
        return "Entry added to the journal";
      },
    }),
    JOURNAL_read: tool({
      description:
        "Find and read similar entries from the journal using a semantic search",
      parameters: z.object({
        query: z.string().describe("The query to search for in the diary"),
      }),
      async execute({ query }) {
        logger.tool("Searching agent journal", {
          action: "JOURNAL_SEARCH",
          agent: agentName,
          query: query.substring(0, 50) + (query.length > 50 ? "..." : "")
        });
        
        textChatLogs.push({
          role: "function",
          message: `Reading journal entries matching: ${query}`,
          agentName: "JOURNAL_read",
          timestamp: new Date(),
        });
        
        const result = await agentDiaryRead({ query, agentName, teamName, userId });
        logger.tool("Agent Diary Tool - Entries Retrieved", {
          agent: agentName,
          success: !result.includes("Error"),
          resultLength: result.length
        });
        return result;
      },
    }),
  };
};

export const agentDiary = async ({
  agentName,
  teamName,
  thought,
  userId,
}: {
  thought: string;
  agentName: string;
  teamName: string;
  userId: string;
}) => {
  let result = "";
  const _nameSpace = `diary-${userId}-${agentName}-${teamName}`;
  
  logger.tool("Persisting journal entry", {
    action: "JOURNAL_STORE",
    namespace: _nameSpace,
    agent: agentName,
    team: teamName,
    timestamp: new Date().toISOString()
  });
  
  try {
    const _complete = await PINECONE_storeData({
      toStore: [thought],
      metadata: {
        thought,
        date: new Date().toISOString(),
        agentName,
        teamName,
        userId,
      },
      namespace: _nameSpace,
    });

    await SERVER_storeGeneralPurposeData(
      thought,
      agentName,
      teamName,
      userId,
      _nameSpace,
      true
    );
    
    result = `Added '${thought}_${userId}_${teamName}_${agentName}' to the diary`;
    logger.tool("Agent Diary - Entry Stored", {
      namespace: _nameSpace,
      success: true
    });
  } catch (error) {
    logger.tool("Agent Diary - Storage Error", {
      namespace: _nameSpace,
      error: (error as Error).message
    });
    result = `Error adding to diary: ${error}`;
  }
  return result;
};

export const agentDiaryRead = async ({
  query,
  agentName,
  teamName,
  userId,
}: {
  query: string;
  agentName: string;
  teamName: string;
  userId: string;
}) => {
  let result = "";
  const _nameSpace = `diary-${userId}-${agentName}-${teamName}`;
  
  logger.tool("Retrieving journal entries", {
    action: "JOURNAL_RETRIEVE",
    namespace: _nameSpace,
    query: query.substring(0, 50) + (query.length > 50 ? "..." : "")
  });

  try {
    const memory = await PINECONE_search(query, _nameSpace, {}, 10);
    result = memory;
    logger.tool("Agent Diary - Entries Retrieved", {
      namespace: _nameSpace,
      resultLength: memory.length
    });
  } catch (error) {
    logger.tool("Agent Diary - Read Error", {
      namespace: _nameSpace,
      error: (error as Error).message
    });
    result = `Error reading diary: ${error}`;
  }
  return result;
};

export const clientInfo = async ({
  notes,
  agentName,
  teamName,
  userId,
}: {
  notes: string;
  agentName: string;
  teamName: string;
  userId: string;
}) => {
  let result = "";
  const dbName = DYNAMIC_NAMES.db_client_info(agentName, userId);
  
  logger.tool("Storing client information", {
    action: "CLIENT_INFO_STORE",
    dbName: dbName,
    agent: agentName,
    team: teamName,
    notesLength: notes.length
  });
  
  try {
    const _complete = await PINECONE_storeData({
      toStore: [notes],
      metadata: {
        notes,
        date: new Date().toISOString(),
        agentName,
        teamName,
        userId,
      },
      namespace: DYNAMIC_NAMES.semantic_knowledge_base(userId),
    });

    await SERVER_storeGeneralPurposeData(
      notes,
      `${agentName}_${teamName}`,
      "client-info",
      userId,
      dbName,
      true
    );
    
    result = `Added '${dbName}' to the client info`;
    logger.tool("Client Info - Notes Stored", {
      dbName: dbName,
      success: true
    });
  } catch (error) {
    logger.tool("Client Info - Storage Error", {
      dbName: dbName,
      error: (error as Error).message
    });
    result = `Error adding to client info: ${error}`;
  }
  return result;
};

export const deleteClientInfo = async ({
  notes,
  agentName,
  teamName,
  userId,
}: {
  notes: string;
  agentName: string;
  teamName: string;
  userId: string;
}) => {
  let result = "";
  const dbName = DYNAMIC_NAMES.db_client_info(agentName, userId);
  
  logger.tool("Removing client information", {
    action: "CLIENT_INFO_DELETE",
    dbName: dbName,
    agent: agentName,
    team: teamName
  });
  
  try {
    const id = (
      await SERVER_getGeneralPurposeDataSingle(dbName, `${agentName}_${teamName}`, "client-info", userId)
    ).id;

    if (id) {
      await SERVER_deleteGeneralPurposeData(id);
      result = `Deleted '${notes}_${userId}_${teamName}_${agentName}' from the client info`;
      logger.tool("Client Info - Notes Deleted", {
        dbName: dbName,
        success: true
      });
    } else {
      logger.tool("Client Info - Delete Error", {
        dbName: dbName,
        error: "ID not found"
      });
      result = `Error deleting '${notes}_${userId}_${teamName}_${agentName}' from the client info: ID not found`;
    }
  } catch (error) {
    logger.tool("Client Info - Delete Error", {
      dbName: dbName,
      error: (error as Error).message
    });
    result = `Error deleting client info: ${error}`;
  }
  return result;
};

export const _testAgentDiary = async () => {
  // console.log("testAgentDiary", {tools: await AGENT_TOOLS_agentDiary("test", "test", "test")});

  const model = await MODEL_getModel_ai({
    modelName: "gpt-4o-mini",
    provider: ModelProviderEnum.OPENAI,
    temperature: 0.5,
  });
  const response = await generateText({
    model,
    // prompt: "Write a diary entry about the following thought: 'Hello, world!' and use the provided tools to add the entry to the diary.",
    messages: [
      {
        role: "system",
        content:
          "You are an AI assistant helping the developer troubleshoot tools.",
      },
      // {role: "user", content: "What tools do you have access to?"},
      {
        role: "user",
        content:
          "Write a diary entry about the following thought: 'Hello, world!' and use the provided tools to add the entry to the diary.",
      },
    ],
    maxRetries: 2,

    maxSteps: 10,
    tools: await AGENT_TOOLS_agentDiary(
      "Test_Agent_1",
      "Playground_Test_Team_1",
      "Test_User_1",
      []
    ),
  });
  console.log("response", response);
};

export const _testReadDiary = async () => {
  const response = await agentDiaryRead({
    query: "Hello, world!",
    agentName: "Test_Agent_1",
    teamName: "Playground_Test_Team_1",
    userId: "Test_User_1",
  });
  console.log("response", response);
};
