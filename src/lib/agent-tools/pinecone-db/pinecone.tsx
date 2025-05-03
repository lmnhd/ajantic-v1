import {
  PINECONE_storeData,
  PINECONE_search,
  PINECONE_createIndex,
  PINECONE_deleteIndex,
  PINECONE_deleteVectorsById,
} from "@/src/app/api/pinecone";
import { AGENT_GLOBAL_STATE_save } from "@/src/app/api/pinecone/agent_global_state";
import { TOOLFUNCTION_split_text } from "@/src/app/api/tools/splitters";
import { AGENT_TOOLS_EMULATOR, AISessionState } from "@/src/lib/types";
import { tool } from "ai";
import { z } from "zod";
import { TextChatLogProps } from "../../text-chat-log";
import { logger } from '@/src/lib/logger';
import { SERVER_kbQuery } from "@/src/lib/server2";

export const AGENT_TOOLS_pinecone = (textChatLogs: TextChatLogProps[]) => {
  return {
    PINECONE_store: tool({
      description: `Index documents and store chunks of text in a Pinecone Vector Database.`,

      parameters: z.object({
        toStore: z.array(z.string()).describe("The chunks of text to store."),
        metadata: z.any().describe("The metadata to store with the chunks."),
        namespace: z.string().describe("The namespace to store the chunks in."),
      }),
      execute: async ({ toStore, metadata, namespace }) => {
        logger.tool("Storing data in vector database", {
          action: "PINECONE_STORE",
          namespace,
          documentsCount: toStore.length,
          metadataFields: Object.keys(metadata || {})
        });

        textChatLogs.push({
          role: "function",
          message: `Storing ${toStore.length} chunks in namespace: ${namespace}`,
          agentName: "PINECONE_store",
          timestamp: new Date(),
        });

        try {
          const result = await PINECONE_storeData({ toStore, metadata, namespace });
          logger.tool("Pinecone Tool - Data Stored", {
            namespace: namespace,
            success: true
          });
          return result;
        } catch (error) {
          logger.tool("Pinecone Tool - Storage Error", {
            namespace: namespace,
            error: (error as Error).message
          });
          throw error;
        }
      },
    }),
    PINECONE_search: tool({
      description: `Search for chunks of text in a Pinecone Vector Database.`,

      parameters: z.object({
        query: z.string().describe("The query to search for."),
        metadata: z.any().describe("The metadata to search for."),
        namespace: z.string().describe("The namespace to search in."),
        topK: z.number().describe("The number of results to return."),
      }),
      execute: async ({ query, metadata, namespace, topK }) => {
        logger.tool("Searching vector database", {
          action: "PINECONE_SEARCH",
          namespace,
          query: query.substring(0, 50) + (query.length > 50 ? "..." : ""),
          limit: topK,
          filters: Object.keys(metadata || {})
        });

        textChatLogs.push({
          role: "function",
          message: `Searching for "${query}" in namespace: ${namespace}`,
          agentName: "PINECONE_search",
          timestamp: new Date(),
        });

        try {
          const result = await PINECONE_search(query, namespace, metadata, topK);
          logger.tool("Pinecone Tool - Search Complete", {
            namespace: namespace,
            resultsCount: result.length,
            success: true
          });
          return result;
        } catch (error) {
          logger.tool("Pinecone Tool - Search Error", {
            namespace: namespace,
            error: (error as Error).message
          });
          throw error;
        }
      },
    }),
    PINECONE_deleteVectorsById: tool({
      description: `Delete vectors from the Lyrical database index by ID.`,

      parameters: z.object({
        ids: z.array(z.string()).describe("The IDs of the vectors to delete."),
        namespace: z
          .string()
          .describe("The namespace to delete the vectors from."),
      }),
      execute: async ({ ids, namespace }) => {
        logger.tool("Pinecone Tool - Deleting Vectors", {
          vectorCount: ids.length,
          namespace: namespace
        });

        textChatLogs.push({
          role: "function",
          message: `Deleting ${ids.length} vectors from namespace: ${namespace}`,
          agentName: "PINECONE_deleteVectorsById",
          timestamp: new Date(),
        });

        try {
          const result = await PINECONE_deleteVectorsById(ids, namespace);
          logger.tool("Pinecone Tool - Vectors Deleted", {
            namespace: namespace,
            success: true
          });
          return result;
        } catch (error) {
          logger.tool("Pinecone Tool - Delete Error", {
            namespace: namespace,
            error: (error as Error).message
          });
          throw error;
        }
      },
    }),
    PINECONE_createIndex: tool({
      description: `Create a Pinecone index.`,

      parameters: z.object({
        name: z.string().describe("The name of the index to create."),
      }),
      execute: async ({ name }) => {
        logger.tool("Pinecone Tool - Creating Index", {
          indexName: name
        });

        textChatLogs.push({
          role: "function",
          message: `Creating Pinecone index: ${name}`,
          agentName: "PINECONE_createIndex",
          timestamp: new Date(),
        });

        try {
          await PINECONE_createIndex(name);
          logger.tool("Pinecone Tool - Index Created", {
            indexName: name,
            success: true
          });
        } catch (error) {
          logger.tool("Pinecone Tool - Create Index Error", {
            indexName: name,
            error: (error as Error).message
          });
          throw error;
        }
      },
    }),
    PINECONE_deleteIndex: tool({
      description: `Delete a Pinecone index.`,

      parameters: z.object({
        name: z.string().describe("The name of the index to delete."),
      }),
      execute: async ({ name }) => {
        logger.tool("Pinecone Tool - Deleting Index", {
          indexName: name
        });

        textChatLogs.push({
          role: "function",
          message: `Deleting Pinecone index: ${name}`,
          agentName: "PINECONE_deleteIndex",
          timestamp: new Date(),
        });

        try {
          await PINECONE_deleteIndex(name);
          logger.tool("Pinecone Tool - Index Deleted", {
            indexName: name,
            success: true
          });
        } catch (error) {
          logger.tool("Pinecone Tool - Delete Index Error", {
            indexName: name,
            error: (error as Error).message
          });
          throw error;
        }
      },
    }),
  };
};

