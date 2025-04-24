import { AnthropicModelNames } from "@/src/app/api/model/anthropic";
import { CohereModelNames } from "@/src/app/api/model/cohere";
import {
  GoogleGenerativeAIModelNames,
  GoogleVertexModelNames,
} from "@/src/app/api/model/google";
import { MistralModelNames } from "@/src/app/api/model/mistral";
import { BlockLyricType } from "@/components/songeditor/lyric/block";
import {
  FuncProps,
  RuleProps,
} from "@/components/songeditor/lyric/functionpanel";
// import { LineLyricType } from "@/components/songeditor/lyric/line";
import { User } from "@clerk/nextjs/server";

import { AILyrics, Conversation, GeneralPurpose } from "@prisma/client";
import { Message } from "ai";
import { ClientMessage } from "./aicontext";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { ChainValues } from "@langchain/core/utils/types";
import { PostMessageAnalysisProps } from "./analysis_server";
// import { PostMessageAnalysisProps } from "./research-analysis/analysis_server";
// import { TextChatLogProps } from "./research-analysis/lib/text-chat-log";
// import { DeepSeekModelNames } from "@/src/app/api/model/deepseek";
// import { DynamicFormSchema } from "./research-analysis/post-message-analysis/form-creator-core";
// import { BedrockModelNames } from "@/src/app/api/model/bedrock";
import { OrchestrationType2 } from "./orchestration/types/base";

export type Top100Songs = {
  title: string;
  artist: string;
  rank: number;
  img: string;
}[];

export type FoundSong = {
  title: string;
  artist: string;
  img: string;
};

export type FoundArtist = {
  name: string;
  img: string;
};

export type FoundAlbum = {
  name: string;
  artist: string;
  img: string;
};

export type FoundTopHit = {
  title: string;
  artist: string;
  img: string;
};

export enum Section {
  TopHit,
  Song,
  Lyric,
  Artist,
  Album,
  Video,
  Article,
  User,
}

export type Song = {
  title: string;
  img?: string;
  lyrics: string;
  summary: string;
  chorus?: string;
};

export type Artist = {
  name: string;
  songs: ResearchSong[];
};

export type WordPlay = {
  name: string;
  description: string;
  example: string;
};
export type ResearchSong = {
  title: string;
  artist: string;
  lyrics: string;
  summary: string;
  chorus: string;
  wordplays: WordPlay[] | number[];
  img: string | null;
  id?: number;
};

export type ResearchSet = {
  name: string;
  songs: ResearchSong[];
};

export type ResearchSetLink = {
  id: number;
  name: string;
};

export type WordPlay2 = {
  name: string;
  definition: string;
  example: string;
};

export type CustomRequestFunction = {
  name: string;
  value: string;
  id?: number;
};
export type CustomRequestFunctionModifier = {
  name: string;
  value: string;
  id?: number;
};

export type ProcessType = "block" | "line" | "multiline";

export enum ProcessTypeEnum {
  "PROCESS_BLOCK" = "block",
  "PROCESS_LINE" = "line",
  "PROCESS_MULTILINE" = "multiline",
}
export enum FunctionName {
  "NEW_LINE" = "NEW_LINE",
  "NEW_BLOCK" = "NEW_BLOCK",
  "FOLLOW_UP_LINE" = "FOLLOW_UP_LINE",
  "CUSTOM_FUNCTION" = "CUSTOM_FUNCTION",
  "GEN_TITLE" = "GEN_TITLE",
  "MERGE_LINES" = "MERGE_LINES",
  "CLIENT_HISTORY_UPDATE" = "CLIENT_HISTORY_UPDATE",
  "REVERSE_LYRICS" = "REVERSE_LYRICS",
  "HOOK_WIZARD_STEP1" = "HOOK_WIZARD_STEP1",
  "HOOK_WIZARD_STEP2" = "HOOK_WIZARD_STEP2",
}

export type GroupLine = { blockNum: number; lineNum: number };

