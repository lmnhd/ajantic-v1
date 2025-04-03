import { z } from "zod";
import { tool } from "ai";
import { TextChatLogProps } from "@/src/lib/text-chat-log";
import { logger } from '@/src/lib/logger';
import { 
  addToKnowledgeBase, 
  queryKnowledgeBase, 
  deleteKnowledgeBaseEntry, 
  clearKnowledgeBase 
} from "@/src/lib/agent-kb/kb-api";
import { KnowledgeBaseEntry } from "@/src/lib/agent-kb/types";
import { DocumentInterface } from "@langchain/core/documents";

export const AGENT_TOOLS_knowledgeBase = (userId: string, agentName: string, textChatLogs: TextChatLogProps[]) => {
  // Create a namespace specific to this agent for isolation
  const namespace = `kb_${userId}_${agentName}`;
  
  return {
    storeKnowledge: tool({
      description: "Store information in the agent's knowledge base for later retrieval",
      parameters: z.object({
        content: z.string().describe("The content to store in the knowledge base"),
        tags: z.array(z.string()).optional().describe("Optional tags to categorize the content"),
        title: z.string().optional().describe("Optional title for the knowledge entry"),
      }),
      execute: async ({ content, tags = [], title = "" }) => {
        logger.tool("Knowledge Base Tool - Storing Content", { 
          agent: agentName,
          contentLength: content.length,
          tags,
          title
        });
        
        textChatLogs.push({
          role: "function",
          message: `Storing knowledge: ${title || content.substring(0, 50) + (content.length > 50 ? "..." : "")}`,
          agentName: "KNOWLEDGE_BASE_store",
          timestamp: new Date(),
        });
        
        try {
          const metadata: KnowledgeBaseEntry['metadata'] = {
            source: "KNOWLEDGE_BASE_store",
            type: "text",
            timestamp: new Date().getTime(),
            grade: "A",
          };
          
          const success = await addToKnowledgeBase(content, metadata, namespace);
          logger.tool("Knowledge Base Tool - Storage Complete", { 
            agent: agentName,
            success 
          });
          
          if (success) {
            return JSON.stringify({
              success: true,
              message: "Content successfully stored in knowledge base",
              metadata: { title, tags }
            });
          } else {
            return JSON.stringify({
              success: false,
              message: "Failed to store content in knowledge base"
            });
          }
        } catch (error) {
          logger.error("Knowledge Base Tool - Storage Error", {
            agent: agentName,
            error: error instanceof Error ? error.message : String(error)
          });
          
          return JSON.stringify({
            success: false,
            message: "Error storing content in knowledge base",
            error: error instanceof Error ? error.message : "Unknown error"
          });
        }
      },
    }),
    
    queryKnowledge: tool({
      description: "Query the agent's knowledge base to retrieve relevant information",
      parameters: z.object({
        query: z.string().describe("The query to search for in the knowledge base"),
        tags: z.array(z.string()).optional().describe("Optional tags to filter the search results"),
        limit: z.number().optional().default(5).describe("Maximum number of results to return"),
      }),
      execute: async ({ query, tags = [], limit = 5 }) => {
        logger.tool("Knowledge Base Tool - Querying", { 
          agent: agentName,
          query: query.substring(0, 50) + (query.length > 50 ? "..." : ""),
          tags,
          limit
        });
        
        textChatLogs.push({
          role: "function",
          message: `Querying knowledge base for: "${query}"`,
          agentName: "KNOWLEDGE_BASE_query",
          timestamp: new Date(),
        });
        
        try {
          const metadata = tags.length > 0 ? { tags: { $in: tags } } : undefined;
          const results = await queryKnowledgeBase(query, namespace, metadata);
          
          // Limit results if needed
          const limitedResults = results.slice(0, limit);
          
          logger.tool("Knowledge Base Tool - Query Complete", { 
            agent: agentName,
            resultsCount: limitedResults.length 
          });
          
          return JSON.stringify({
            success: true,
            count: limitedResults.length,
            results: limitedResults.map((result: DocumentInterface<Record<string, any>>) => ({
              content: result.pageContent,
              metadata: result.metadata,
              score: 1.0, // Default score since it might not be available directly
            }))
          });
        } catch (error) {
          logger.error("Knowledge Base Tool - Query Error", {
            agent: agentName,
            query,
            error: error instanceof Error ? error.message : String(error)
          });
          
          return JSON.stringify({
            success: false,
            message: "Error querying knowledge base",
            error: error instanceof Error ? error.message : "Unknown error"
          });
        }
      },
    }),
    
    deleteKnowledge: tool({
      description: "Delete a specific entry from the agent's knowledge base",
      parameters: z.object({
        id: z.string().describe("The ID of the knowledge entry to delete"),
      }),
      execute: async ({ id }) => {
        logger.tool("Knowledge Base Tool - Deleting Entry", { 
          agent: agentName,
          entryId: id 
        });
        
        textChatLogs.push({
          role: "function",
          message: `Deleting knowledge entry with ID: ${id}`,
          agentName: "KNOWLEDGE_BASE_delete",
          timestamp: new Date(),
        });
        
        try {
          const success = await deleteKnowledgeBaseEntry(namespace, id);
          
          logger.tool("Knowledge Base Tool - Deletion Complete", { 
            agent: agentName,
            success 
          });
          
          return JSON.stringify({
            success,
            message: success 
              ? "Knowledge entry successfully deleted" 
              : "Failed to delete knowledge entry"
          });
        } catch (error) {
          logger.error("Knowledge Base Tool - Deletion Error", {
            agent: agentName,
            entryId: id,
            error: error instanceof Error ? error.message : String(error)
          });
          
          return JSON.stringify({
            success: false,
            message: "Error deleting knowledge entry",
            error: error instanceof Error ? error.message : "Unknown error"
          });
        }
      },
    }),
    
    clearKnowledge: tool({
      description: "Clear all entries from the agent's knowledge base",
      parameters: z.object({}),
      execute: async () => {
        logger.tool("Knowledge Base Tool - Clearing All Knowledge", { 
          agent: agentName,
          namespace
        });
        
        textChatLogs.push({
          role: "function",
          message: "Clearing all knowledge base entries",
          agentName: "KNOWLEDGE_BASE_clear",
          timestamp: new Date(),
        });
        
        try {
          const success = await clearKnowledgeBase(namespace);
          
          logger.tool("Knowledge Base Tool - Clear Complete", { 
            agent: agentName,
            success 
          });
          
          return JSON.stringify({
            success,
            message: success 
              ? "Knowledge base successfully cleared" 
              : "Failed to clear knowledge base"
          });
        } catch (error) {
          logger.error("Knowledge Base Tool - Clear Error", {
            agent: agentName,
            error: error instanceof Error ? error.message : String(error)
          });
          
          return JSON.stringify({
            success: false,
            message: "Error clearing knowledge base",
            error: error instanceof Error ? error.message : "Unknown error"
          });
        }
      },
    }),
  };
};