export const AGENT_TOOLS_EMULATOR_pinecone = (
  state: AISessionState,
): AGENT_TOOLS_EMULATOR[] => {
  return [
    {
      name: "PINECONE_store",
      description:
        "Index documents and store chunks of text in a Pinecone Vector Database.",
      parameters: [
        {
          name: "toStore",
          type: "string",
          description: "The chunks of text to store.",
        },
        {
          name: "metadata",
          type: "any",
          description: "The metadata to store with the chunks.",
        },
      ],
      execute: async (parameters: Record<string, string>) => {
        console.log(
          "AGENT_FUNCTION: PINECONE_storeData",
          "toStore",
          parameters.toStore,
          "metadata",
          parameters.metadata,
          "namespace",
          parameters.namespace
        );
        const result = await PINECONE_storeData({
          toStore: [parameters.toStore],
          metadata: parameters.metadata,
          namespace: parameters.namespace,
        });
        return result!.toString();
      },
    },
    {
      name: "PINECONE_search",
      description: "Search for chunks of text in a Pinecone Vector Database.",
      parameters: [
        {
          name: "query",
          type: "string",
          description: "The query to search for.",
        },
        {
          name: "metadata",
          type: "any",
          description: "The metadata to search for.",
        },
        {
          name: "namespace",
          type: "string",
          description: "The namespace to search in.",
        },
        {
          name: "topK",
          type: "number",
          description: "The number of results to return.",
        },
      ],
      execute: async (parameters: Record<string, string>) => {
        console.log(
          "AGENT_FUNCTION: PINECONE_search",
          "query",
          parameters["query"],
          "metadata",
          parameters["metadata"],
          "namespace",
          parameters["namespace"],
          "topK",
          parameters["topK"]
        );
        const result = await PINECONE_search(
          parameters["query"],
          parameters["namespace"],
          parameters["metadata"],
          parseInt(parameters["topK"])
        );
        return result!;
        //return ""
      },
    },
    {
      name: "PINECONE_deleteVectorsById",
      description: "Delete vectors from the Lyrical database index by ID.",
      parameters: [
        {
          name: "ids",
          type: "string",
          description: "The IDs of the vectors to delete.",
        },
        {
          name: "namespace",
          type: "string",
          description: "The namespace to delete the vectors from.",
        },
      ],
      execute: async (parameters: Record<string, string>) => {
        const ids = parameters.ids.split(",");
        console.log(
          "AGENT_FUNCTION: PINECONE_deleteVectorsById",
          "ids",
          parameters.ids,
          "namespace",
          parameters.namespace
        );
        const result = await PINECONE_deleteVectorsById(
          ids,
          parameters.namespace
        );
        return "Vectors deleted successfully";
      },
    },
    {
      name: "PINECONE_createIndex",
      description: "Create a Pinecone index.",
      parameters: [
        {
          name: "name",
          type: "string",
          description: "The name of the index to create.",
        },
      ],
      execute: async (parameters: Record<string, string>) => {
        console.log("AGENT_FUNCTION: PINECONE_createIndex", parameters.name);
        await PINECONE_createIndex(parameters.name);
        return "Index created successfully";
      },
    },
    {
      name: "PINECONE_deleteIndex",
      description: "Delete a Pinecone index.",
      parameters: [
        {
          name: "name",
          type: "string",
          description: "The name of the index to delete.",
        },
      ],
      execute: async (parameters: Record<string, string>) => {
        console.log("AGENT_FUNCTION: PINECONE_deleteIndex", parameters.name);
        await PINECONE_deleteIndex(parameters.name);
        return "Index deleted successfully";
      },
    },
  ];
};

