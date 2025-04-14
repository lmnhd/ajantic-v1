import { generateObject, generateText } from "ai";
import { AGENT_TOOLS_perplexity2 } from "@/src/lib/agent-tools/perplexity2";
import { PINECONE_deleteDocumentsByIds, PINECONE_storeData } from "../pinecone";
import { MODEL_getModel_ai } from "@/src/lib/vercelAI-model-switcher";
import { OpenAIModelNames } from "../model/openai";
import { ModelProviderEnum } from "@/src/lib/types";
import { z } from "zod";
import { logger } from "@/src/lib/logger";
import { MODEL_CONFIG } from "@/src/lib/models/model-config";
import { UTILS_getModelArgsByName, UTILS_getModelsJSON } from "@/src/lib/utils";
import { PERPLEXITY_getResponse } from "@/src/lib/agent-tools/perplexity";

interface ResearchResult {
  title: string;
  content: string;
  source?: string;
  category: string;
  importance: number; // 1-10 scale
}

export async function KB_autoCreate(
  userId: string,
  agentName: string,
  responsibilities: string[],
  agentTitle: string,
  agentRole: string,
  teamObjectives: string
) {
  try {
    logger.log("Starting knowledge base creation process");
    
    // Generate research queries based on responsibilities
    logger.tool("Generating research queries", {
      responsibilitiesCount: responsibilities?.length || 0,
      hasAgentTitle: !!agentTitle,
      hasAgentRole: !!agentRole,
      hasTeamObjectives: !!teamObjectives
    });
    const researchQueries = await generateResearchQueries(responsibilities, agentTitle, agentRole, teamObjectives);
    logger.debug("Generated research queries:", researchQueries);
    
    // Gather research for each query using perplexity
    const researchResults: ResearchResult[] = [];
    logger.log("Starting research gathering for queries");
    
    for (const query of researchQueries) {
      logger.tool("Gathering research for query", { query });
      const research = await gatherResearch(query);
      logger.debug("Research results for query:", { query, resultCount: research.length });
      researchResults.push(...research);
    }

    // Structure and categorize the research data
    logger.tool("Structuring research data", { totalResults: researchResults.length });
    const structuredData = await structureResearchData(researchResults);
    logger.debug("Structured research data:", structuredData);

    // Save to Pinecone knowledge base
    const namespace = `agent-kb-${userId}-${agentName}`;
    logger.tool("Saving to knowledge base", { 
      namespace,
      structuredDataLength: structuredData.length 
    });
    
    await saveToKnowledgeBase(structuredData, namespace, userId, agentName);
    logger.log("Successfully saved to knowledge base");

    return {
      success: true,
      message: "Knowledge base created successfully",
      namespace
    };

  } catch (error) {
    logger.debug("Error in knowledge base creation:", {error});
    throw error;
  }
}

async function generateResearchQueries(responsibilities: string[], agentTitle: string, agentRole: string, teamObjectives: string): Promise<string[]> {
  // if responsibilities array is less than 3, generate responsibilities
  if (responsibilities.length < 3) {
    responsibilities = await generateResponsibilities(agentTitle, agentRole, teamObjectives, responsibilities);
  }

  const prompt = `Given these job responsibilities, generate specific research queries to gather comprehensive knowledge:
  ${responsibilities.join("\n")}
  
  Generate queries that will help gather:
  1. Core knowledge and fundamentals
  2. Best practices and methodologies
  3. Common challenges and solutions
  4. Latest developments and trends
  5. Important tools and technologies
  
  Format each query to get detailed, factual information.
  
  IMPORTANT: Limit your response to a MAXIMUM of 3 queries total. Focus only on the most critical knowledge areas.`;

  const response = await generateObject({
    model: await MODEL_getModel_ai(MODEL_CONFIG.KNOWLEDGE_BASE),
    system: "You are a research planning expert. Generate specific, targeted research queries. Be highly selective and prioritize only the most essential topics.",
    prompt,
    schema: z.object({
        queries: z.array(z.string()).max(3)
    })
  });

  // Ensure we never have more than 3 queries regardless of model output
  return response.object.queries.slice(0, 3);
}

