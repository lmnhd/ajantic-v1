// Import necessary dependencies and types
import { ModelArgs, ModelProviderEnum } from "@/src/lib/types";
import { OpenAIModelNames } from "@/src/app/api/model/openai";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import { MODEL_getModel_ai } from "../../../vercelAI-model-switcher";
import { DYNAMIC_NAMES } from "../../../dynamic-names";
import { PINECONE_query_docs, PINECONE_storeData } from "@/src/app/api/pinecone";
import { logger } from "@/src/lib/logger";
import {
  SERVER_getGeneralPurposeDataMany,
  SERVER_storeGeneralPurposeData,
} from "@/src/lib/server-actions";
import { TOOLFUNCTION_makeFetchRequest } from "../../next-auth-tool/next-auth-tool";
import { GeneralPurpose } from "@prisma/client";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { UTILS_getModelArgsByName } from "@/src/lib/utils";
import { UTILS_getModelsJSON } from "@/src/lib/utils";
import { PERPLEXITY_getResponse } from "../../perplexity";
// Interface defining the properties needed for auth tool optimization
export interface AuthToolOptimizerProps {
  platform: string; // The OAuth platform (e.g., Google, GitHub)
  userId: string; // Unique identifier for the user
  query: string; // The query or action being attempted
  messages: AuthToolProcessMessage[]; // History of auth process attempts
  namespace: string; // Namespace for storing process data
  notes?: string; // Optional additional notes about the process
  summary?: string; // Optional summary of previous attempts
}

// Interface defining the structure of auth process messages
export interface AuthToolProcessMessage {
  url: string; // The endpoint URL
  method: string; // HTTP method used
  body: any; // Request body data
  headers: any; // Request headers
  platform: string; // OAuth platform
  userId: string; // User identifier
  research?: string; // Optional research notes
  result?: string; // Optional result of the request
  error?: string; // Optional error message
}

// Define the AI models to be used for processing - make this a function to avoid circular dependencies
const getWorkModels = (): ModelArgs[] => {
  return [
    UTILS_getModelArgsByName(UTILS_getModelsJSON().OpenAI["gpt-4o-mini"].name, 0),
    UTILS_getModelArgsByName(UTILS_getModelsJSON().Anthropic["claude-3-5-sonnet-20240620"].name, 0),
  ];
};

