import { PINECONE_fetchData } from "../../pinecone";

export async function fetchKnowledgeBaseEntries(namespace: string) {
    console.log("fetchKnowledgeBaseEntries called...");
    try {
      console.log("Attempting to fetch data from namespace:", namespace);
      const data = await PINECONE_fetchData(namespace) as any;
      console.log("Received data:", data ? "success" : "null");
      
      if (!data?.vectors || Object.keys(data.vectors).length === 0) {
        console.log("No vectors found in namespace");
        return [];
      }
      
      const entries = Object.entries(data.vectors).map(([id, vector]: [string, any]) => ({
        id,
        content: vector.metadata?.content || '',
        metadata: {
          source: vector.metadata?.source || '',
          type: vector.metadata?.type || 'file',
          timestamp: vector.metadata?.timestamp || Date.now(),
          agentId: vector.metadata?.agentId,
          userId: vector.metadata?.userId,
          documentId: vector.metadata?.implementation === 'perplexity' 
            ? `${vector.metadata?.category || 'uncategorized'}-${vector.metadata?.title || id}`
            : vector.metadata?.documentId,
          groupId: vector.metadata?.implementation === 'perplexity'
            ? `${vector.metadata?.category || 'uncategorized'}`
            : vector.metadata?.groupId,
          implementation: vector.metadata?.implementation,
          isMultiPage: vector.metadata?.isMultiPage,
          totalPages: vector.metadata?.totalPages,
          chunkIndex: vector.metadata?.chunkIndex,
          totalChunks: vector.metadata?.totalChunks,
          isChunk: vector.metadata?.isChunk,
          text: vector.metadata?.text,
          grade: vector.metadata?.grade,
          title: vector.metadata?.title || '',
          category: vector.metadata?.category || '',
        }
      }));

      // Keep only the first chunk (index 0) of each documentId
      const documentMap = new Map();
      entries.forEach(entry => {
        const documentId = entry.metadata.documentId || entry.id;
        if (!documentMap.has(documentId) || entry.metadata.chunkIndex === 0) {
          documentMap.set(documentId, entry);
        }
      });
      
      return Array.from(documentMap.values());
    } catch (error) {
      console.error('Error fetching knowledge base entries:', error);
      return [];
    }
  }