// "use server";

import { getServiceTokens } from "@/src/app/actions/get-service-tokens";
import { logger } from "@/src/lib/logger";

import { tool } from "ai";
import { object, z } from "zod";
import { authConfig } from "@/src/config/auth";
import {
  TOOLFUNCTION_iterateAuthToolProcessUntilSuccess,
  AuthToolOptimizerProps,
} from "@/src/lib/agent-tools/error-iterators/next-auth-tool-err-iter/auth-tool-optimizer";
import { TOOLFUNCTION_CONTEXT_SETS } from "@/src/lib/agent-tools/context-sets";
import { AgentComponentProps, ContextContainerProps } from "@/src/lib/types";
import { S3_storeFileToS3 } from "@/src/lib/agent-tools/s3-storage/s3-core";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { TextChatLogProps } from "@/src/lib/text-chat-log";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { TOOLFUNCTION_split_text } from "@/src/app/api/tools/splitters";
import { detectFileType, parseContentByType } from "@/src/lib/utils/file-type-detection";
import { PERPLEXITY_getResponse } from "../perplexity";


// TODO: Auto Context Builder - during post analysis, auto extract any important info and add to the context with zero visibility to agents
// TODO: Auto Summarize Conversation
// TODO: Auto Track token usage, max-token limits, dynamic to each model
export const TOOLFUNCTION_isAuthorized = async (
  platform: string,
  userId: string
): Promise<string> => {
  try {
    const _token = await getServiceTokens(platform, userId);

    if (!_token) {
      logger.tool(`NEXT_AUTH_TOOLFUNCTION_is NOT Authorized: ${platform}`, {
        platform,
        userId,
        _token,
      });
      return `{"error": "Authorization failed - No valid token found for ${platform}"}`;
    }
    logger.tool(`NEXT_AUTH_TOOLFUNCTION_isAuthorized: ${platform}`, {
      platform,
      userId,
      _token,
    });
    return `{"status": "authorized", "platform": "${platform}"}`;
  } catch (error) {
    logger.error(`NEXT_AUTH_TOOLFUNCTION_isAuthorized error: ${error}`, {
      platform,
      userId,
      error,
    });
    return `{"error": "Authorization check failed - Internal error occurred while checking ${platform} authorization"}`;
  }
};

export const TOOLFUNCTION_getServiceTokens = async (
  platform: string,
  userId: string
): Promise<string> => {
  try {
    const _token: {
      clientId: string;
      clientSecret: string;
      accessToken: string;
      refreshToken: string;
      expiresAt: number;
    } = await getServiceTokens(platform, userId);

    if (!_token) {
      logger.tool(
        `NEXT_AUTH_TOOLFUNCTION_getServiceTokens - NO TOKENS: ${platform}`,
        {
          platform,
          userId,
          _token,
        }
      );
      return `{"error": "Token retrieval failed - No tokens available for ${platform}"}`;
    }

    // logger.tool(`NEXT_AUTH_TOOLFUNCTION_getServiceTokens: ${platform}`, {
    //   platform,
    //   userId,
    //   _token,
    // });
    // console.log("NEXT_AUTH_TOOLFUNCTION_getServiceTokens: ", {
    //   clientId: _token.clientId,
    //   clientSecret: _token.clientSecret,
    //   accessToken: _token.accessToken,
    //   refreshToken: _token.refreshToken,
    //   expiresAt: _token.expiresAt,
    // });
    return (
      JSON.stringify({
        clientId: _token.clientId,
        clientSecret: _token.clientSecret,
        accessToken: _token.accessToken,
        refreshToken: _token.refreshToken,
        expiresAt: _token.expiresAt,
      }) ||
      `{"error": "Token retrieval failed - Invalid access token format for ${platform}"}`
    );
  } catch (error) {
    logger.error(`NEXT_AUTH_TOOLFUNCTION_getServiceTokens error: ${error}`, {
      platform,
      userId,
      error,
    });
    return `{"error": "Token retrieval failed - Internal error occurred while fetching ${platform} tokens"}`;
  }
};

