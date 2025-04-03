"use server";

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

import { Pinecone } from "@pinecone-database/pinecone";
import { Document, DocumentInterface } from "@langchain/core/documents";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PineconeStore } from "@langchain/pinecone";
import { ListItem } from "@pinecone-database/pinecone/dist/pinecone-generated-ts-fetch/data";
import { TOOLFUNCTION_split_text } from "../tools/splitters";

// Index documents and store chunks of text in a Pinecone Vector Database.
// TODO: Add more intelligent splitting using text or html splitting based on the type of document
export async function PINECONE_storeData({
  toStore,
  metadata,
  namespace,
}: {
  toStore: string[];
  metadata: any;
  namespace: string;
}) {
  console.log(
    "PINECONE_storeData",
    "toStore",
    toStore,
    "metadata",
    metadata,
    "namespace",
    namespace
  );
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
    fetchApi: fetch,
  });

  const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX!);

  // Process each document, splitting if necessary
  const processedDocs: Document[] = [];
  for (let i = 0; i < toStore.length; i++) {
    const text = toStore[i];
    // Generate a unique document ID for this text
    const documentId = `doc_${Date.now()}_${i}`;
    
    // If text is longer than ~2 paragraphs (roughly 1000 characters), split it
    if (text.length > 1000) {
      const chunks = await TOOLFUNCTION_split_text(text, 500, 50); // 500 chars per chunk with 50 char overlap
      // Add metadata to each chunk
      chunks.forEach((chunk, chunkIndex) => {
        processedDocs.push(
          new Document({
            pageContent: chunk.pageContent,
            metadata: {
              ...metadata, // Preserve original metadata
              documentId, // Add document ID to track related chunks
              chunkIndex, // Add chunk index
              totalChunks: chunks.length, // Total number of chunks
              isChunk: true, // Flag to identify this as a chunk
              originalLength: text.length // Length of original text
            }
          })
        );
      });
    } else {
      processedDocs.push(
        new Document({
          pageContent: text,
          metadata: {
            ...metadata,
            documentId,
            isChunk: false
          }
        })
      );
    }
  }

  await PineconeStore.fromDocuments(processedDocs, new OpenAIEmbeddings(), {
    pineconeIndex,
    maxConcurrency: 5, // Maximum number of batch requests to allow at once. Each batch is 1000 vectors.
    namespace: namespace,
  });

  return (await pineconeIndex.describeIndexStats()).namespaces;
}

// Delete all chunks and documents with a specific documentId
export async function PINECONE_deleteDocumentById(documentId: string, namespace: string) {
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
    fetchApi: fetch,
  });

  const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX!);
  const ns = pineconeIndex.namespace(namespace);

  try {
    // Delete all vectors with matching documentId
    await ns.deleteMany({
      filter: {
        documentId: documentId
      }
    });
  } catch (error) {
    console.error('Error deleting document and its chunks:', error);
    throw error;
  }
}

// Search for chunks of text in a Pinecone Vector Database.
export async function PINECONE_search(
  query: string,
  namespace: string,
  metadata?: any,
  topK?: number
) {
  if (typeof metadata === "string") {
    try {
      metadata = JSON.parse(metadata) || {};
    } catch (e) {
      //console.error("Error parsing metadata", e);
      metadata = {};
    }
  }
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
    fetchApi: fetch,
  });

  const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX!);

  // /**
  //  * Pinecone allows you to partition the records in an index into namespaces.
  //  * Queries and other operations are then limited to one namespace,
  //  * so different requests can search different subsets of your index.
  //  * Read more about namespaces here: https://docs.pinecone.io/guides/indexes/use-namespaces
  //  *
  //  * NOTE: If you have namespace enabled in your Pinecone index, you must provide the namespace when creating the PineconeStore.
  //  */

  const vectorStore = await PineconeStore.fromExistingIndex(
    new OpenAIEmbeddings(),
    { pineconeIndex, namespace: namespace }
  );

  /* Search the vector DB independently with metadata filters */
  const results = await vectorStore.similaritySearch(query, topK || 5, {
    filter: metadata || {},
  });
  console.log(results);

  // Return an array of strings
  return results.map((result: any) => result.pageContent).join("\n");
  //return [];
}
export async function PINECONE_query_docs(
  query: string,
  namespace: string,
  metadata?: any,
  topK?: number
): Promise<DocumentInterface<Record<string, any>>[]> {
  if (typeof metadata === "string") {
    try {
      metadata = JSON.parse(metadata) || {};
    } catch (e) {
      metadata = {};
    }
  }

  // Convert any timestamp filters to numbers
  if (metadata && metadata.timestamp) {
    if (metadata.timestamp.$gt) {
      metadata.timestamp.$gt = Number(metadata.timestamp.$gt);
    }
    if (metadata.timestamp.$lt) {
      metadata.timestamp.$lt = Number(metadata.timestamp.$lt);
    }
  }

  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
    fetchApi: fetch,
  });

  const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX!);

  const vectorStore = await PineconeStore.fromExistingIndex(
    new OpenAIEmbeddings(),
    { pineconeIndex, namespace: namespace }
  );

  const results = await vectorStore.similaritySearch(query, topK || 5, {
    filter: metadata || {},
  });

  return results;
}

