import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "@langchain/openai";
import { logger } from "@/src/lib/logger";

declare global {
    var vectorstore_client: MemoryVectorStore | undefined
}

const _getVectorStoreClient = async () => {
    try {
        return await MemoryVectorStore.fromDocuments([], new OpenAIEmbeddings());
    } catch (error) {
        logger.error("Error creating vector store client:", { error: (error as Error).message });
        throw error;
    }
}

export const GLOBAL_getVectorStoreClient = async (): Promise<MemoryVectorStore> => {
    logger.debug("GLOBAL_getVectorStoreClient called");
    
    try {
        // Check if existing client is still valid
        if (globalThis.vectorstore_client) {
            try {
                // Test if the vector store is still responsive by attempting a simple similarity search
                await globalThis.vectorstore_client.similaritySearch("test", 1);
                logger.debug("Using existing vector store client");
                return globalThis.vectorstore_client;
            } catch (error) {
                logger.warn("Existing vector store client invalid, creating new one");
                globalThis.vectorstore_client = undefined;
            }
        }

        // Create new client if needed
        const newClient = await _getVectorStoreClient();
        
        globalThis.vectorstore_client = newClient;
        logger.debug("Created new vector store client");
        return newClient;

    } catch (error) {
        logger.error("Error in GLOBAL_getVectorStoreClient:", { error: (error as Error).message });
        throw error;
    }
} 