export type HookExample = { name: string; songBlock: string };

export type AISessionState = {
  role:
    | "final_response"
    | "assistant"
    | "function"
    | "cancel_function"
    | "try_again"
    | "user";
  processType: ProcessType;
  content: string;
  currentFunction: string;
  lastFunction: string;
  currentSong: BlockLyricType[];
  currentTryCount: number;
  curBlockNum: number;
  curLineNum: number;
  groupLines: GroupLine[];
  currentModels: ModelArgs[];
  currentAgents: Team;
  contextSet: ContextSet;
  //lineSets: LineSet[];
  songString?: string;
  blockString?: string;
  lineString?: string;
  lineStringBefore?: string;
  lineStringAfter?: string;
  referencewordPlayString?: string;
  referenceLyricString?: string;
  resultData: FunctionResultData;
  finalResponse?: string;
  previousData: FunctionResultData;
  rules: RuleProps[];
  numOptions: number;
  customRequests: CustomFunction[];
  customRequestModifiers: CustomRequestFunctionModifier[];
  useCustomRequests: boolean;
  songId: number;
  songName: string;
  userId: string;
  referenceLyricsBlocks: BlockLyricType[];
  referenceWordPlayBlocks: BlockLyricType[];
  newSeeds: boolean;
  currentSeedLine?: string;
  genericData?: any;
  orchestrationSettings?: {
    agentOrder: "sequential" | "seq-reverse" | "random";
    rounds: number;
    maxRounds: number;
    orchestrationMode: OrchestrationType2;
    customAgentSet: string[];
  };
};
export type UpdateStateProps = {
  role?:
    | "user"
    | "assistant"
    | "function"
    | "cancel_function"
    | "try_again"
    | "final_response";
  processType?: ProcessType;
  content?: string;
  currentFunction?: string;
  lastFunction?: string;
  currentSong?: BlockLyricType[];
  currentTryCount?: number;
  curBlockNum?: number;
  curLineNum?: number;
  groupLines?: GroupLine[];
  currentModels?: { provider: ModelProviderEnum; modelName: ModelNames }[];
  currentAgents?: Team;
  contextSet?: ContextSet;
  //lineSets?: LineSet[];
  songString?: string;
  blockString?: string;
  lineString?: string;
  lineStringBefore?: string;
  lineStringAfter?: string;
  referencewordPlayString?: string;
  referenceLyricString?: string;
  resultData?: FunctionResultData;
  finalResponse?: string;
  previousData?: FunctionResultData;
  rules?: RuleProps[];
  numOptions?: number;
  customRequests?: CustomFunction[];
  customRequestModifiers?: CustomRequestFunctionModifier[];
  useCustomRequests?: boolean;
  songId?: number;
  songName?: string;
  userId?: string;
  referenceLyricsBlocks?: BlockLyricType[];
  referenceWordPlayBlocks?: BlockLyricType[];
  newSeeds?: boolean;
  currentSeedLine?: string;
  genericData?: any;
};

export enum AI_Agent_Tools {
  PINECONE = "PINECONE",
  TEXT_SPLITTER = "TEXT_SPLITTER",
  AGENT_GLOBAL_STATE = "AGENT_GLOBAL_STATE",
  WORD = "WORD",
  PERPLEXITY = "PERPLEXITY",
  URL_SCRAPE = "URL_SCRAPE",
  CREATE_REFERENCE_DOCUMENT = "CREATE_REFERENCE_DOCUMENT",
  CONTEXT_SETS = "CONTEXT_SETS",
  FETCH = "FETCH",
  KNOWLEDGE_BASE = "KNOWLEDGE_BASE",
  PUPPETEER = "PUPPETEER",
  DYNAMIC_SCRIPT = "DYNAMIC_SCRIPT",
  GMAIL = "GMAIL",
  OAUTH_PROVIDER = "OAUTH_PROVIDER",
  FILE_STORE = "FILE_STORE",
  DOCUMENT_PARSE = "DOCUMENT_PARSE",
  AUTO_GEN_TOOL = "AUTO_GEN_TOOL",
  DATABASE = "DATABASE",
  DOCUMENT_PROCESSOR = "DOCUMENT_PROCESSOR",
  VIDEO_GEN = "VIDEO_GEN",
  CUSTOM_TOOL = "CUSTOM_TOOL"
}