async function gatherResearch(query: string): Promise<ResearchResult[]> {
  // Use perplexity to get detailed research
  const research = await PERPLEXITY_getResponse(query, "sonar-deep-research");
  
  // Structure the raw research into categorized results
  const structuredResults = await generateObject({
    model: await MODEL_getModel_ai(MODEL_CONFIG.KNOWLEDGE_BASE),
    system: "You are a research analyst. Structure the provided research into clear, categorized sections.",
    prompt: `Structure this research into distinct sections with titles and content:
    ${research}`,
    schema: z.object({
        results: z.array(z.object({
            title: z.string(),
            content: z.string(),
            category: z.string(),
            importance: z.number().min(1).max(10)
        }))
    })
  });

  return structuredResults.object.results;
}

async function structureResearchData(results: ResearchResult[]): Promise<ResearchResult[]> {
  // Additional processing and organization of research data
  const structuredData = await generateObject({
    model: await MODEL_getModel_ai(MODEL_CONFIG.SCRIPT_EVALUATOR),
    system: "You are a knowledge organization expert. Review and optimize the research data structure.",
    prompt: `Review and optimize this research data for a knowledge base:
    ${JSON.stringify(results, null, 2)}
    
    Ensure:
    1. Clear categorization
    2. No duplicate information
    3. Proper importance ranking
    4. Logical grouping`,
    schema: z.object({
        optimizedResults: z.array(z.object({
          title: z.string(),
          content: z.string(),
          category: z.string(),
          importance: z.number().min(1).max(10)
        }))
    })
  });

  return structuredData.object.optimizedResults;
}

async function saveToKnowledgeBase(
  data: ResearchResult[], 
  namespace: string,
  userId: string,
  agentName: string
) {
  // Prepare data for Pinecone storage
  const toStore = data.map(result => result.content);

  // Store each piece of research with its metadata
  for (let i = 0; i < data.length; i++) {
    const result = data[i];
    const documentId = `research-${Date.now()}-${i}`;
    const groupId = `research-group-${Date.now()}`;

    await PINECONE_storeData({
      toStore: [result.content],
      metadata: {
        title: result.title,
        category: result.category,
        importance: result.importance,
        source: result.source || 'perplexity-research',
        documentId: documentId,
        groupId: groupId,
        type: 'auto-generated',
        timestamp: Date.now(),
        agentId: agentName,
        userId,
        implementation: 'perplexity',
        isMultiPage: data.length > 1,
        totalPages: data.length,
        grade: 'A', // Perplexity research is considered high quality
        gradeExplanation: 'Auto-generated research using Perplexity API'
      },
      namespace
    });
  }
}

async function generateResponsibilities(agentTitle: string, agentRole: string, teamObjectives: string, currentResponsibilities: string[]) {
  const prompt = `Given the following agent title, role, and team objectives, generate a list of responsibilities for the agent that are not already listed as current responsibilities:
  ${agentTitle}
  ${agentRole}
  ${teamObjectives}
  
  Current responsibilities:
  ${currentResponsibilities.join("\n")}`;

  const response = await generateObject({
    model: await MODEL_getModel_ai(MODEL_CONFIG.KNOWLEDGE_BASE),
    messages: [
      { role: "system", content: "You are a research planning expert. Generate specific, targeted research queries." },
      { role: "user", content: prompt }
    ],
    schema: z.object({
      responsibilities: z.array(z.string())
    })
  });

  return response.object.responsibilities;
}

/**
 * Delete a specific research entry from the knowledge base
 * @param documentId The ID of the document to delete
 * @param namespace The namespace of the knowledge base
 * @returns Promise<boolean> True if deletion was successful
 */
export async function deleteResearchEntry(documentId: string, namespace: string): Promise<boolean> {
  try {
    await PINECONE_deleteDocumentsByIds([documentId], namespace);
    return true;
  } catch (error) {
    console.error("Error deleting research entry:", error);
    return false;
  }
}

/**
 * Delete multiple research entries from the knowledge base
 * @param documentIds Array of document IDs to delete
 * @param namespace The namespace of the knowledge base
 * @returns Promise<boolean> True if deletion was successful
 */
export async function deleteResearchEntries(documentIds: string[], namespace: string): Promise<boolean> {
  try {
    await PINECONE_deleteDocumentsByIds(documentIds, namespace);
    return true;
  } catch (error) {
    console.error("Error deleting research entries:", error);
    return false;
  }
}

// DO NOT DELETE THIS COMMENT
//stays up to date with the latest AI agent and Framework advancements
//general office team lead duties