// Create a Pinecone index.
export async function PINECONE_createIndex(name: string) {
  const pinecone = new Pinecone();

  const pineconeIndex = pinecone.Index(name);

  await pinecone.createIndex({
    dimension: 1536,
    metric: "cosine",
    name,
    spec: {
      serverless: { cloud: "aws", region: "us-east-1" },
    },
  });
  return pineconeIndex.describeIndexStats();
}

// Delete a Pinecone index.
export async function PINECONE_deleteIndex(name: string) {
  const pinecone = new Pinecone();

  await pinecone.deleteIndex(name);
}

// Delete Vectors from a Pinecone index by ID.
export async function PINECONE_deleteVectorsById(
  ids: string[],
  namespace: string
) {
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
    fetchApi: fetch,
  });

  const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX!);
  const ns = pineconeIndex.namespace(namespace);

  try {
    // Get all unique documentIds from the vectors we're trying to delete
    const vectorsToCheck = await ns.fetch(ids);
    const documentIdsToDelete = new Set<string>();
    const singleDocumentIds = new Set<string>();

    Object.entries(vectorsToCheck.records || {}).forEach(([id, vector]) => {
      const metadata = vector.metadata as Record<string, any>;
      if (metadata?.documentId) {
        if (metadata.isChunk) {
          documentIdsToDelete.add(metadata.documentId);
        } else {
          singleDocumentIds.add(id);
        }
      }
    });

    // Delete single documents first
    if (singleDocumentIds.size > 0) {
      const deletePromises = Array.from(singleDocumentIds).map(id => ns.deleteOne(id));
      await Promise.all(deletePromises);
    }

    // Handle chunked documents
    if (documentIdsToDelete.size > 0) {
      const allIds = await getAllVectorIds(ns);
      const batchSize = 100;
      
      // Process in batches to avoid memory issues
      for (let i = 0; i < allIds.length; i += batchSize) {
        const batchIds = allIds.slice(i, i + batchSize);
        const batchVectors = await ns.fetch(batchIds);
        
        const chunkIdsToDelete = Object.entries(batchVectors.records || {})
          .filter(([_, vector]) => {
            const metadata = vector.metadata as Record<string, any>;
            return metadata?.documentId && 
                   documentIdsToDelete.has(metadata.documentId) &&
                   metadata.isChunk; // Explicitly check for chunks
          })
          .map(([id]) => id);
        
        if (chunkIdsToDelete.length > 0) {
          // Delete chunks in smaller batches
          const deleteBatchSize = 20;
          for (let j = 0; j < chunkIdsToDelete.length; j += deleteBatchSize) {
            const deleteBatch = chunkIdsToDelete.slice(j, j + deleteBatchSize);
            await Promise.all(deleteBatch.map(id => ns.deleteOne(id)));
            
            // Add a small delay between batches
            if (j + deleteBatchSize < chunkIdsToDelete.length) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error deleting vectors by ID:', error);
    throw error;
  }
}

export async function PINECONE_deleteNamespace(namespace: string) {
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
    fetchApi: fetch,
  });
  const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX!);
  try {
    await pineconeIndex.namespace(namespace).deleteAll();
  } catch (error) {
    console.error('Error deleting namespace:', error);
    throw error;
  }
}

export async function PINECONE_listVectors(namespace: string) {
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
    fetchApi: fetch,
  });
  const index = pinecone.Index(process.env.PINECONE_INDEX!);
  const ns = index.namespace(namespace);
  const vectors = await ns.listPaginated();
  return vectors.vectors?.map((v: ListItem) => v.id || "") ?? [];
}