// Function to summarize the results of an OAuth troubleshooting process as store unsaved summary, pointers, and keywords
// @param messages - Array of AuthToolProcessMessage objects containing details of OAuth process attempts
// @param platform - The OAuth platform being used (e.g. Google, GitHub)
export async function AUTH_TOOL_summarizeProcessResults(
  messages: AuthToolProcessMessage[],
  platform: string
): Promise<void> {
  try {
    // Generate namespace for storing process notes
    const _namespace = DYNAMIC_NAMES.agent_tools_process_notes(platform);

    // Create prompt for summarizing the OAuth process
    const prompt = `
    You are an expert at summarizing the results of an Oauth troubleshooting process.
    You are given a list of messages that represent the process of a tool call using an Oauth provider.
    You are to summarize the results of the process and provide pointers for using this tool in the future.
    Return the summary as markdown and include the steps tried unsuccessfully and the steps that were successful if any.
    If it looks like the issue may be connected to 'outside' factors such as the user's account or provider's settings or missing scopes, make a note of that.
    You should also provide a list of keywords that will make this summary easier to locate semantically.
    Here are the messages:
    ${messages
      .map(
        (message) =>
          `URL: ${message.url}\nMethod: ${
            message.method
          }\nBody: ${JSON.stringify(message.body)}\nHeaders: ${JSON.stringify(
            message.headers
          )}\nPlatform: ${message.platform}\nUser ID: ${
            message.userId
          }\nResult: ${message.result}\nError: ${message.error}`
      )
      .join("\n")}
    `;

    // Log the prompt for debugging
    logger.prompt(`Auth Tool Optimizer Prompt for ${platform}`, {
      prompt: prompt,
    });
    console.log(`Auth Tool Optimizer Prompt for ${platform}`);

    // Generate summary using AI model
    const summary = await generateObject({
      model: await MODEL_getModel_ai(getWorkModels()[0]),
      prompt: prompt,
      schema: z.object({
        summary: z.string(),
        pointers: z
          .array(z.string())
          .describe("Special suggestions when using this tool in the future"),
        keywords: z
          .array(z.string())
          .describe(
            "A list of keywords that will make this summary easier to locate semantically"
          ),
      }),
    });

    // Compare the summary object against stored summary from the databse.
    // If all the information is already stored, move on.
    // If any of the information is new, update the object.
    const _storedSummary: GeneralPurpose[] =
      await SERVER_getGeneralPurposeDataMany(_namespace);
    if (_storedSummary.length > 0) {
      let _infoInDatabase: string = "";
      _storedSummary.forEach((doc) => {
        _infoInDatabase += `${doc.content}\n`;
      });
      const _dbCheckPrompt = `
    You are the DATA REDUNDANCY CONTROLLER.
    Your task is to compare the information stored in the database against newly generated information and determine if any of the new information is already stored.
    You will return a new object with the updated information that excludes any information that is already stored.
    If all the information is already stored, return an empty object.
    Here is the information that is stored in the database:
    ${_infoInDatabase}
    Here is the information that is provided:
    ${summary.object.summary}\n${summary.object.pointers.join(
        ","
      )}\n${summary.object.keywords.join(",")}
    `;
      const _dbCheckResult = await generateObject({
        model: await MODEL_getModel_ai(getWorkModels()[0]),
        prompt: _dbCheckPrompt,
        schema: z
          .object({
            newSummary: z
              .string()
              .describe(
                "The new summary of the process. If all the information is already stored, return an empty string."
              ),
            newPointers: z
              .array(z.string())
              .describe(
                "The new pointers for the process. If all the information is already stored, return an empty array."
              ),
            newKeywords: z
              .array(z.string())
              .describe(
                "The new keywords for the process. If all the information is already stored, return an empty array."
              ),
          })
          .required({
            newSummary: true,
            newPointers: true,
            newKeywords: true,
          }),
      });
      // check if ALL results are empty
      if (
        _dbCheckResult.object.newSummary?.length === 0 &&
        _dbCheckResult.object.newPointers?.length === 0 &&
        _dbCheckResult.object.newKeywords?.length === 0
      ) {
        return;
      }
      // check if any results are new
      if (_dbCheckResult.object.newSummary) {
        summary.object.summary = _dbCheckResult.object.newSummary;
      }
      if (_dbCheckResult.object.newPointers) {
        summary.object.pointers = _dbCheckResult.object.newPointers;
      }
      if (_dbCheckResult.object.newKeywords) {
        summary.object.keywords = _dbCheckResult.object.newKeywords;
      }
    }

    // Store the summary in Pinecone vector database
    await PINECONE_storeData({
      namespace: _namespace,
      toStore: [
        summary.object.summary,
        summary.object.pointers.join(","),
        summary.object.keywords.join(","),
      ],
      metadata: {
        summary: summary.object.summary,
        pointers: summary.object.pointers.join(","),
        keywords: summary.object.keywords.join(","),
      },
    });

    // Store the summary in general purpose database
    await SERVER_storeGeneralPurposeData(
      summary.object.summary,
      summary.object.pointers.join(","),
      summary.object.keywords.join(","),
      platform,
      _namespace,
      true
    );

    console.log(`Summary stored for ${platform}`);
    logger.system(`Summary stored for ${platform}`, {
      summary: summary.object.summary,
      pointers: summary.object.pointers.join(","),
      keywords: summary.object.keywords.join(","),
    });
  } catch (error) {
    console.error("Error summarizing process results:", error);
  }
}