export type AI_Agent_ToolsDescription = {
  group: string;
  name: string;
  description: string;
};

/**
 * Unified interface for tool requests across the application
 * Combines functionality from both auto-gen and teams-lib implementations
 */
export interface ToolRequest {
  // Core properties (required)
  name: string; // Name of the tool
  description: string; // Description of what the tool does

  // Input/output specification
  inputs: {
    name: string;
    type: "string" | "number" | "boolean" | "array" | "object";
    description: string;
    required?: boolean;
    default?: any;
  }[];
  expectedOutput: string; // Description of what the tool returns

  // Optional properties for richer tool generation
  purpose?: string; // Detailed purpose of the tool
  examples?: {
    // Example usage
    input: Record<string, any>;
    output: any;
  }[];
  additionalContext?: string; // Any extra information

  // Legacy properties (for backward compatibility)
  toolName?: string; // Alias for name
  toolDescription?: string; // Alias for description
  suggestedInputs?: string[]; // Simple list of input names
  suggestedOutputs?: string[]; // Simple list of outputs
  category?: string; // Tool category
  toolGroup?: string; // Tool grouping category
}

export type MessageRouterProps = {
  message: string;
  chatHistory: ServerMessage[];
  agentIndex: number;
  serializedState: string;
  userName: string;
};

export type TeamObjective = {
  name: string;
  description: string;
};

export type Team = {
  name: string;
  objectives: string;
  agents: AgentComponentProps[];
  contextSets?: ContextContainerProps[];
  orchestrationType?: OrchestrationType2;
};
type AgentChatResponse = {
  message: string;
  data: any;
};

export enum AgentVoiceProviderEnum {
  "ELEVEN_LABS" = "ELEVEN_LABS",
  "OPENAI" = "OPENAI",
  "AWS" = "AWS",
}

export type AgentVoice = {
  provider: AgentVoiceProviderEnum;
  nameOrVoiceID: string;
};
export type AgentComponentProps = {
  type: AgentType;
  name: string;
  roleDescription: string;
  title: string;
  systemPrompt?: string;
  modelArgs: ModelArgs;
  listSets?: ContextContainerProps[];
  messages?:
    | Message[]
    | ServerMessage[]
    | ClientMessage[]
    | AIMessage[]
    | HumanMessage[];
  tools?: AI_Agent_Tools[] | string[];
  voice?: AgentVoice;
  promptDirectives?: string[];
  seName?: (title: string) => void;
  index?: number;
  promptTextToSet?: (text: string) => void;
  disabled?: boolean;
  training?: boolean;
  hasKnowledgeBase?: boolean;
  allowedContacts?: string[];
};

// export type LineSetViewableAgents = {
//   contextSetIndex: number;
//   cannotView: AgentComponentProps[];
// };

export type AgentType =
  | "agent"
  | "manager"
  | "researcher"
  | "supervisor"
  | "analyst"
  | "records"
  | "context-manager"
  | "tool-operator"
  | "dynamic-tool";

export enum AgentTypeEnum {
  "AGENT" = "agent",
  "MANAGER" = "manager",
  "RESEARCHER" = "researcher",
  "SUPERVISOR" = "supervisor",
  "ANALYST" = "analyst",
  "RECORDS" = "records",
  "CONTEXT_MANAGER" = "context-manager",
  "TOOL_OPERATOR" = "tool-operator",
  "DYNAMIC_TOOL" = "dynamic-tool",
  "TASK_AGENT" = "task-agent",
}

export type LineNumbersProps = {
  blockNum: number;
  lineNum: number;
};