export async function PINECONE_fetchData(namespace: string) {
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
    fetchApi: fetch,
  });
  const index = pinecone.Index(process.env.PINECONE_INDEX!);
  const ns = index.namespace(namespace);
  
  try {
    // First check if the namespace exists and has any vectors
    const stats = await index.describeIndexStats();
    const namespaceStats = stats.namespaces?.[namespace];
    if (!namespaceStats || namespaceStats.recordCount === 0) {
      console.log('No vectors found in namespace stats');
      return { vectors: {} };
    }

    // Only if we have vectors, fetch them
    const ids = await PINECONE_listVectors(namespace);
    console.log('Found vector IDs:', ids);
    
    if (ids.length === 0) {
      console.log('No vector IDs found');
      return { vectors: {} };
    }

    console.log('Fetching vectors for IDs:', ids);
    try {
      const fetchResponse = await ns.fetch(ids);
      console.log('Raw fetch response:', fetchResponse);
      
      // Transform the records into the expected format
      const transformedVectors = Object.entries(fetchResponse.records || {}).reduce((acc, [id, record]) => {
        acc[id] = {
          id,
          values: record.values,
          metadata: record.metadata,
        };
        return acc;
      }, {} as Record<string, any>);

      console.log('Transformed vectors:', {
        count: Object.keys(transformedVectors).length,
        sampleId: Object.keys(transformedVectors)[0],
        sampleData: transformedVectors[Object.keys(transformedVectors)[0]]
      });

      return { vectors: transformedVectors };
    } catch (fetchError) {
      console.error('Error during vector fetch:', fetchError);
      throw fetchError;
    }
  } catch (error) {
    console.error('Error fetching Pinecone data:', error);
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack
      });
    }
    return { vectors: {} };
  }
}

// export async function PINECONE_queryData(namespace: string, query: string) {
//   const pinecone = new Pinecone({
//     apiKey: process.env.PINECONE_API_KEY!,
//     fetchApi: fetch,
//   });
//   const index = pinecone.Index(process.env.PINECONE_INDEX!);
//   const ns = index.namespace(namespace);
//   const vectors = await ns.query({ vector: query });
//   return vectors;
// }

// Delete Vectors from a Pinecone index by metadata.
export async function PINECONE_deleteVectorsByMetadata(
  metadata: any,
  namespace: string
) {
  const pinecone = new Pinecone();

  const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX!);
}

// Upsert a vector to a Pinecone index.
export async function PINECONE_upsertAsVector(doc: string, namespace: string) {
  console.log("PINECONE_upsertAsVector");

  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
    fetchApi: fetch,
  });

  const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX!);

  const ns = pineconeIndex.namespace(namespace);

  const embeddings = new OpenAIEmbeddings();
  const vector = await embeddings.embedQuery(doc);

  await ns.upsert([
    {
      id: new Date().getTime().toString(),
      values: vector,
      metadata: {},
    },
  ]);

  return { response: "true" };
}

export async function PINECONE_deleteDocumentsByIds(documentIds: string[], namespace: string) {
  const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY!,
    fetchApi: fetch,
  });

  const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX!);
  const ns = pineconeIndex.namespace(namespace);

  try {
    // Get all vector IDs in batches using pagination
    const allIds = await getAllVectorIds(ns);
    
    if (allIds.length === 0) return;

    // Fetch vectors in batches to check their metadata
    const batchSize = 100; // Pinecone's fetch limit
    const vectorsToDelete: string[] = [];

    for (let i = 0; i < allIds.length; i += batchSize) {
      const batchIds = allIds.slice(i, i + batchSize);
      const batchVectors = await ns.fetch(batchIds);
      
      // Filter vectors that match any of the documentIds
      Object.entries(batchVectors.records || {}).forEach(([id, vector]) => {
        const metadata = vector.metadata as Record<string, any>;
        if (metadata?.documentId && documentIds.includes(metadata.documentId)) {
          vectorsToDelete.push(id);
        }
      });
    }

    // Delete matching vectors in batches
    const deleteBatchSize = 20;
    for (let i = 0; i < vectorsToDelete.length; i += deleteBatchSize) {
      const batch = vectorsToDelete.slice(i, i + deleteBatchSize);
      for (const id of batch) {
        try {
          await ns.deleteOne(id);
        } catch (error) {
          console.error(`Error deleting vector ${id}:`, error);
        }
      }
      
      // Optional: Add a small delay between batches to avoid rate limiting
      if (i + deleteBatchSize < vectorsToDelete.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`Deleted ${vectorsToDelete.length} vectors for ${documentIds.length} documents`);
  } catch (error) {
    console.error('Error deleting documents and their chunks:', error);
    throw error;
  }
}

// Helper function to get all vector IDs with pagination
async function getAllVectorIds(ns: any) {
  let allIds: string[] = [];
  let paginationToken: string | undefined;

  do {
    const listResponse = await ns.listPaginated({ 
      limit: 100,
      paginationToken 
    });

    const pageVectors = listResponse.vectors || [];
    const pageIds = pageVectors.map((v: any) => v.id).filter((id: any) => id !== undefined);
    allIds = allIds.concat(pageIds);

    paginationToken = listResponse.paginationToken;
  } while (paginationToken);

  return allIds;
}