// Function to check for previously stored tool notes
export async function AUTH_TOOL_checkForStoredToolNotes(
  namespace: string,
  query: string
) {
  // Retrieve notes from database
  const storedToolNotesDB = await SERVER_getGeneralPurposeDataMany(namespace);

  // Query Pinecone for relevant documents
  const storedToolNotesPinecone: Record<string, any>[] =
    (await PINECONE_query_docs(query, namespace, {}, 3)) ||
    ([] as Record<string, any>[]);

  // Combine and format results
  const storedToolNotes = [
    ...storedToolNotesDB.map((doc) => ({
      pageContent: doc.content,
      metadata: { timestamp: doc.createdAt.toISOString(), query: query },
    })),
    ...storedToolNotesPinecone,
  ];
  return storedToolNotes.map((doc) => doc.pageContent).join("\n");
}

// Helper function to research issues using Perplexity
async function _researchIssues(
  query: string,
  errors: string,
  previouslyAttemptedActions: string,
  iteration: number,
  iterationLimit: number
) {
  const prompt = `Please research and provide insights into how to solve the following issue:
  ${errors}
  Here is what we are trying to do:
  ${query}
  Here are the actions we have already tried that have not worked:
  ${previouslyAttemptedActions}
  `;
  const result = await PERPLEXITY_getResponse(prompt, "sonar-reasoning-pro");
  return result;
}

// Maximum number of iterations for auth tool process
const iterationLimit = 6;