let _fetchInProgress: boolean = false;
export const TOOLFUNCTION_makeFetchRequest = async (
  url: string,
  method: string,
  body: any,
  headers: any,
  platform: string,
  userId: string,
  returnType: "string" | "json" = "string",
  fileStore: boolean = false,
  vc: MemoryVectorStore
): Promise<string | { error: boolean; details: string }> => {
  try {
    if (_fetchInProgress) {
      return `{"error": "Fetch request already in progress"}`;
    }
    _fetchInProgress = true;
    const tokenResponse = await TOOLFUNCTION_getServiceTokens(platform, userId);
    const tokenData = JSON.parse(tokenResponse);

    if ("error" in tokenData) {
      return tokenResponse; // Pass through the error
    }

    // Construct headers based on the platform's requirements
    const authHeaders = (() => {
      switch (platform.toLowerCase()) {
        case "google":
          return {
            Authorization: `Bearer ${tokenData.accessToken}`,
            "Content-Type": "application/json",
          };
        case "github":
          return {
            Authorization: `token ${tokenData.accessToken}`,
            Accept: "application/vnd.github.v3+json",
          };
        case "linkedin":
          return {
            Authorization: `Bearer ${tokenData.accessToken}`,
            "X-Restli-Protocol-Version": "2.0.0",
          };
        case "twitter":
          return {
            Authorization: `Bearer ${tokenData.accessToken}`,
          };
        case "dropbox":
          return {
            Authorization: `Bearer ${tokenData.accessToken}`,
            "Content-Type": "application/json",
          };
        default:
          return {
            Authorization: `Bearer ${tokenData.accessToken}`,
          };
      }
    })();

    // Merge platform-specific headers with user-provided headers
    const finalHeaders = {
      ...authHeaders,
      ...(headers || {}),
    };

    console.log("NEXT_AUTH_TOOLFUNCTION_makeFetchRequest finalHeaders: ", {
      finalHeaders,
    });
    logger.tool(
      `NEXT_AUTH_TOOLFUNCTION_makeFetchRequest finalHeaders: ${platform}`,
      { finalHeaders }
    );

    const response = await fetch(url, {
      method,
      headers: finalHeaders,
      ...(method !== "GET" && { body: JSON.stringify(body) }),
    });

    let result;
    let _URL: string = "";
    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      result = await response.json();

      if (fileStore && typeof result === "object") {
        // extract the file type from the content-type
        const fileType = contentType?.split("/")[1];
        console.log("NEXT_AUTH_TOOLFUNCTION_makeFetchRequest fileStore: ", {
          result,
        });
        logger.tool(
          `NEXT_AUTH_TOOLFUNCTION_makeFetchRequest fileStore: ${result.details}`,
          { result }
        );
        try {
          _URL = await S3_storeFileToS3(result.details, `.${fileType}`, contentType);
        } catch (storageError) {
          logger.error("File storage failed", {
            error: storageError,
            fileType,
            userId
          });
          throw new Error("Failed to store file after API success");
        }
      }
    } else {
      // Handle non-JSON response
      const contentBuffer = Buffer.from(await response.arrayBuffer());
      const fileName = url.split('/').pop() || '';
      const { type: fileType } = await detectFileType(contentBuffer, contentType || undefined, fileName);
      
      result = { content: await parseContentByType(contentBuffer, fileType) };
    
      if (result.content.length > 1000000) {
        const chunks = await TOOLFUNCTION_split_text(result.content, 1000000, 200);
        await vc.addDocuments(
          chunks.map((chunk, index) => ({
            pageContent: chunk.pageContent,
            metadata: {
              source: "oauth2-provider-makeFetchRequest",
              userId,
              fileType: fileType,
              timestamp: new Date().toISOString(),
              chunkIndex: index,
              totalChunks: chunks.length
            },
          }))
        );
        result.content = `${chunks[0].pageContent}\n...[TRUNCATED - USE queryDocumentChunks TO ACCESS FULL CONTENT]`;
      }
    }

    console.log("NEXT_AUTH_TOOLFUNCTION_makeFetchRequest result: ", { result });
    logger.tool(`NEXT_AUTH_TOOLFUNCTION_makeFetchRequest result: ${platform}`, {
      result,
    });
    _fetchInProgress = false;

    if (fileStore && typeof result === "object") {
      return JSON.stringify({
        error: result.error ? true : false,
        details: result.error
          ? result.error.message + "-" + result.error.code
          : result.details,
        file_url: _URL,
      });
    }
    return returnType === "string"
      ? JSON.stringify(result)
      : {
          error: result.error ? true : false,
          details: result.error
            ? result.error.message + "-" + result.error.code
            : result,
        };
  } catch (error) {
    console.log("NEXT_AUTH_TOOLFUNCTION_makeFetchRequest error: ", { error });
    logger.tool(`NEXT_AUTH_TOOLFUNCTION_makeFetchRequest error: ${error}`, {
      error,
    });
    _fetchInProgress = false;
    return returnType === "string"
      ? JSON.stringify({
          error: true,
          details: `Fetch request failed - Error occurred while making ${method} request to ${url} for ${platform}`,
        })
      : {
          error: true,
          details:
            error instanceof Error ? error.message : JSON.stringify(error),
        };
  }
};