export type StoredGlobalAIState = {
  uaerId: string;
  id: number;
  name: string;
  createdAt: Date;
};
export type AppState = {
  currentUser: any;
  top100Songs: Top100Songs;
  loading: boolean;
  dilemma: string;
  selectedArtists: Artist[];
  modalChoices: string[];
  dialogOpen: boolean;
  foundSongs: FoundSong[];
  foundArtists: FoundArtist[];
  foundAlbums: FoundAlbum[];
  foundHits: FoundTopHit[];
  mySongs: AILyrics[];
  researchSetLinks: ResearchSetLink[];
  wordPlayFunctions: FuncProps[];
  customFunctions: CustomFunction[];
  customModifiers: CustomRequestFunctionModifier[];
  //lineAsides: LineLyricType[];
  modalOpen: boolean;
  loadingText: string;
  _streamData: any;
  ui: any;
};

export type FunctionResultData = {
  options: string[];
  data: any;
};

export type VoiceLineObject = {
  lineText: string;
  words: { word: string; url: string }[];
  userId: string;
  id: number;
};

// export type LineListSetComponentProps = {
//   lines: LineLyricType[];
//   name: string;
//   userId: string
// };

export type AnalysisSet = {
  contextSets: ContextContainerProps[];
  analysisName: string;
  userId: string;
};

// export type LineSet = {
//   setName: string;
//   //lines: LineLyricType[];
//   text: string;
//   isDisabled: boolean;
//   hiddenFromAgents?: string[];
// };

export type ContextContainerProps = {
  setName: string;
  lines?: LineLyricType[];
  text?: string;
  isDisabled?: boolean;

  setIsDisabled?: (isDisabled: boolean) => void;
  setLabelName?: (name: string) => void;
  fullHeight?: boolean;
  fullScreen?: boolean;
  hiddenFromAgents?: string[];
  formSchema?: {
    schema: DynamicFormSchema;
    formName: string;
  };
  onFormSubmit?: (formData: any) => void;
  requestData?: {
    agentName: string;
    message: string;
    history: ServerMessage[];
  };
  //isFullScreen?: boolean;
};

export type ContextSet = {
  teamName: string;
  sets: ContextContainerProps[];
};

export type AgentFoundationalPromptProps = {
  userName: string;
  thisAgentName: string;
  agentType: AgentTypeEnum;
  userId: string;
  teamName: string;
  skillSet: string;
  role: string;
  tools: AI_Agent_Tools[] | string[];
  customTools?: Record<string, any>; // Dictionary of custom tools
  peerAgents: AgentComponentProps[];
  directives: string[];
  context: string;
  mission: string;
  trainingMode: boolean;
  allowedContacts?: string[];
};

export type AgentWorkflowOrchestrationPromptProps = {
  props: OrchestrationProps;
  context?: ContextContainerProps[];
  currentConversation: ServerMessage[];
  currentAgents: AgentComponentProps[];
};

export type ModelArgs = {
  provider: ModelProviderEnum;
  modelName: string | ModelNames;
  temperature: number;
  maxInputTokens?: number;
  maxOutputTokens?: number;
};

export type ModelProvider = {
  provider: ModelProviderEnum;
};
export enum ModelProviderEnum {
  "OPENAI" = "OPENAI",
  "ANTHROPIC" = "ANTHROPIC",
  "MISTRAL" = "MISTRAL",
  "COHERE" = "COHERE",
  "GOOGLE_G" = "GOOGLE_G",
  //"GOOGLE_V" = "GOOGLE_V",
  "BEDROCK" = "BEDROCK",
  "DEEPSEEK" = "DEEPSEEK",
}

export type ModelNames =
  | string
  | AnthropicModelNames
  | MistralModelNames
  | CohereModelNames
  | GoogleGenerativeAIModelNames
  | GoogleVertexModelNames
  | string;
// | typeof BedrockModelNames;

// export enum ModelNamesEnum {

// }

export type ModelNamesProps = {
  modelName: ModelNames;
};

export type CustomFunction = {
  name: string;
  value: string;
  id?: number;
};