// Main function to iterate through auth tool process until success or limit reached
export async function TOOLFUNCTION_iterateAuthToolProcessUntilSuccess(
  currentError: string,
  props: AuthToolOptimizerProps,
  iteration: number = 0,
  fileStore: boolean = false,
  vc: MemoryVectorStore
) {
  const { platform, userId, query, messages, namespace, summary, notes } =
    props;
  let _research: string | null = null;

  // Check if iteration limit reached
  if (iteration >= iterationLimit) {
    return {
      error: true,
      details: `Iteration limit of ${iterationLimit} reached`,
    };
  }

  if (iteration % 2 !== 0) {
    // Quick model check if the error and query appear to be unfixable
    const _quickModelCheck = await generateObject({
      model: await MODEL_getModel_ai(getWorkModels()[0]),
      prompt: `
      You are an expert at troubleshooting OAuth issues.
      You are given an error message and a query.
      You are to determine if the error and query appear to be unfixable.
      HINT: The agent keeps trying the same thing over and over again or there appears to be an issue outside the tools environment (user account, provider settings, invalid credentials, etc.)
      Error: 
      ${currentError}
      Query: 
      ${query}
      ${
        messages && messages.length > 0
          ? `
        Processing attempt history and results.: 
        ${messages
          .map(
            (message) =>
              `URL: ${message.url}\nMethod: ${
                message.method
              }\nBody: ${JSON.stringify(
                message.body
              )}\nHeaders: ${JSON.stringify(message.headers)}\nPlatform: ${
                message.platform
              }\nUser ID: ${message.userId}\nResult: ${
                message.result
              }\nError: ${message.error}`
          )
          .join("\n")}`
          : ""
      }
      `,
      schema: z
        .object({
          unfixable: z.boolean(),
          reason: z
            .string()
            .describe("A short explanation for the unfixable status"),
        })
        .required({
          unfixable: true,
          reason: true,
        }),
    });
    if (_quickModelCheck.object.unfixable) {
      return {
        error: true,
        details: `The error ${currentError} and query ${query} appear to be unfixable. ${_quickModelCheck.object.reason}`,
      };
    }
  }

  _research = await _researchIssues(
    query,
    currentError,
    messages.map((message) => message.error).join("\n"),
    iteration,
    iterationLimit
  );

  // Generate prompt for AI model
  const prompt = `
    <purpose>
        You are an OAuth troubleshooting expert. Your task is to analyze failed API requests and suggest corrected parameters for a successful retry.
    </purpose>

    <instructions>
        <instruction>Analyze the failed request parameters and error message</instruction>
        <instruction>Review previous attempts to avoid repeating failed approaches</instruction>
        <instruction>Consider platform-specific requirements for ${platform}</instruction>
        <instruction>Suggest new request parameters that address the error</instruction>
        <instruction>Do not include authorization code - tokens are handled automatically</instruction>
    </instructions>

    <context>
        <failed-request>
            URL: ${query.match(/<url>(.*?)<\/url>/)?.[1]}
            Method: ${query.match(/<method>(.*?)<\/method>/)?.[1]}
            Body: ${query.match(/<body>(.*?)<\/body>/)?.[1]}
            Headers: ${query.match(/<headers>(.*?)<\/headers>/)?.[1]}
        </failed-request>
        
        <error-message>${currentError}</error-message>
        ${_research ? `<research-findings>${_research}</research-findings>` : ''}
    </context>

    <previous-attempts>
        ${messages.map(m => `
        <attempt>
            <url>${m.url}</url>
            <method>${m.method}</method>
            <result>${m.result || 'failed'}</result>
            <error>${m.error || 'none'}</error>
        </attempt>
        `).join('')}
    </previous-attempts>

    <output-requirements>
        Provide new request parameters as a JSON object with:
        - url: string
        - method: "GET" | "POST" | "PUT" | "DELETE"
        - body: string (optional)
        - headers: object (optional, excluding auth headers)
    </output-requirements>
  `;

  // Generate new request parameters using AI
  const _newProps = await generateObject({
    model:
      iteration > iterationLimit / 2
        ? await MODEL_getModel_ai(getWorkModels()[1])
        : await MODEL_getModel_ai(getWorkModels()[0]),
    prompt: prompt,
    schema: z.object({
      newProps: z.object({
        url: z.string(),
        method: z.enum(["GET", "POST", "PUT", "DELETE"]),
        body: z
          .string()
          .optional()
          .describe(
            "The body of the request. If the method is GET, this should be empty."
          ),
        headers: z
          .string()
          .optional()
          .describe(
            "The headers of the request. Bearer token not needed as it will be added automatically."
          ),
      }),
    }),
  });

  // Make the fetch request with new parameters
  const _functionResult: string | { error: boolean; details: string } =
    await TOOLFUNCTION_makeFetchRequest(
      _newProps.object.newProps.url,
      _newProps.object.newProps.method,
      _newProps.object.newProps.body,
      _newProps.object.newProps.headers,
      platform,
      userId,
      "json",
      fileStore,
      vc
    );

  // Handle error case
  if (typeof _functionResult === "object" && _functionResult.error) {
    if (iteration < iterationLimit) {
      // Research the error and try again
      //_research = await _researchIssues(query, currentError, messages.map(message => message.error).join("\n"));
      props.messages.push({
        url: _newProps.object.newProps.url,
        method: _newProps.object.newProps.method,
        body: _newProps.object.newProps.body,
        headers: _newProps.object.newProps.headers,
        platform: platform,
        userId: userId,
        result: undefined,
        error: _functionResult.details,
        research: _research || undefined,
      });
      return TOOLFUNCTION_iterateAuthToolProcessUntilSuccess(
        _functionResult.details,
        props,
        iteration + 1,
        fileStore,
        vc
      );
    } else {
      // Summarize process and return error if iteration limit reached
      await AUTH_TOOL_summarizeProcessResults(props.messages, platform);
      return {
        error: true,
        details: _functionResult.details,
      };
    }
  } else {
    // Handle success case
    props.messages.push({
      url: _newProps.object.newProps.url,
      method: _newProps.object.newProps.method,
      body: _newProps.object.newProps.body,
      headers: _newProps.object.newProps.headers,
      platform: platform,
      userId: userId,
      result: (_functionResult as { details: string }).details || undefined,
      error: undefined,
      research: _research || undefined,
    });
    await AUTH_TOOL_summarizeProcessResults(props.messages, platform);
    return _functionResult;
  }
}