export const TOOLFUNCTION_queryAPIHelp = async (
  question: string,
  platform: string
): Promise<string> => {
  console.log("NEXT_AUTH_TOOLFUNCTION_queryAPIHelp question: ", {
    platform,
    question,
  });
  logger.tool(`NEXT_AUTH_TOOLFUNCTION_queryAPIHelp question: ${question}`, {
    platform,
    question,
  });
  //return "This is a test response";
  try {
    const response = await PERPLEXITY_getResponse(
      `Please gather and provide the most relevant technical information about ${platform} in no more than 1000 words. Here is the requested information: ${question}`,
      "sonar-reasoning-pro"
    );
    logger.tool(`NEXT_AUTH_TOOLFUNCTION_queryAPIHelp: ${question}`, {
      question,
      response,
    });
    if (!response) {
      console.log("NEXT_AUTH_TOOLFUNCTION_queryAPIHelp response: ", {
        response,
      });
      logger.tool(`NEXT_AUTH_TOOLFUNCTION_queryAPIHelp response: ${response}`, {
        response,
      });
      return JSON.stringify({
        error: `API help query failed - No response from Perplexity`,
        details: "No response from Perplexity",
      });
    }
    console.log("NEXT_AUTH_TOOLFUNCTION_queryAPIHelp response: ", { response });
    logger.tool(`NEXT_AUTH_TOOLFUNCTION_queryAPIHelp response: ${response}`, {
      response,
    });
    return response;
  } catch (error) {
    logger.error(`NEXT_AUTH_TOOLFUNCTION_queryAPIHelp error: ${error}`, {
      error,
    });
    return JSON.stringify({
      error: `Perplexity help query failed - Error occurred while querying Perplexity`,
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

const _toolProcessingState = { processing: false };
export const AGENT_TOOLS_NEXT_AUTH = (
  userId: string,
  originalQuery: string,
  currentAgent: AgentComponentProps,
  contextSets: ContextContainerProps[],
  vc: MemoryVectorStore,
  textChatLogs: TextChatLogProps[]
) => {
  return {
    isAuthorized: tool({
      description: "Check if the user is authorized to use the platform",
      parameters: z.object({
        platform: z.enum([
          authConfig.providers.map((provider) => provider.name)[0],
          ...authConfig.providers.map((provider) => provider.name).slice(1),
        ]),
      }),

      execute: async ({ platform }) => {
        return await TOOLFUNCTION_isAuthorized(platform, userId);
      },
    }),
    // getServiceTokens: tool({
    //   description: "Get the service tokens for the platform",
    //   parameters: z.object({
    //     platform: z.enum([
    //       authConfig.providers.map((provider) => provider.name)[0],
    //       ...authConfig.providers.map((provider) => provider.name).slice(1),
    //     ]),
    //   }),
    //   execute: async ({ platform }) => {
    //     return await TOOLFUNCTION_getServiceTokens(platform, userId);
    //   },
    // }),
    makeFetchRequest: tool({
      description: "Make a fetch request to the platform",
      parameters: z.object({
        url: z.string(),
        method: z.enum(["GET", "POST", "PUT", "DELETE"]),
        body: z.any().default(""),
        headers: z.record(z.string(), z.string()).default({}),
        platform: z.enum([
          authConfig.providers.map((provider) => provider.name)[0],
          ...authConfig.providers.map((provider) => provider.name).slice(1),
        ]),
        fileStore: z
          .boolean()
          .default(false)
          .optional()
          .describe(
            "If true, the response will be stored in the virtual storage space and the URL will be returned to you as well as persisted to the context sets."
          ),
      }),
      execute: async ({ url, method, body, headers, platform, fileStore }) => {
        if (_toolProcessingState.processing) {
          console.log(
            "NEXT_AUTH_TOOLFUNCTION_makeFetchRequest processing in progress"
          );
          return "Processing in progress";
        }
        try {
          _toolProcessingState.processing = true;
          console.log("NEXT_AUTH_TOOLFUNCTION_makeFetchRequest url: ", {
            url,
            method,
            body,
            headers,
            platform,
            userId,
          });
          logger.tool(`NEXT_AUTH_TOOLFUNCTION_makeFetchRequest url: ${url}`, {
            url,
            method,
            body,
            headers,
            platform,
            userId,
          });
          let _result:
            | string
            | { error: boolean; details: string; file_url?: string } = "";
          if (fileStore) {
            _result = (await TOOLFUNCTION_makeFetchRequest(
              url,
              method,
              body,
              headers,
              platform,
              userId,
              "json",
              true,
              vc
            )) as { error: boolean; details: string };
          } else {
            _result = (await TOOLFUNCTION_makeFetchRequest(
              url,
              method,
              body,
              headers,
              platform,
              userId,
              "string",
              false,
              vc
            )) as string;
          }

          let _errorFixResult: { error: boolean; details: string } = {
            error: false,
            details: "",
          };

          if (
            typeof _result === "string" &&
            (_result.includes("error") ||
              JSON.stringify(_result).includes("error"))
          ) {
            _errorFixResult =
              (await TOOLFUNCTION_iterateAuthToolProcessUntilSuccess(
                _result,
                {
                  platform,
                  userId,
                  messages: [],
                  query: `<url>${url}</url> <method>${method}</method> <body>${body}</body> <headers>${headers}</headers>`,
                  namespace: "",
                  notes: "",
                  summary: "",
                },
                0,
                fileStore,
                vc
              )) as { error: boolean; details: string };
            _result = _errorFixResult.details;
          }
          if (fileStore && typeof _result === "object" && _result.file_url) {
            console.log("NEXT_AUTH_TOOLFUNCTION_makeFetchRequest fileStore: ", {
              _result,
            });
            logger.tool(
              `NEXT_AUTH_TOOLFUNCTION_makeFetchRequest fileStore: ${_result.details}`,
              { _result }
            );
            await TOOLFUNCTION_CONTEXT_SETS(
              contextSets,
              "addSet",
              currentAgent,
              `STORED_FILE...${_result.file_url?.substring(
                _result.file_url?.length - 10
              )}`,
              _result.file_url
            );
          }
          _toolProcessingState.processing = false;
          return typeof _result === "string"
            ? _result
            : JSON.stringify(_result);
        } catch (error) {
          _toolProcessingState.processing = false;
          return JSON.stringify({
            error: true,
            details: error instanceof Error ? error.message : "Unknown error",
          });
        }
      },
    }),
    queryAPIHelp: tool({
      description: "Query the API help for the platform",
      parameters: z.object({
        platform: z
          .enum([
            authConfig.providers.map((provider) => provider.name)[0],
            ...authConfig.providers.map((provider) => provider.name).slice(1),
          ])
          .describe("The platform being used."),
        question: z
          .string()
          .describe("The information you need to know about the platform."),
      }),

      execute: async ({ question, platform }) => {
        if (_toolProcessingState.processing) {
          console.log(
            "NEXT_AUTH_TOOLFUNCTION_queryAPIHelp processing in progress"
          );
          return "Processing in progress";
        }
        try {
          _toolProcessingState.processing = true;
          const _result = await TOOLFUNCTION_queryAPIHelp(question, platform);
          _toolProcessingState.processing = false;
          return _result;
        } catch (error) {
          _toolProcessingState.processing = false;
          return JSON.stringify({
            error: true,
            details: error instanceof Error ? error.message : "Unknown error",
          });
        }
      },
    }),
    fixProcessingErrors: tool({
      description: "Fix processing errors",
      parameters: z.object({
        query: z.string(),
        currentError: z.string(),
        platform: z.string(),
      }),
      execute: async ({ query, currentError, platform }) => {
        if (_toolProcessingState.processing) {
          console.log(
            "NEXT_AUTH_TOOLFUNCTION_fixProcessingErrors processing in progress"
          );
          return "Processing in progress";
        }
        try {
          _toolProcessingState.processing = true;
          const props: AuthToolOptimizerProps = {
            platform,
            userId,
            query: query,
            messages: [],
            namespace: "NEXT_AUTH_TOOL_fixProcessingErrors",
          };
          const _result: {
            error: boolean;
            details: string;
          } = (await TOOLFUNCTION_iterateAuthToolProcessUntilSuccess(
            currentError,
            props,
            0,
            false,
            vc
          )) as {
            error: boolean;
            details: string;
          };
          _toolProcessingState.processing = false;
          return _result;
        } catch (error) {
          _toolProcessingState.processing = false;
          return JSON.stringify({
            error: true,
            details: error instanceof Error ? error.message : "Unknown error",
          });
        }
      },
    }),
    parseFile: tool({
      description: "Parse files and chunk text into memory vector store",
      parameters: z.object({
        fileContent: z.string(),
        fileType: z.enum(["pdf", "docx", "xlsx", "xls", "html", "txt"]),
        chunkSize: z.number().optional().default(1000),
        chunkOverlap: z.number().optional().default(200),
      }),
      execute: async ({ fileContent, fileType, chunkSize, chunkOverlap }) => {
        try {
          const buffer = Buffer.from(fileContent);
          // Enhanced detection
          const { type: detectedType } = await detectFileType(buffer, undefined, `file.${fileType}`);
          const rawText = await parseContentByType(buffer, detectedType);

          // 2. Use existing splitter tool
          const chunks = await TOOLFUNCTION_split_text(
            rawText,
            chunkSize,
            chunkOverlap
          );

          // 3. Add to memory vector store
          await vc.addDocuments(
            chunks.map((chunk, index) => ({
              pageContent: chunk.pageContent,
              metadata: {
                source: "oauth2-provider-parseFile",
                userId,
                fileType,
                timestamp: new Date().toISOString(),
                chunkIndex: index,
                totalChunks: chunks.length
              },
            }))
          );

          // 4. Generate summary for agent use
          const summary = await generateText({
            model: anthropic("claude-3-haiku"),
            system: "Generate a one-sentence summary of this document",
            prompt: rawText.substring(0, 2000),
          });

          textChatLogs.push({
            role: "function",
            message: `Parsed and stored ${chunks.length} chunks from ${fileType} file`,
            agentName: "next-auth/parseFile",
            timestamp: new Date(),
          });

          return JSON.stringify({
            summary: summary.text,
            chunkCount: chunks.length,
            firstChunk: chunks[0].pageContent,
            vectorStoreStatus: "memory",
            navigationHint: `Use getNextChunks with source: "oauth2-provider-parseFile" and startIndex: 0 to read sequentially`
          });
        } catch (error) {
          logger.error("Document parse error", {
            error: error instanceof Error ? error.message : "Unknown error",
            fileType,
            userId,
          });
          return JSON.stringify({
            error: true,
            details: "Failed to process document. Check logs for details.",
          });
        }
      },
    }),
    queryDocumentChunks: tool({
      description: "Search stored document chunks from parseFile/makeFetchRequest",
      parameters: z.object({
        query: z.string().describe("Natural language search query"),
        maxResults: z.number().optional().default(3)
      }),
      execute: async ({ query, maxResults }) => {
        logger.tool("Querying document chunks", {
          action: "DOCUMENT_CHUNK_QUERY",
          query: query.substring(0, 50) + (query.length > 50 ? "..." : ""),
          maxResults
        });

        textChatLogs.push({
          role: "function",
          message: `Searching document chunks for: "${query}"`,
          agentName: "next-auth/queryChunks",
          timestamp: new Date(),
        });

        try {
          const results = await vc.similaritySearch(query, maxResults);
          return JSON.stringify(results.map(r => ({
            content: r.pageContent,
            metadata: r.metadata
          })));
        } catch (error) {
          logger.error("Document chunk query failed", {
            error: error instanceof Error ? error.message : "Unknown error"
          });
          return JSON.stringify({
            error: true,
            details: "Failed to query document chunks"
          });
        }
      },
    }),
    getNextChunks: tool({
      description: "Retrieve sequential chunks from stored documents",
      parameters: z.object({
        source: z.enum(["next-auth-parse", "next-auth-makeFetchRequest"]),
        startIndex: z.number().describe("Starting chunk index (0-based)"),
        chunkCount: z.number().optional().default(3)
      }),
      execute: async ({ source, startIndex, chunkCount }) => {
        try {
          // Get all chunks for the source
          const allChunks = await vc.memoryVectors.filter(v => 
            v.metadata.source === source && 
            v.metadata.userId === userId
          );
          
          // Sort by chunk index
          const sorted = allChunks.sort((a, b) => 
            a.metadata.chunkIndex - b.metadata.chunkIndex
          );

          // Get requested range
          const endIndex = Math.min(startIndex + chunkCount, sorted.length);
          const results = sorted.slice(startIndex, endIndex);

          return JSON.stringify({
            chunks: results.map(r => ({
              content: r.content,
              index: r.metadata.chunkIndex,
              total: r.metadata.totalChunks
            })),
            nextStart: endIndex < sorted.length ? endIndex : null
          });
          
        } catch (error) {
          logger.error("Sequential chunk retrieval failed", {
            error: error instanceof Error ? error.message : "Unknown error"
          });
          return JSON.stringify({
            error: true,
            details: "Failed to retrieve sequential chunks"
          });
        }
      },
    }),
  };
};

export const AGENT_TOOLS_DIRECTIVE_OAUTH_PROVIDER = () => {
  return `
    <specialty>
        You are an expert at maneuvering several different OAuth providers/platforms/APIs like Google, Microsoft, LinkedIn, etc.
    </specialty>
    <note>
        When a provider is authenticated, assume that ALL scopes for that provider are granted. (i.e. For Google, assume that all Google Drive, Calendar, Gmail, etc. scopes are granted).
    </note>
    <process-steps>
        <step>
            Use your isAuthorized tool to check if the user is authorized to use the platform.
        </step>
        <step>
            If the user is not authorized, inform the user to authorize the platform in the agent controls.
        </step>
        <step>
            If authorized, use your makeFetchRequest tool directly to execute requests to the platform's API/REST endpoint. The tool automatically handles token management and authentication headers for you.
        </step>
        <step>
            For large document responses (over 1MB):
            <substep>1. Automatically store content chunks in vector storage</substep>
            <substep>2. Return first chunk with navigation instructions</substep>
            <substep>3. Use queryDocumentChunks for semantic searches</substep>
            <substep>4. Use getNextChunks for sequential reading</substep>
        </step>
        <step>
            When working with files/documents:
            <substep>1. Use parseFile tool for direct uploads</substep>
            <substep>2. Store parsed content in memory vector store</substep>
            <substep>3. Retrieve additional content using query tools</substep>
        </step>
        <step>
            Focus on constructing the correct API endpoint URLs and request parameters according to the platform's API documentation. The authentication headers are handled automatically.
        </step>
        <optional-step>
            If you need information about the platform's API endpoints or features, use your queryAPIHelp tool to get the most current information.
        </optional-step>
        <optional-step>
            If you need to store a file, use your fileStore tool. The URL of the stored file will be returned to you as well as persisted to the context sets.
        </optional-step>
        <step>
            Work efficiently to complete the user's request while asking minimal questions.
        </step>
        <optional-step>
            If you encounter an error, take the error message and original query and use your fixProcessingErrors tool to fix the error. If it is successful it will document it's solution for future reference and return the result of the operation that you can use to continue.
        </optional-step>
        <step>
            If you cannot complete a task after multiple attempts, inform the user and explain the reason using the final error message.
        </step>
    </process-steps>
    <IMPORTANT>
        - Token management and authentication headers are handled automatically by the makeFetchRequest tool
        - Never process large files (>1MB) directly - rely on chunking tools
        - Use queryDocumentChunks for searching document content
        - Use getNextChunks for reading through documents sequentially
        - Never fake or pretend to perform a task
        - Never return made up and unverified information
        - Use the fixProcessingErrors tool to help resolve errors
        - If you cannot complete a task after multiple attempts, inform the user and explain the reason
    </IMPORTANT>
    <platform-specific-requirements>
      <google-drive-large-files>
        When handling large Google Drive files:
        1. Use makeFetchRequest to get file metadata
        2. Use parseFile with the file ID to chunk content
        3. Access content through queryDocumentChunks/getNextChunks
      </google-drive-large-files>
      <sharepoint-documents>
        For SharePoint document processing:
        1. Retrieve document URLs via makeFetchRequest
        2. Use parseFile with document URL
        3. Navigate chunks using sequential tools
      </sharepoint-documents>
    </platform-specific-requirements>
  `;
};