export type GlobalMessages = {
  history: AISessionState[];
  currentState: AISessionState;
};

export type UpdateSongProps = {
  values: {
    text: string;
    blockNum: number;
    lineNum: number;
  }[];
  state: AISessionState;
};

export type ProcessLyricProps = {
  globalMessages: GlobalMessages;
};

export type FunctionProps = {
  processType: "block" | "line" | "multiline";
  functionName: string;
  currentLineString: string;
  currentBlockString: any;
  blockIndex: number;
  lineIndex: number;
  rules: RuleProps[];
  tryCount: number;
  songTitle: string;
  fullLyrics: string;
  currentModels: ModelArgs[];
  lineBefore?: string;
  lineAfter?: string;
  referenceBlocksString: string;
  previousResponses: FunctionResultData;
  song: BlockLyricType[];
  numOptions: number;
  customRequests: CustomRequestFunction[];
  customRequestModifiers: CustomRequestFunctionModifier[];
  referenceBlocks?: BlockLyricType[];
  referenceWordplays?: BlockLyricType[];
  newSeed: boolean;
  extraData?: any;
  currentSeedLine?: string;
};
export type ElevenLabsVoice = {
  voice_id: string;
  name: string;
  samples?: any;
  category?: string;
  fine_tuning?: any;
  labels?: any;
  description?: string;
  preview_url?: string;
  available_for_tiers?: any[];
  settings?: any;
  sharing?: any;
  high_quality_base_model_ids?: string[];
  safety_control?: any;
  voice_verification?: any;
};

export type ModelProviderSelectName = {
  id: string;
  name?: string;
};

export interface AGENT_TOOLS_EMULATOR {
  name: string;
  description: string;
  parameters: { name: string; type: string; description: string }[];
  execute: (parameters: Record<string, string>) => Promise<string>;
}

export type ServerMessage = {
  id?: string;
  role: "user" | "assistant" | "system" | "agent";
  content: string;
  subMessages?: ServerMessage[];
  currentState?: string;
  agentName?: string;
  contextSet?: ContextSet;
  conversationLevel?: number;
  expectedOutput?: {
    criteria: string;
    format?: string;
    requiredElements?: string[];
    validationStrategy?: "exact" | "semantic" | "contains" | "custom" | "simple";
  };
  agentDirectives?: {
    messageTo: string;
    message: string;
    workflowComplete: boolean;
    contextUpdates: boolean;
    isInfoRequest: boolean;
    contextSetUpdate?: {
      contextSets: Array<{
        name: string;
        context: string;
      }>;
    };
  };
}

export interface AppFrozenState {
  localState: AISessionState;
  currentConversation: ServerMessage[];
  contextSet: ContextSet;
  analysisSet?: {
    contextSet: ContextSet;
    analysisName: string;
    userId: string;
  };
  serverMessages?: ServerMessage[];
  extras?: any;
  orchestrationState?: {
    agentOrder: "sequential" | "seq-reverse" | "random";
    rounds: number;
    maxRounds: number;
    orchestrationMode: OrchestrationType2;
    customAgentSet: string[];
  };
}

export interface LoadFromServerReturn {
  currentConversation: ServerMessage[];
  conversationDays: string[];
  latestConversations: Conversation[];
  localState: AISessionState;
  contextSet: ContextSet;
}

export type AgentUserResponse = {
  response: ChainValues | string;
  history: ServerMessage[];
  context: ContextContainerProps[];
  agentProps: AgentFoundationalPromptProps;
  postMessageProps?: PostMessageAnalysisProps;
  nextAction?: string;
  prompt?: string;
  _data?: any;
  textChatLogs?: TextChatLogProps[];
  streamData?: any;
};