export const AGENT_TOOLS_DIRECTIVE_KNOWLEDGE_BASE = () => {
  return `
<INSTRUCTIONS>
  <PURPOSE>
    The Knowledge Base tool allows you to persistently store and retrieve information that will be useful for your tasks.
    Unlike temporary memory, knowledge base entries will be available across multiple conversations.
  </PURPOSE>

  <TOOLS>
    <TOOL name="storeKnowledge">
      <DESCRIPTION>Store information in your knowledge base for later retrieval.</DESCRIPTION>
      <USAGE>
        - Use for important facts, insights, or information you want to remember
        - Add descriptive tags to help with categorization and searching
        - Include a clear title for easier identification
      </USAGE>
    </TOOL>

    <TOOL name="queryKnowledge">
      <DESCRIPTION>Search your knowledge base for relevant information.</DESCRIPTION>
      <USAGE>
        - Provide specific search terms for better results
        - Use tags to filter results by category
        - Results are returned in order of relevance
      </USAGE>
    </TOOL>

    <TOOL name="deleteKnowledge">
      <DESCRIPTION>Remove a specific entry from your knowledge base.</DESCRIPTION>
      <USAGE>
        - Only use when information is outdated or incorrect
        - Requires the specific ID of the entry to delete
      </USAGE>
    </TOOL>

    <TOOL name="clearKnowledge">
      <DESCRIPTION>Delete all entries from your knowledge base.</DESCRIPTION>
      <USAGE>
        - Use with extreme caution
        - Only when a complete reset is necessary
      </USAGE>
    </TOOL>
  </TOOLS>

  <BEST_PRACTICES>
    - Store information with specific, descriptive tags for easier retrieval
    - Regularly update your knowledge base with new insights
    - Be selective about what you store to maintain quality and relevance
    - Use the knowledge base to build contextual understanding over time
  </BEST_PRACTICES>
</INSTRUCTIONS>
  `;
};
