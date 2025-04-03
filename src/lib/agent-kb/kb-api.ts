"use server"


import { PINECONE_storeData, PINECONE_query_docs, PINECONE_deleteNamespace, PINECONE_fetchData, PINECONE_deleteVectorsById } from '@/src/app/api/pinecone';
import { KnowledgeBaseEntry } from './types';

export async function addToKnowledgeBase(content: string, metadata: KnowledgeBaseEntry['metadata'], namespace: string) {
  try {
    await PINECONE_storeData({
      toStore: [content],
      metadata,
      namespace
    });
    return true;
  } catch (error) {
    console.error('Error adding to knowledge base:', error);
    return false;
  }
}

export async function queryKnowledgeBase(query: string, namespace: string, metadata?: any) {
  try {
    const results = await PINECONE_query_docs(query, namespace, metadata);
    return results;
  } catch (error) {
    console.error('Error querying knowledge base:', error);
    return [];
  }
}



export async function deleteKnowledgeBaseEntry(namespace: string, id: string) {
  try {
    await PINECONE_deleteVectorsById([id], namespace);
    return true;
  } catch (error) {
    console.error('Error deleting knowledge base entry:', error);
    return false;
  }
}

export async function clearKnowledgeBase(namespace: string) {
  try {
    await PINECONE_deleteNamespace(namespace);
    return true;
  } catch (error) {
    console.error('Error clearing knowledge base:', error);
    return false;
  }
} 