export type KB_LiveQueryResult = {
  groupId?: string;
  documentId?: string;
  pageContent: string;
  chunkIndex?: number;
  totalChunks?: number;
  isChunk?: boolean;
};
export type AutoOrchestrationProps = {
  result: "continue" | "complete";
  nextAgent: {
    name: string;
    type: AgentType;
    roleDescription: string;
    title: string;
  };
  initialMessage: string;
  messageHistory: ServerMessage[];
  currentMessage: string;
  currentMessageRewritten: string;
  taskCompletionQuery: string;
  allAvailableAgents: {
    name: string;
    type: AgentType;
    roleDescription: string;
    title: string;
  }[];
  contextSets: ContextContainerProps[];
  messageFrom: "user" | "manager" | "agent" | "system";
  summarizeConversation: boolean;
};
export type OrchestrationType =
  | "agent-orchestrator"
  | "wf-sequential-1"
  | "wf-sequential-2"
  | "wf-sequential-3";

export type OrchestrationProps = {
  agentOrder: "sequential" | "seq-reverse" | "random";
  chatMode: OrchestrationType2;
  numRounds: number;
  numAgents: number;
  currentAgent: AgentComponentProps;
  currentRound: number;
  currentCycleStep: number;
  isFinalRoundAndStep: boolean;
  allAgents: AgentComponentProps[];
  currentStepResponseType:
    | "initial-thought"
    | "follow-up-thought"
    | "final-thought";
  initialMessage: string;
  teamObjective: string;
  currentSummary?: string;
  requestFormSchema?: {
    schema: DynamicFormSchema;
    formName: string;
    requestingAgentName: string;
    requestMessage: string;
    historyUpToThisPoint: ServerMessage[];
  };
  isThinkingModel?: boolean;
  autoProps?: AutoOrchestrationProps;
  extras?: {
    query: string;
    userId: string;
    hasKnowledgeBase: boolean;
    teamName: string;
  };
};

// numRounds = 2
// currentAgent = string
// currentRound = 0
// currentStep = 0
// isFinalStep = false
// allAgents = string[]

/**
 * Types for value representation in dynamic forms
 */
export enum ValueType {
  STRING = "STRING",
  NUMBER = "NUMBER",
  BOOLEAN = "BOOLEAN",
  OBJECT = "OBJECT",
  ARRAY = "ARRAY",
  NULL = "NULL",
  UNDEFINED = "UNDEFINED",
  DATE = "DATE",
  ENUM = "ENUM",
  FILE = "FILE",
}

/**
 * Interface for dynamic form schemas
 */
export type DynamicFormSchema = Array<{
  formName: string;
  key: string;
  valueType: ValueType;
  enumValues?: string[];
  enumLabels?: string[];
}>;

/**
 * Agent definition in auto-generated workflows
 */
export interface AutoGenAgent {
  name: string;
  type: "manager" | "agent" | "researcher" | "tool-operator";
  roleDescription: string;
  title: string;
  expectedOutput?: string;
  toolHints?: string[];
}

/**
 * Team definition for auto-generated workflows
 */
// export interface AutoGenTeam {
//   team_name: string;
//   team_objective: string;
//   availableAgents: AutoGenAgent[];
//   newAgents: AutoGenAgent[];
//   agentSequence: string[];
//   orchestrationType: "sequential" | "random" | "auto";
//   processSteps: string[];
// }

// Add local interface definitions to replace the missing imports
// export interface PostMessageAnalysisProps {
//   messageId: string;
//   content: string;
//   userId: string;
//   formData?: any;
// }

export interface TextChatLogProps {
  id: string;
  timestamp: Date;
  content: string;
  metadata?: any;
}

export type DeepSeekModelNames = string;

// DynamicFormSchema is already defined in the file

export interface LineLyricType {
  content: string;
  id: string;
  metadata?: any;
}

export interface ModelConfig {
  modelName: string;
  provider: ModelProviderEnum;
  temperature: number;
}

export interface Tool {
  name: string;
  description: string;
  execute: (args: any) => Promise<any>;
}

export interface DynamicToolConfig {
  name: string;
  description: string;
  parameters: Record<string, any>;
  handler: (args: any) => Promise<any>;
}
