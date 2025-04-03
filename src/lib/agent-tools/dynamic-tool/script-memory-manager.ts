import { Pinecone } from "@pinecone-database/pinecone";
import { PINECONE_storeData, PINECONE_query_docs } from "@/src/app/api/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";

import { TOOLFUNCTION_SCRIPT_EXECUTOR } from "./dynamic-action-core";
import { MEMORY_NAMESPACE, SAVED_SCRIPTS_NAMESPACE } from "./dynamic-tool-typs";

/**
 * Manages script memory for dynamic tools
 */
export class ScriptMemoryManager {
  private pinecone: Pinecone;
  private embeddings: OpenAIEmbeddings;
  private memory: Map<string, any>;

  constructor() {
    this.pinecone = new Pinecone();
    this.embeddings = new OpenAIEmbeddings({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.memory = new Map();
    this.memory.set(MEMORY_NAMESPACE, []);
    this.memory.set(SAVED_SCRIPTS_NAMESPACE, []);
  }

  async findSimilarScript(prompt: string, similarityThreshold = 0.85) {
    const promptEmbedding = await this.embeddings.embedQuery(prompt);
    const index = this.pinecone.Index(process.env.PINECONE_INDEX!);

    const queryResponse = await index.query({
      vector: promptEmbedding,
      topK: 3,
      includeMetadata: true,
      filter: {
        success: true,
        timestamp: { $gt: Date.now() - 30 * 24 * 60 * 60 * 1000 },
      },
    });

    for (const match of queryResponse.matches || []) {
      if (match?.score && match.score > similarityThreshold) {
        const execResult = await TOOLFUNCTION_SCRIPT_EXECUTOR(
          match.metadata?.script as string,
          match.metadata?.parameters
        );

        // Integrated tracking
        await PINECONE_storeData({
          toStore: [prompt],
          metadata: {
            type: "script_reuse_metric",
            originalPrompt: prompt,
            matchedScript: match.metadata?.script,
            score: match.score,
            success: execResult.success,
            timestamp: Date.now(),
          },
          namespace: "SCRIPT_REUSE_METRICS",
        });

        if (execResult.success) {
          return {
            script: match.metadata?.script as string,
            parameters: match.metadata?.parameters,
            description: match.metadata?.description as string,
          };
        }
      }
    }
    return null;
  }

  async storeScript(prompt: string, scriptData: any, success: boolean) {
    //const promptEmbedding = await this.embeddings.embedQuery(prompt);
    await PINECONE_storeData({
      toStore: [prompt],
      metadata: {
        ...scriptData,
        success,
        timestamp: Date.now(),
      },
      namespace: success ? "SAVED_SCRIPTS" : "MEMORY_SCRIPTS",
    });
  }

  /**
   * Add an item to the specified namespace
   */
  addToMemory(namespace: string, item: any) {
    const items = this.memory.get(namespace) || [];
    items.push(item);
    this.memory.set(namespace, items);
  }

  /**
   * Get all items from the specified namespace
   */
  getFromMemory(namespace: string) {
    return this.memory.get(namespace) || [];
  }

  /**
   * Save a script for later execution
   */
  saveScript(name: string, script: string, meta1?: string, meta2?: string) {
    const scripts = this.memory.get(SAVED_SCRIPTS_NAMESPACE) || [];
    scripts.push({
      name,
      script,
      meta1: meta1 || "",
      meta2: meta2 || "",
      createdAt: new Date().toISOString(),
    });
    this.memory.set(SAVED_SCRIPTS_NAMESPACE, scripts);
  }

  /**
   * Get all saved scripts
   */
  getSavedScripts() {
    return this.memory.get(SAVED_SCRIPTS_NAMESPACE) || [];
  }
}
