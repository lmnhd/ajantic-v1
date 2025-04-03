import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { PineconeStore } from "@langchain/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Pinecone as PineconeClient } from "@pinecone-database/pinecone";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { Document } from "@langchain/core/documents";
import type { AttributeInfo } from "langchain/chains/query_constructor";
import { tool } from "ai";
import { z } from "zod";
import { VectorStoreRetriever } from "@langchain/core/vectorstores";
import { MozillaReadabilityTransformer } from "@langchain/community/document_transformers/mozilla_readability";
import { HtmlToTextTransformer } from "@langchain/community/document_transformers/html_to_text";
import { htmlToText } from "html-to-text";
import { logger } from '@/src/lib/logger';

//let _store: VectorStoreRetriever;

export const AGENT_TOOLS_queryHTML = (vc: MemoryVectorStore) =>
  tool({
    description: "Query the HTML content as a vector store",
    parameters: z.object({
      query: z
        .string()
        .describe("The query to search the HTML vector store with"),
    }),
    execute: async ({ query }) => {
      logger.tool("HTML Query Tool - Starting", { query });
      let result = "";
      
      try {
        if (!vc) {
          logger.tool("HTML Query Tool - No Vector Store", {
            message: "Content was delivered without vectorizing"
          });
          result = "Content was delivered without vectorizing. Use that content.";
        } else {
          result = await TOOLFUNCTION_queryHTML({ query }, vc);
          logger.tool("HTML Query Tool - Query Complete", {
            resultLength: result.length
          });
        }
        return result;
      } catch (error) {
        logger.tool("HTML Query Tool - Error", {
          error: (error as Error).message
        });
        result = "Error querying the HTML vector store: " + error;
        return result;
      }
    },
  });

export const TOOLFUNCTION_queryHTML = async (
  params: {
    query: string;
  },
  _store: MemoryVectorStore
): Promise<string> => {
  logger.tool("HTML Query Function - Starting", { query: params.query });
  
  try {
    const results = await _store.similaritySearch(params.query, 10);
    logger.tool("HTML Query Function - Search Complete", {
      resultsCount: results.length
    });
    return results.map((doc: Document) => doc.pageContent).join("\n");
  } catch (error) {
    logger.tool("HTML Query Function - Error", {
      error: (error as Error).message
    });
    throw error;
  }
};

export const TOOLFUNCTION_htmlToVectorStore = async (
  params: {
    html: string;
    metaData: any;
  },
  vc: MemoryVectorStore
) => {
  logger.tool("HTML Vectorizer - Starting", {
    htmlLength: params.html.length,
    hasMetadata: !!params.metaData
  });

  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 240,
    chunkOverlap: 20,
  });

  try {
    logger.tool("HTML Vectorizer - Splitting Text");
    const htmlDocs = await textSplitter.invoke([
      {
        pageContent: params.html,
        metadata: params.metaData,
      },
    ]);
    
    logger.tool("HTML Vectorizer - Text Split Complete", {
      chunkCount: htmlDocs.length
    });

    await vc.addDocuments(htmlDocs);
    logger.tool("HTML Vectorizer - Documents Added", {
      documentCount: htmlDocs.length
    });

    return vc;
  } catch (error) {
    logger.tool("HTML Vectorizer - Error", {
      error: (error as Error).message
    });
    throw error;
  }
};