// Text splitter tools
export const AGENT_TOOLS_splitters = (state: AISessionState, textChatLogs: TextChatLogProps[]) => ({
  splitter: tool({
    description: `Split text into chunks.`,

    parameters: z.object({
      text: z.string().describe("The text to split."),
      chunkSize: z
        .number()
        .describe("The size of the chunks to split the text into."),
      chunkOverlap: z
        .number()
        .describe("The overlap of the chunks to split the text into."),
      output_name: z
        .string()
        .describe("name of the files outputted to local storage"),
    }),
    execute: async ({ text, chunkSize, chunkOverlap, output_name }) => {
      console.log(
        "AGENT_FUNCTION: TOOLFUNCTION_split_text",
        "text",
        text,
        "chunkSize",
        chunkSize,
        "chunkOverlap",
        chunkOverlap,
        "output_name",
        output_name
      );
      textChatLogs.push({
        role: "function",
        message: `Splitting text into chunks of size ${chunkSize} with overlap ${chunkOverlap} and output name ${output_name}`,
        agentName: "TOOLFUNCTION_split_text",
        timestamp: new Date(),
      });
      const chunks = await TOOLFUNCTION_split_text(text, chunkSize, chunkOverlap);
      await AGENT_GLOBAL_STATE_save(output_name, chunks, state);
    },
  }),
});

export const AGENT_TOOLS_knowledgeBase_query = (userId: string, agentName: string, teamName: string) => ({
  KNOWLEDGE_BASE_query: tool({
    description: `Query the knowledge base.`,
    parameters: z.object({
      query: z.string().describe("The query to search for."),
    }),
    execute: async ({ query }) => {
      logger.tool("Searching knowledge base", {
        action: "KB_QUERY",
        agent: agentName,
        team: teamName,
        query: query.substring(0, 50) + (query.length > 50 ? "..." : "")
      });

      const result = await SERVER_kbQuery(query, userId, agentName, teamName);
      
      logger.tool("Knowledge base search complete", {
        action: "KB_QUERY_COMPLETE",
        resultsCount: Array.isArray(result) ? result.length : 1
      });

      return result;
    },
  }),
});
