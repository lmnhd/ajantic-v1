import modelsData from "@/src/app/api/model/vercel_models.json";
import { ModelProviderEnum, ModelArgs } from "./types";

export function UTILS_getModelsJSON() {
 // const modelsData = require('@/src/app/api/model/vercel_models.json');
  return modelsData;
}

export const MODEL_JSON = () => {
  return UTILS_getModelsJSON();
};

// Helper function to map JSON provider keys (potentially title case) to ModelProviderEnum values (uppercase)
function mapJsonProviderKeyToEnum(jsonKey: string): ModelProviderEnum {
  const upperKey = jsonKey.toUpperCase();
  // Find the enum member whose value matches the uppercased key
  // ModelProviderEnum values are themselves uppercase strings e.g. ModelProviderEnum.OPENAI is "OPENAI"
  const enumMember = Object.values(ModelProviderEnum).find(
    (value) => value === upperKey
  );
  return enumMember || ModelProviderEnum.OPENAI; // Default to OPENAI if no match found
}

export const UTILS_getModelArgsByName = (modelName: string, temperature: number = 0): ModelArgs => {
  // Find which provider has this model
  const modelsData = MODEL_JSON();
  for (const providerKeyFromJson in modelsData) { // providerKeyFromJson is the key like "OpenAI", "Anthropic"
    const providerData = modelsData[providerKeyFromJson as keyof typeof modelsData];
    if (modelName in providerData) {
      return {
        modelName: modelName,
        provider: mapJsonProviderKeyToEnum(providerKeyFromJson), // Use the helper to get correct enum value
        temperature: temperature
      };
    }
  }
  
  // Default if model not found
  return {
    modelName: modelName,
    provider: ModelProviderEnum.OPENAI, // Default correctly uses the enum member
    temperature: temperature
  };
};

export const MODEL_getModelArgsByName = (modelName: string, temperature: number = 0): ModelArgs => {
  return UTILS_getModelArgsByName(modelName, temperature);
};

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  AGENT_TOOLS_EMULATOR,
  AgentComponentProps,
  AgentFoundationalPromptProps,
  AgentTypeEnum,
  AI_Agent_Tools,
  AI_Agent_ToolsDescription,
  AISessionState,
  AppState,
  GlobalMessages,
  AppFrozenState,
  ContextContainerProps,
  ServerMessage,
} from "./types";
// Remove imports of model modules to avoid circular dependencies
// import { AnthropicModelNames } from "@/src/app/api/model/anthropic";
// import { MistralModelNames } from "@/src/app/api/model/mistral";
// import { CohereModelNames } from "@/src/app/api/model/cohere";
// import { GoogleGenerativeAIModelNames } from "@/src/app/api/model/google";
// import { OpenAIModelNames } from "@/src/app/api/model/openai";

import { BaseMessage, MessageType } from "@langchain/core/messages";
import { AGENT_GLOBAL_PROMPTS } from "./prompts/agent-global";

import {
  AGENT_TOOLS_EMULATOR_pinecone,
  AGENT_TOOLS_pinecone,
} from "./agent-tools/pinecone-db/pinecone";

import { AGENT_TOOLS_EMULATOR_word } from "./agent-tools/word-tools";

