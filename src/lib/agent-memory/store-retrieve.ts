"use server";
import {
  PINECONE_storeData,
  PINECONE_query_docs,
  PINECONE_search,
} from "@/src/app/api/pinecone";
import {
  AgentComponentProps,
  ServerMessage,
  AgentTypeEnum,
  ModelProviderEnum,
  AgentType,
} from "@/src/lib/types";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import { MODEL_getModel_ai } from "../vercelAI-model-switcher";
import { OpenAIModelNames } from "@/src/app/api/model/openai";
import { DYNAMIC_NAMES } from "../dynamic-names";
import { logger } from "@/src/lib/logger";
import { authConfig } from "@/src/config/auth";
import {
  UTILS_cleanNewlines,
  UTILS_getModelArgsByName,
  UTILS_getModelsJSON,
} from "@/src/lib/utils";
import { SERVER_getGeneralPurposeDataMany } from "@/src/lib/server-actions";
import { GeneralPurpose } from "@prisma/client";
// Helper function to call Mistral API
export async function callMistral(prompt: string): Promise<string> {
  const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${MISTRAL_API_KEY}`,
    },
    body: JSON.stringify({
      model: "mistral-tiny",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 300,
    }),
  });

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

async function generateSummary(messages: ServerMessage[]): Promise<string> {
  // Combine messages into a single text
  const text = messages
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n");

  const prompt = `Please provide a concise summary (max 2-3 sentences) of the following conversation:\n\n${text}`;

  try {
    return await callMistral(prompt);
  } catch (error) {
    console.error("Error generating summary with Mistral:", error);
    // Fallback to simple truncation if Mistral fails
    return text.slice(0, 200) + "...";
  }
}

async function generateKeywords(messages: ServerMessage[]): Promise<string[]> {
  const text = messages.map((message) => message.content).join(" ");

  const prompt = `Extract 5-10 most important keywords or key phrases from this text. Return only the keywords separated by commas, no explanations:\n\n${text}`;

  try {
    const response = await callMistral(prompt);
    return response.split(",").map((keyword) => keyword.trim());
  } catch (error) {
    console.error("Error generating keywords with Mistral:", error);
    // Fallback to simple keyword extraction
    const commonWords = new Set([
      "the",
      "be",
      "to",
      "of",
      "and",
      "a",
      "in",
      "that",
      "have",
      "i",
      "it",
      "for",
      "not",
      "on",
      "with",
      "he",
      "as",
      "you",
      "do",
      "at",
    ]);
    const words = text
      .toLowerCase()
      .split(/\W+/)
      .filter((word) => word.length > 2 && !commonWords.has(word));
    const uniqueWords = Array.from(new Set(words));
    return uniqueWords.slice(0, 10);
  }
}

async function checkAndRemoveRedundancy(
  content: string,
  keywords: string[],
  namespace: string
): Promise<{ isRedundant: boolean; modifiedContent: string }> {
  // Search for similar content using keywords
  const similarDocs = await PINECONE_query_docs(
    keywords.join(" "),
    namespace,
    {},
    3
  );

  if (!similarDocs || similarDocs.length === 0) {
    return { isRedundant: false, modifiedContent: content };
  }

  const outputSchema = z.object({
    isRedundant: z.boolean(),
    modifiedContent: z.string(),
    explanation: z.string(),
  });

  const prompt = `
  Compare the new content with existing similar content and determine if there's redundancy.
  If redundant, modify the new content to only include unique information.

  New Content:
  ${content}

  Existing Similar Content:
  ${similarDocs.map((doc) => doc.pageContent).join("\n---\n")}

  Return:
  - isRedundant: true if significant overlap exists
  - modifiedContent: if redundant, return only unique information; if not redundant, return original content
  - explanation: brief explanation of your decision
  `;

  const result = await generateObject({
    model: await MODEL_getModel_ai(
      UTILS_getModelArgsByName(
        UTILS_getModelsJSON().OpenAI["gpt-4o-mini"].name,
        0.1
      )
    ),
    schema: outputSchema,
    prompt: prompt,
  });

  logger.system("Redundancy check result:", {
    isRedundant: result.object.isRedundant,
    explanation: result.object.explanation,
  });

  return {
    isRedundant: result.object.isRedundant,
    modifiedContent: result.object.modifiedContent,
  };
}

export async function MEMORY_store(
  messages: ServerMessage[],
  agents: { name: string; roleDescription: string; title: string }[],
  userId: string
): Promise<void> {
  const chatString = messages
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n");
  const agentsString = agents
    .map((agent) => `${agent.name}: ${agent.roleDescription}`)
    .join("\n");

  // Generate summary and keywords
  const summary = await generateSummary(messages);
  const keywords = await generateKeywords(messages);
  let finalContent = chatString;
  let _namespace = `${userId}-${agents[0].name}`;
  for (const agent of agents) {
    _namespace = `${userId}-${agent.name}`;

    // Check for redundancy
    const redundancyCheck = await checkAndRemoveRedundancy(
      chatString,
      keywords,
      _namespace
    );
    finalContent = redundancyCheck.isRedundant
      ? redundancyCheck.modifiedContent
      : chatString;

    const meta = {
      userId,
      agentName: agent.name,
      agentRole: agent.roleDescription,
      chatHistory: finalContent,
      peers: agentsString,
      timestamp: new Date().toISOString(),
      summary: summary,
      keywords: keywords,
    };

    if (finalContent.trim()) {
      // Only store if there's content after redundancy check
      await PINECONE_storeData({
        toStore: [finalContent, summary, keywords.join(", ")],
        metadata: meta,
        namespace: _namespace,
      });

      console.log("--------------------------------");
      console.log("Stored...");
      console.log(`ChatString:\n${finalContent}\n\n`);
      console.log(`Summary:\n${summary}\n\n`);
      console.log(`Keywords:\n${keywords.join(", ")}\n\n`);
      console.log(`Meta:\n${JSON.stringify(meta)}\n\n`);
      console.log(`Namespace:\n${_namespace}\n\n`);
      console.log("--------------------------------");
    } else {
      console.log("Content was fully redundant - skipping storage");
    }
  }
}

export async function MEMORY_retrieve(
  query: string,
  userId: string,
  agentName: string,
  asDocsOrString: "docs" | "string" = "docs",
  agentType: AgentType
): Promise<
  | string
  | {
      pageContent: string;
      metadata: {
        timestamp: string;
        query: string;
        agentName: string;
        userId: string;
      };
    }[]
> {
  type MemoryDoc = {
    pageContent: string;
    metadata: {
      timestamp: string;
      query: string;
      agentName: string;
      userId: string;
    };
  };

  try {
    let toolNotesAnalysis: string | null = null;
    if (agentType === AgentTypeEnum.TOOL_OPERATOR) {
      try {
        const availableAuthPlatforms = authConfig.providers.map(
          (provider) => provider.name
        );
        toolNotesAnalysis = await Promise.race([
          MEMORY_checkForToolSolutions(query, availableAuthPlatforms),
          new Promise<string>((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error("Tool solutions check timed out after 5000ms")
                ),
              5000
            )
          ),
        ]);
      } catch (toolError) {
        logger.error("Error checking for tool solutions", {
          error: String(toolError),
          function: "MEMORY_retrieve",
          userId,
          agentName,
        });
        toolNotesAnalysis = `Unable to check for tool solutions: ${String(
          toolError
        )}`;
      }
    }

    const _namespace = `${userId}-${agentName}`;
    let semantic_result: MemoryDoc[] = [];

    try {
      // Add timeout to Pinecone query
      const semanticResultPromise = PINECONE_query_docs(
        query,
        _namespace,
        {},
        3
      );
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Pinecone query timed out after 8000ms")),
          8000
        )
      );

      const pineconeResult = await Promise.race([
        semanticResultPromise,
        timeoutPromise,
      ]);
      if (pineconeResult && Array.isArray(pineconeResult)) {
        semantic_result = pineconeResult.map((doc) => ({
          pageContent: doc.pageContent,
          metadata: {
            timestamp: new Date().toISOString(),
            query,
            agentName,
            userId,
          },
        }));
      }
    } catch (pineconeError) {
      logger.error("Error querying Pinecone", {
        error: String(pineconeError),
        function: "MEMORY_retrieve",
        userId,
        agentName,
      });
      semantic_result = [];
    }

    let db_result: GeneralPurpose[] = [];
    try {
      const dbQueryResult = await SERVER_getGeneralPurposeDataMany(_namespace);
      db_result = dbQueryResult || [];
    } catch (dbError) {
      logger.error("Error retrieving data from database", {
        error: String(dbError),
        function: "MEMORY_retrieve",
        userId,
        agentName,
      });
      db_result = [];
    }

    if (db_result.length > 0) {
      // combine the semantic and db results
      semantic_result.push(
        ...db_result.map((doc: GeneralPurpose) => {
          return {
            pageContent: doc.content,
            metadata: {
              timestamp: doc.createdAt.toISOString(),
              query: query,
              agentName: agentName,
              userId: userId,
            },
          };
        })
      );
    }

    if (asDocsOrString === "docs") {
      return toolNotesAnalysis
        ? semantic_result.concat([
            {
              pageContent: toolNotesAnalysis,
              metadata: {
                timestamp: new Date().toISOString(),
                query: query,
                agentName: agentName,
                userId: userId,
              },
            },
          ])
        : semantic_result;
    } else {
      return toolNotesAnalysis
        ? toolNotesAnalysis +
            "\n\n" +
            semantic_result
              .map((doc: MemoryDoc) => {
                const timestamp = new Date(
                  doc.metadata.timestamp
                ).toLocaleString();
                return `[${timestamp}]: ${UTILS_cleanNewlines(
                  doc.pageContent
                )}`;
              })
              .join("\n")
        : semantic_result
            .map((doc: MemoryDoc) => {
              const timestamp = new Date(
                doc.metadata.timestamp
              ).toLocaleString();
              return `[${timestamp}]: ${UTILS_cleanNewlines(doc.pageContent)}`;
            })
            .join("\n");
    }
  } catch (error) {
    logger.error("Critical error in MEMORY_retrieve", {
      error: String(error),
      userId,
      agentName,
      query: query.substring(0, 100), // Log only first 100 chars of query
    });
    return "***MEMORY-ERROR: Unable to retrieve data. Please try again.***";
  }
}

async function MEMORY_checkForToolSolutions(
  query: string,
  availableAuthPlatforms: string[]
): Promise<string> {
  try {
    // check the query for anything related to a tool call using object generation model
    const prompt = `Carefully review the following user/agent request and determine if the request is related to a tool call. If it is, return the name of the platform if available (i.e. ${
      availableAuthPlatforms.length > 2
        ? availableAuthPlatforms.slice(0, 3).join(", ")
        : availableAuthPlatforms.length > 0
        ? availableAuthPlatforms.join(", ")
        : ""
    }). Otherwise, return "no tool call".
    IMPORTANT: If the service being used is owned by one of the provide platforms, use that platform. (i.e. for YouTube, use Google)
    Here is the user/agent request: ${query}
    `;
    const outputSchema = z.object({
      platform: z.enum([
        "no tool call",
        ...availableAuthPlatforms.map((platform) => platform.toLowerCase()),
      ] as [string, ...string[]]),
      tool: z.string().optional(),
    });

    // Add timeout to model call
    const modelCallPromise = generateObject({
      model: await MODEL_getModel_ai(
        UTILS_getModelArgsByName(
          UTILS_getModelsJSON().OpenAI["gpt-4o-mini"].name,
          0.1
        )
      ),
      schema: outputSchema,
      prompt: prompt,
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Model call timed out after 6000ms")),
        6000
      )
    );

    const toolCheckResponseObject = await Promise.race([
      modelCallPromise,
      timeoutPromise,
    ]);

    if (toolCheckResponseObject.object.platform === "no tool call") {
      const response = `No relevant platform notes found for ${query}`;
      console.log(response);
      return response;
    }

    // perform a semantic search for the platform
    const _platform = toolCheckResponseObject.object.platform;

    // get the namespace for the platform
    const namespace = DYNAMIC_NAMES.agent_tools_process_notes(_platform);

    // Add timeout to Pinecone search
    const searchPromise = PINECONE_search(query, namespace, {}, 3);
    const searchTimeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Pinecone search timed out after 5000ms")),
        5000
      )
    );

    const semanticQueryResult = await Promise.race([
      searchPromise,
      searchTimeoutPromise,
    ]);

    // generate the prompt for the tool notes analysis
    const _intelligentToolNotesPrompt = `
    Carefully review the following 'stored tool process notes' and 'user/agent request' and extract any relevantinformation that should be passed along to the agent making the tool call to help aide completion of the tool call.
    Here are the stored tool process notes: ${semanticQueryResult}
    Here is the user/agent request: ${query}
    Only return the information that should be passed along to the agent making the tool call without any other text or commentary. If there is no relevant information, return "no useful information pertaining to the query found for ${_platform}".
    `;

    // Add timeout to text generation
    const textGenPromise = generateText({
      model: await MODEL_getModel_ai(
        UTILS_getModelArgsByName(
          UTILS_getModelsJSON().OpenAI["gpt-4o-mini"].name,
          0.1
        )
      ),
      prompt: _intelligentToolNotesPrompt,
    });

    const textGenTimeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Text generation timed out after 6000ms")),
        6000
      )
    );

    const toolNotesAnalysis = await Promise.race([
      textGenPromise,
      textGenTimeoutPromise,
    ]);

    console.log(`Tool Notes Analysis for ${_platform}:`);
    console.log(toolNotesAnalysis.text);
    logger.system(`Tool Notes Analysis for ${_platform}:`, {
      toolNotesAnalysis: toolNotesAnalysis.text,
      platform: _platform,
      query: query,
      namespace: namespace,
      semanticQueryResult: semanticQueryResult,
    });
    return toolNotesAnalysis.text;
  } catch (error) {
    console.error("Error checking for tool solutions:", error);
    logger.error("Error checking for tool solutions:", {
      error: error instanceof Error ? error.message : String(error),
      query: query.substring(0, 100), // Only log first 100 chars of query
      timestamp: new Date().toISOString(),
    });
    return `No tool information available due to timeout or error: ${
      error instanceof Error ? error.message : String(error)
    }`;
  }
}

export async function AUTOGEN_MEMORY_storeProcessNotesToMemory(
  processToAutomate: string,
  processNotes: string[],
  userId: string,
  metaData?: any
) {
  const _name = "AUTOGEN_CREATION_NOTES";
  const namespace = DYNAMIC_NAMES.namespace_generic(userId, _name);
  // First, check if similar notes already exist
  const similarNotes = await PINECONE_query_docs(
    processToAutomate,
    namespace,
    {},
    100
  );
  if (similarNotes.length > 0) {
    console.log("Similar notes already exist - skipping storage");
    return;
  }
  await PINECONE_storeData({
    toStore: [processToAutomate, ...processNotes],
    metadata: {
      timestamp: new Date().toISOString(),
      notes: processNotes,
      userId: userId,
      ...metaData,
    },
    namespace: namespace,
  });
}

export async function AUTOGEN_MEMORY_checkForProcessnotes(
  userId: string,
  processToAutomate: string
) {
  const _name = "AUTOGEN_CREATION_NOTES";
  const namespace = DYNAMIC_NAMES.namespace_generic(userId, _name);
  const results = await PINECONE_query_docs(
    processToAutomate,
    namespace,
    {},
    100
  );

  // Extract only the notes metadata from search results
  const notesOnly = results
    .map((result) => result.metadata?.notes || [])
    .filter(Boolean);
  return notesOnly;
}