import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { openai } from "@ai-sdk/openai";
import { Embeddings } from "@langchain/core/embeddings";
import { OpenAIEmbeddings } from "@langchain/openai";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export const matcher = /(?<=\[Summary:)\s+(.*)(?=])/g;
export const chorusRegEx = /(\Chorus\(?=\n\n\[|\[C.*)/g;
//export const titleRegEx = /\[Title - (.+?)\]/g;
//export const titleRegEx = /\[Title - (.+?)\]/g;
export const titleRegEx = /(?!\[) (.+?)(?=\])/g;

export const UTILS_cleanTitle = (title: string) => {
  if (!title) return "";
  return title.replace("[Title - ", "").replace("]", "");
};

export const UTILS_codeTitle = (title: string) => {
  if (!title) return "";
  return `[Title - ${title}]`;
};

export const ValueType = {
  STRING: "string" as const,
  NUMBER: "number" as const,
  BOOLEAN: "boolean" as const,
  OBJECT: "object" as const,
  ARRAY: "array" as const,
  NULL: "null" as const,
  UNDEFINED: "undefined" as const,
  DATE: "date" as const,
  ENUM: "enum" as const,
  FILE: "file" as const,
  ENUM_OR_CUSTOM: "enum_or_custom" as const,
} as const;

export const UTILS_getRandomRGBColorString = (formatAsFunction: boolean) => {
  const r = Math.floor(Math.random() * 256);
  //const g = Math.floor(Math.random() * 256);
  //const b = Math.floor(Math.random() * 256);
  const g = 30;
  const b = 30;
  return formatAsFunction
    ? `rgb(${r},${g},${b}, 0.527)`
    : `${r},${g},${b}, 0.397`;
};

export const UTILS_startLoading = (
  currentAppState: AppState,
  message: string
) => {
  return {
    ...currentAppState,
    loading: true,
    loadingMessage: message,
  };
};

export const UTILS_stopLoading = (currentAppState: AppState) => {
  return {
    ...currentAppState,
    loading: false,
    loadingMessage: "",
  };
};

export const UTILS_updateModelNameAfterProviderChange = (
  provider: ModelProviderEnum
) => {
  console.log("provider changed", provider);

  switch (provider) {
    case ModelProviderEnum.OPENAI:
      console.log("openai");
      return Object.keys(modelsData.OpenAI)[0];
      break;
    case ModelProviderEnum.ANTHROPIC:
      return Object.keys(modelsData.Anthropic)[0];
    case ModelProviderEnum.MISTRAL:
      return Object.keys(modelsData.Mistral)[0];
    case ModelProviderEnum.COHERE:
      return Object.keys(modelsData.Cohere)[0];
    case ModelProviderEnum.GOOGLE_G:
      return Object.keys(modelsData.Google)[0];
      break;
    case ModelProviderEnum.BEDROCK:
      return "amazon.titan-tg1-large";
    default:
      break;
  }
};

export const UTILS_putGenericData = (
  genericData: any,
  nameOfObject: string,
  globalMessages: GlobalMessages
) => {
  //console.log("UTILS_putGenericData", genericData, nameOfObject, globalMessages);

  try {
    if (!globalMessages.currentState.genericData) {
      globalMessages.currentState.genericData = {};
    }

    globalMessages.currentState.genericData[nameOfObject] = genericData;

    return globalMessages;
  } catch (error) {
    console.error("Error storing generic data:", error);
    return globalMessages;
  }
};

export const UTILS_getGenericData = (
  nameOfObject: string,
  globalMessages: GlobalMessages
) => {
  try {
    const _data = globalMessages.currentState.genericData;
    if (!_data) return null;
    return _data[nameOfObject];
  } catch (error) {
    console.error("Error retrieving generic data:", error);
    return null;
  }
};

export const UTILS_setServerMessagesCurrentState = (
  messages: ServerMessage[],
  currentState: AISessionState
): ServerMessage[] => {
  if (!messages) {
    console.log(
      "UTILS_setServerMessagesCurrentState-NO-MESSAGES",
      messages,
      currentState
    );
    return [];
  }
  if (!currentState) {
    console.log(
      "UTILS_setServerMessagesCurrentState-NO-CURRENT-STATE",
      messages,
      currentState
    );
    return messages;
  }
  if (messages.length === 0) {
    console.log(
      "UTILS_setServerMessagesCurrentState-MESSAGES-LENGTH-0",
      messages,
      currentState
    );
    return messages;
  }
  const lastMessage: ServerMessage = messages[
    messages.length - 1
  ] as ServerMessage;
  lastMessage.currentState = JSON.stringify(currentState);
  return [...messages.slice(0, -1), lastMessage] as ServerMessage[];
};

export const UTILS_convertLineSetsToContext = (
  contextSets: ContextContainerProps[],
  agentName: string
): string => {
  //console.log("UTILS_convertLineSetsToContext", contextSets, agentName);
  return contextSets
    .filter((set) => !set.isDisabled)
    .filter((set) => !set.hiddenFromAgents?.includes(agentName))
    .map(
      (set) => `
    <${set.setName}>
            ${
              set.text
                ? set.text
                : set.lines?.map((line) => line.content).join("\n")
            }
    </${set.setName}>`
    )
    .join("\n");
};

export async function UTILS_convertServerMessagesToBaseMessages(
  messages: ServerMessage[]
): Promise<BaseMessage[]> {
  return messages.map(
    (m) =>
      ({
        type: m.role as MessageType,
        content: `${
          m.agentName && m.role === "assistant" ? m.agentName + ": " : ""
        }${m.content}`,
      } as unknown as BaseMessage)
  );
}

// utility function to get random color values
export const UTILS_getRandomColor = (opacity: number = 0.5) => {
  return `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(
    Math.random() * 255
  )}, ${Math.floor(Math.random() * 255)}, ${opacity})`;
};

// utility function to get random tailwind color values
export const UTILS_getRandomTailwindColor = () => {
  const colors = [
    "indigo",
    "emerald",
    "teal",
    "cyan",
    "sky",
    "violet",
    "purple",
    "fuchsia",
    "pink",
    "rose",
    "violet",
    "orange",
    "yellow",
    "gray",
    "slate",
    "zinc",
    "neutral",
    "stone",
    "red",
    "green",
    "blue",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

// utiltiy function to get ALL available tools descriptions
export const UTILS_getAllAvailableToolsDescriptions = (toolNames?: string[]) => {
  const _allTools = Object.values(AI_Agent_Tools).filter((tool) => 
    tool !== AI_Agent_Tools.AGENT_GLOBAL_STATE && 
    tool !== AI_Agent_Tools.CONTEXT_SETS && 
    tool !== AI_Agent_Tools.GMAIL
  );
  
  // Create a new implementation that returns an array of descriptions
  const result: AI_Agent_ToolsDescription[] = [];
  _allTools.forEach(tool => {
    const descriptions: AI_Agent_ToolsDescription[] = [];
    
    switch(tool) {
      case AI_Agent_Tools.PINECONE:
        descriptions.push({
          group: "PINECONE",
          name: "PINECONE_search",
          description: "Search for chunks of text in a Pinecone Vector Database using semantic similarity. Returns matches based on query and optional metadata filters.",
        });
        descriptions.push({
          group: "PINECONE",
          name: "PINECONE_store",
          description: "Index documents and store chunks of text in a Pinecone Vector Database with custom metadata. Enables semantic search capabilities.",
        });
        descriptions.push({
          group: "PINECONE",
          name: "PINECONE_deleteVectorsById",
          description: "Delete specific vectors from a Pinecone index by their IDs. Allows precise removal of stored data from a specific namespace.",
        });
        descriptions.push({
          group: "PINECONE",
          name: "PINECONE_createIndex",
          description: "Create a new Pinecone index with specified configurations. Used to initialize a new vector storage collection.",
        });
        descriptions.push({
          group: "PINECONE",
          name: "PINECONE_deleteIndex",
          description: "Delete an entire Pinecone index by name. Permanently removes all vectors and data in the specified index.",
        });
        break;
      case AI_Agent_Tools.DATABASE:
        descriptions.push({
          group: "DATABASE",
          name: "DB_storeData",
          description: "Store data in the database with a unique key in the agent's namespace. Creates a new record or updates an existing one if the key already exists.",
        });
        descriptions.push({
          group: "DATABASE",
          name: "DB_getData",
          description: "Retrieve data from the database by key. Returns the stored data along with metadata including creation and update timestamps.",
        });
        descriptions.push({
          group: "DATABASE",
          name: "DB_queryData",
          description: "Search for multiple data entries from the database by namespace and optional metadata. Useful for finding all related entries.",
        });
        descriptions.push({
          group: "DATABASE",
          name: "DB_deleteData",
          description: "Remove data from the database by ID. Permanently deletes the specified record.",
        });
        descriptions.push({
          group: "DATABASE",
          name: "DB_createTable",
          description: "Define a virtual table schema with specific field types. Creates a structured way to store related data items.",
        });
        descriptions.push({
          group: "DATABASE",
          name: "DB_insertRow",
          description: "Add data to a virtual table following its schema. Inserts a new row into the specified table.",
        });
        descriptions.push({
          group: "DATABASE",
          name: "DB_queryTable",
          description: "Retrieve rows from a virtual table. Returns all data matching the specified criteria.",
        });
        break;
      case AI_Agent_Tools.WORD:
        descriptions.push({
          group: "WORD",
          name: "WORD_randomWord",
          description: "Retrieve a random word from song lyrics in the research database. Useful for creative inspiration and language exploration.",
        });
        descriptions.push({
          group: "WORD",
          name: "WORD_randomLines",
          description: "Retrieve random lyric lines from the research database. Returns a specified number of lines for reference or inspiration.",
        });
        descriptions.push({
          group: "WORD",
          name: "WORD_randomBlock",
          description: "Retrieve a random verse or chorus block from songs in the research database. Useful for studying song structure and lyrical patterns.",
        });
        descriptions.push({
          group: "WORD",
          name: "WORD_similarLines",
          description: "Find lines similar to a given input line based on semantic meaning. Helps discover related content and concepts in the lyric database.",
        });
        descriptions.push({
          group: "WORD",
          name: "WORD_rhymeFinder",
          description: "Find words that rhyme with a given input word. Returns rhyming options for creative writing and lyric composition.",
        });
        descriptions.push({
          group: "WORD",
          name: "WORD_wordFinder",
          description: "Find synonyms and related words for a given input word. Helps expand vocabulary options when writing lyrics.",
        });
        break;
      case AI_Agent_Tools.PERPLEXITY:
        descriptions.push({
          group: "PERPLEXITY",
          name: "perplexity",
          description: "Perform web searches using Perplexity AI to get up-to-date information. Retrieves relevant information from the internet with source attribution.",
        });
        break;
      case AI_Agent_Tools.URL_SCRAPE:
        descriptions.push({
          group: "URL_SCRAPE",
          name: "URL_SCRAPE_scrapeAndSummarizeUrl",
          description: "Scrape a URL and generate a summarized version of its content. Extracts the primary information while removing ads and navigation elements.",
        });
        descriptions.push({
          group: "URL_SCRAPE",
          name: "URL_SCRAPE_scrapeUrl",
          description: "Scrape a URL and return its raw content in markdown format. Retrieves the full textual content of a webpage.",
        });
        descriptions.push({
          group: "URL_SCRAPE",
          name: "URL_SCRAPE_crawlUrl",
          description: "Crawl a URL and return information about all linked pages. Collects page titles and URLs from connected pages.",
        });
        break;
      case AI_Agent_Tools.DOCUMENT_PARSE:
        descriptions.push({
          group: "DOCUMENT_PARSE",
          name: "DOCUMENT_PARSE_pdf",
          description: "Extract and parse content from PDF documents. Converts PDF content into structured text for analysis.",
        });
        descriptions.push({
          group: "DOCUMENT_PARSE",
          name: "DOCUMENT_PARSE_docx",
          description: "Extract and parse content from Word documents. Converts DOCX content into structured text for analysis.",
        });
        break;
      case AI_Agent_Tools.FETCH:
        descriptions.push({
          group: "FETCH",
          name: "URL_fetch",
          description: "Fetch the contents of a given URL with optional HTTP method and headers. Returns a stringified JSON response for natural language readability.",
        });
        break;
      case AI_Agent_Tools.OAUTH_PROVIDER:
        descriptions.push({
          group: "OAUTH_PROVIDER",
          name: "OAUTH_PROVIDER_isAuthorized",
          description: "Check if the user is authorized to use a specific platform (Google, Microsoft, LinkedIn, etc.). Verifies authentication status for OAuth connections.",
        });
        descriptions.push({
          group: "OAUTH_PROVIDER",
          name: "OAUTH_PROVIDER_makeFetchRequest",
          description: "Make authenticated API requests to external platforms with automatic token handling. Supports various HTTP methods and custom headers.",
        });
        descriptions.push({
          group: "OAUTH_PROVIDER",
          name: "OAUTH_PROVIDER_queryAPIHelp",
          description: "Get documentation and help information about platform APIs. Retrieves relevant technical information about specific platform features.",
        });
        descriptions.push({
          group: "OAUTH_PROVIDER",
          name: "OAUTH_PROVIDER_fixProcessingErrors",
          description: "Automatically fix API processing errors by analyzing error messages and suggesting corrections. Improves success rate of API interactions.",
        });
        descriptions.push({
          group: "OAUTH_PROVIDER",
          name: "OAUTH_PROVIDER_parseFile",
          description: "Parse files and chunk text into memory vector store. Processes documents from external services for analysis and search.",
        });
        descriptions.push({
          group: "OAUTH_PROVIDER",
          name: "OAUTH_PROVIDER_queryDocumentChunks",
          description: "Search stored document chunks with semantic queries. Find relevant information in previously processed documents.",
        });
        descriptions.push({
          group: "OAUTH_PROVIDER",
          name: "OAUTH_PROVIDER_getNextChunks",
          description: "Retrieve sequential chunks from stored documents. Access document content in order for continuous reading or analysis.",
        });
        break;
      case AI_Agent_Tools.FILE_STORE:
        descriptions.push({
          group: "FILE_STORE",
          name: "FILE_STORE_storeFileToCloud",
          description: "Store a file to a virtual storage space. Handles uploading and organizing binary data like images, documents, and other file types with proper content type handling. Returns the file URL for retrieval.",
        });
        break;
      case AI_Agent_Tools.PUPPETEER:
        descriptions.push({
          group: "PUPPETEER",
          name: "PUPPETEER_goto",
          description: "Navigate to a specific URL in a headless browser. Opens web pages for automated interaction and content extraction.",
        });
        descriptions.push({
          group: "PUPPETEER",
          name: "PUPPETEER_click",
          description: "Click on an element in the current web page using CSS selectors. Interacts with buttons, links, and other clickable elements.",
        });
        descriptions.push({
          group: "PUPPETEER",
          name: "PUPPETEER_getContent",
          description: "Extract the HTML or text content from the current web page. Can return either raw HTML or cleaned text format.",
        });
        descriptions.push({
          group: "PUPPETEER",
          name: "PUPPETEER_select",
          description: "Select an option from a dropdown menu on the current web page. Works with form select elements using CSS selectors.",
        });
        descriptions.push({
          group: "PUPPETEER",
          name: "PUPPETEER_type",
          description: "Type text into an input field on the current web page. Enters text into form fields and search boxes using CSS selectors.",
        });
        descriptions.push({
          group: "PUPPETEER",
          name: "PUPPETEER_waitForSelector",
          description: "Wait for a specific element to appear on the page before proceeding. Useful for dynamically loaded content and SPAs.",
        });
        break;
      case AI_Agent_Tools.KNOWLEDGE_BASE:
        descriptions.push({
          group: "KNOWLEDGE_BASE",
          name: "KNOWLEDGE_BASE_storeKnowledge",
          description: "Store information in the agent's knowledge base for later retrieval. Supports tags and titles for better organization and searchability.",
        });
        descriptions.push({
          group: "KNOWLEDGE_BASE",
          name: "KNOWLEDGE_BASE_queryKnowledge",
          description: "Query the agent's knowledge base to retrieve relevant information. Supports filtering by tags and limiting the number of results.",
        });
        descriptions.push({
          group: "KNOWLEDGE_BASE",
          name: "KNOWLEDGE_BASE_deleteKnowledge",
          description: "Delete a specific entry from the agent's knowledge base. Removes outdated or incorrect information by ID.",
        });
        descriptions.push({
          group: "KNOWLEDGE_BASE",
          name: "KNOWLEDGE_BASE_clearKnowledge",
          description: "Clear all entries from the agent's knowledge base. Completely resets the agent's persistent memory storage.",
        });
        break;
      case AI_Agent_Tools.TEXT_SPLITTER:
        descriptions.push({
          group: "TEXT_SPLITTER",
          name: "TEXT_SPLITTER_splitter",
          description: "Split text into smaller, manageable chunks with configurable size and overlap. Stores the resulting chunks in local storage for later use.",
        });
        break;
      case AI_Agent_Tools.CREATE_REFERENCE_DOCUMENT:
        descriptions.push({
          group: "CREATE_REFERENCE_DOCUMENT",
          name: "REFERENCE_DOCUMENT_generate",
          description: "Generate a reference document for a given tool, technique, or process. Creates documents like cheat sheets or guides with specified content length and scope.",
        });
        break;
      case AI_Agent_Tools.DYNAMIC_SCRIPT:
        descriptions.push({
          group: "DYNAMIC_SCRIPT",
          name: "DYNAMIC_SCRIPT_ANALYZE_REQUIREMENTS",
          description: "Analyze requirements for a dynamic script, identifying necessary information and determining technical feasibility.",
        });
        descriptions.push({
          group: "DYNAMIC_SCRIPT",
          name: "DYNAMIC_SCRIPT_CREATE_AND_EXECUTE",
          description: "Create and execute a dynamic script with full validation. Generates custom JavaScript to solve specific tasks and runs it with error handling.",
        });
        descriptions.push({
          group: "DYNAMIC_SCRIPT",
          name: "DYNAMIC_SCRIPT_SAVE_SCRIPT",
          description: "Save a script to the database for future use. Stores the script with a name, description, and optional parameters.",
        });
        descriptions.push({
          group: "DYNAMIC_SCRIPT",
          name: "DYNAMIC_SCRIPT_DELETE_SCRIPT",
          description: "Delete a previously saved script from the database. Permanently removes the script by name.",
        });
        descriptions.push({
          group: "DYNAMIC_SCRIPT",
          name: "DYNAMIC_SCRIPT_GET_SCRIPT",
          description: "Get a previously saved script from the database. Retrieves the script content by name for execution or reference.",
        });
        break;
      // case AI_Agent_Tools.AUTO_GEN_TOOL:
        descriptions.push({
          group: "AUTO_GEN_TOOL",
          name: "AUTO_GEN_TOOL_create",
          description: "Automatically generate custom tools based on requirements. Creates specialized tools for specific tasks.",
        });
        break;
      case AI_Agent_Tools.DOCUMENT_PROCESSOR:
        descriptions.push({
          group: "DOCUMENT_PROCESSOR",
          name: "DOCUMENT_PROCESSOR_processDocument",
          description: "Process and analyze documents using AI with multiple analysis types (summary, insights, key information, sentiment) and depth options (standard, deep). Extracts key information, generates insights, and can save results to the database for future reference. Perfect for understanding complex documents, identifying patterns, extracting critical data points, and analyzing tone.",
        });
        break;
      case AI_Agent_Tools.VIDEO_GEN:
        descriptions.push({
          group: "VIDEO_GEN",
          name: "VIDEO_RUNWAY_generateVideo",
          description: "Generate a video using Runway's Gen-2 model based on a text prompt. Supports customization of frame count, resolution, and other parameters.",
        });
        descriptions.push({
          group: "VIDEO",
          name: "VIDEO_RUNWAY_composeVideo",
          description: "Compose a video with text overlays and voice narration. Supports adding text, voice, and background music to videos.",
        });
        break;
      default:
        // For any other tools not explicitly handled, add a generic description
        descriptions.push({
          group: String(tool),
          name: String(tool),
          description: `Provides specialized functionality for ${String(tool).toLowerCase().replace(/_/g, ' ')} operations.`,
        });
        break;
    }
    
    // Add descriptions to result
    result.push(...descriptions);
  });
  
  // If toolNames is provided, filter the results
  if (toolNames && toolNames.length > 0) {
    return result.filter(tool => toolNames.includes(tool.name));
  }
  
  return result;
};

// utiltiy function to get ALL available tools by group name
export const UTILS_getAllAvailableToolsByGroup = (group: string) => {
  const _allTools = UTILS_getAllAvailableToolsDescriptions();
  return _allTools.filter((tool) => tool.group === group).map((tool) => tool.name).join("\n");
};

// utility function to get ALL available tool group names
export const UTILS_getAllAvailableToolGroups = (): string[] => {
  const _allTools = UTILS_getAllAvailableToolsDescriptions();
  return Array.from(new Set(_allTools.map(tool => tool.group)));
};

export const UTILS_getTodayDateString = () => {
  const _date = new Date();
  return `${_date.getFullYear()}-${_date.getMonth() + 1}-${_date.getDate()}`;
};

export const UTILS_loadAgentGlobalPrompt = async (
  foundationalProps: AgentFoundationalPromptProps,
  agent: AgentComponentProps,
  agentType: AgentTypeEnum,
  message: string
) => {
  if (UTILS_isToolAgent(agentType)) {
    return await AGENT_GLOBAL_PROMPTS.PROMPT_AGENT_toolOperator(
      message,
      foundationalProps.userName,
      foundationalProps.userId,
      agent,
      foundationalProps.teamName,
      foundationalProps.skillSet,
      foundationalProps.role,
      agent.tools || [],
      foundationalProps.peerAgents,
      foundationalProps.directives,
      foundationalProps.context,
      foundationalProps.mission,
      agent.training || false,
      agent.hasKnowledgeBase || false
    );
  }
  return await AGENT_GLOBAL_PROMPTS.PROMPT_AGENT_foundationalPrompt2(
    message,
    foundationalProps.userName,
    foundationalProps.userId,
    agent,
    foundationalProps.teamName,
    foundationalProps.skillSet,
    foundationalProps.role,
    agent.tools || [],
    foundationalProps.peerAgents,
    foundationalProps.directives,
    foundationalProps.context,
    foundationalProps.mission,
    agent.training || false,
    agent.hasKnowledgeBase || false
  );
};

// TOOL OR TASK AGENT
export function UTILS_isToolAgent(agentType: AgentTypeEnum) {
  return (
    agentType === AgentTypeEnum.CONTEXT_MANAGER ||
    agentType === AgentTypeEnum.RECORDS ||
    agentType === AgentTypeEnum.TOOL_OPERATOR ||
    agentType === AgentTypeEnum.DYNAMIC_TOOL
  );
}

export function UTILS_serverMessagesToTranscript(messages: ServerMessage[]) {
  let _useContext = 0;
  const tranScriptWithNames = messages
    .map((m) => {
      let _addedContext = "";
      if (
        ((m.content.toLowerCase().includes("context") && m.role === "user") ||
          _useContext > 0) &&
        m.currentState
      ) {
        console.log("UTILS_serverMessagesToTranscript-CONTEXT", m.content);
        const _state: AISessionState = JSON.parse(m.currentState ?? "{}");
        const _context = UTILS_convertLineSetsToContext(
          _state.contextSet.sets ?? [],
          ""
        );
        _addedContext = `\n\n<PROJECT_CONTEXT>\n${_context}\n</PROJECT_CONTEXT>`
      }
      return `${m.role}: ${m.content}${_addedContext}`;
    })
    .join("\n");
  return tranScriptWithNames;
}

// export const UTILS_cleanNewlines = (text: string): string => {
//   // Replace 3 or more newlines with 2 newlines
//   return text.replace(/\n{3,}/g, '\n\n').trim();
// };

// // clears the state variables in a conversation
// export const UTILS_cleanConversationForStorage = (conversation: ServerMessage[]) => {
//   return conversation.map((m) => {
//     return {
//       ...m,
//       currentState: "",
      
//     } as ServerMessage;
//   });
// };
export function UTILS_extractAgentNamesFromConversation(
  messages: ServerMessage[]
) {
  const agentNames = messages
    .flatMap((m) => {
      const names = [m.agentName];
      if (m.subMessages) {
        names.push(...m.subMessages.map((sub) => sub.agentName));
      }
      return names;
    })
    .filter((name): name is string => !!name);
  return Array.from(new Set(agentNames));
}

export async function UTILS_getObjectKeysOfLoadedTools(
  tools: object | any,
  
) {
  return Object.keys(tools);
}

export function UTILS_getAgentToolsEmulatorsByName(
  toolName: AI_Agent_Tools,
  contextSets?: ContextContainerProps[],
  vectorStore?: MemoryVectorStore,
  state?: AISessionState
): { name: string; tools: AGENT_TOOLS_EMULATOR[] } | null {
  switch (toolName) {
    // case AI_Agent_Tools.CONTEXT_SETS: {
    //   return {
    //     name: toolName,
    //     tools: AGENT_TOOLS_EMULATOR_contextSets(
    //       contextSets
    //         ? contextSets
    //         : [
    //             {
    //               text: "getAgentToolByNameCalledWithoutLineSets",
    //               setName: "Uh-Oh!",
    //               lines: [],
    //               isDisabled: false,
    //             },
    //           ]
    //     ),
    //   };
    // }
    case AI_Agent_Tools.WORD: {
      return { name: toolName, tools: AGENT_TOOLS_EMULATOR_word() };
    }
    case AI_Agent_Tools.PINECONE: {
      return { name: toolName, tools: AGENT_TOOLS_EMULATOR_pinecone(state!) };
    }
    default:
      return null;
  }
}

export function UTILS_setGlobalStateSaveProps(
  appFrozenState: AppFrozenState
) {}

export const UTILS_cleanNewlines = (text: string): string => {
  // Replace 3 or more newlines with 2 newlines
  return text.replace(/\n{3,}/g, '\n\n').trim();
};

// clears the state variables in a conversation
export const UTILS_cleanConversationForStorage = (conversation: ServerMessage[]) => {
  return conversation.map((m) => {
    return {
      ...m,
      currentState: "",
      
    } as ServerMessage;
  });
};

// Corrected Definition: An async function that returns a Promise resolving to an Embeddings instance
export const UTILS_getEmbeddings = async (): Promise<Embeddings> => {
  return new OpenAIEmbeddings({
    modelName: "text-embedding-3-small", // Or your desired model
    apiKey: process.env.OPENAI_API_KEY,
    // Consider adding batchSize for efficiency if embedding many docs later
    // batchSize: 512,
  });
};

// --- START: Functions moved from autogen.ts ---

export const AUTOGEN_getModelList = (stringOrArray: "string" | "array") => {
  // Assuming UTILS_getModelArgsByName and UTILS_getModelsJSON are available here or imported
  const model1 = UTILS_getModelArgsByName(
    UTILS_getModelsJSON().Anthropic["claude-3-5-sonnet-20240620"].name
  );
  const model2 = UTILS_getModelArgsByName(
    UTILS_getModelsJSON().Anthropic["claude-3-7-sonnet-20250219"].name
  );
  const model3 = UTILS_getModelArgsByName(
    UTILS_getModelsJSON().OpenAI["gpt-4.5-preview"].name
  )
  const model4 = UTILS_getModelArgsByName(
    UTILS_getModelsJSON().OpenAI["gpt-4o-mini"].name
  );
  const model5 = UTILS_getModelArgsByName(
    UTILS_getModelsJSON().OpenAI["gpt-4o"].name
  );
  const model6 = UTILS_getModelArgsByName(
    UTILS_getModelsJSON().OpenAI["gpt-3.5-turbo"].name
  );
  const model7 = UTILS_getModelArgsByName(
    UTILS_getModelsJSON().Cohere["command-r-plus"].name
  );
  const model8 = UTILS_getModelArgsByName(
    UTILS_getModelsJSON().Mistral["mistral-large-latest"].name
  );
  const model9 = UTILS_getModelArgsByName(
    UTILS_getModelsJSON().Mistral["open-mistral-7b"].name
  );
  const model10 = UTILS_getModelArgsByName(
    UTILS_getModelsJSON().DeepSeek["deepseek-reasoner"].name
  );
  const model11 = UTILS_getModelArgsByName(
    UTILS_getModelsJSON().Google["models/gemini-1.5-pro-latest"].name
  );
  const model12 = UTILS_getModelArgsByName(
    UTILS_getModelsJSON().Google["models/gemini-2.5-pro-exp-03-25"].name
  );

  const allModels = [
      model1, model2, model3, model4, model5, model6,
      model7, model8, model9, model10, model11, model12
  ].filter(model => model !== undefined && model !== null) as ModelArgs[]; // Filter out potential undefined results and assert type

  return stringOrArray === "string"
    ? allModels.map((model) => `${model.provider}/${model.modelName}`).join("\n")
    : allModels;
};

export const mapToFullModelName = (shortName: string): string => {
    // Map for common short names to their full versions
    const modelNameMap: Record<string, string> = {
      "claude-3-7-sonnet": "claude-3-7-sonnet-20250219",
      "claude-3-5-sonnet": "claude-3-5-sonnet-20240620",
      "gpt-4o": "gpt-4o",
      "gpt-4.5": "gpt-4.5-preview",
      "gemini-1.5-pro": "models/gemini-1.5-pro-latest",
      "gemini-2.5-pro": "models/gemini-2.5-pro-exp-03-25"
      // Add more mappings if needed
    };
    
    // Return the mapped value if it exists, otherwise return the original
    return modelNameMap[shortName] || shortName;
};

// --- END: Functions moved from autogen.ts ---

