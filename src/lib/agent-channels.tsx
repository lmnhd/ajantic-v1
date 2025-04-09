"use server";
import {
  AgentUserResponse,
  ContextContainerProps,
  OrchestrationProps,
  OrchestrationType,
  ServerMessage,
} from "@/src/lib/types";
import {
  AgentComponentProps,
  AgentFoundationalPromptProps,
  AgentType,
  AgentTypeEnum,
  AI_Agent_Tools,
  AISessionState,
  ModelArgs,
  ModelProviderEnum,
  Team,
} from "@/src/lib/types";
import { openai } from "@ai-sdk/openai";

import {

  CoreMessage,
  generateText,

} from "ai";

import { z } from "zod";
import { MODEL_getModel_ai } from "./vercelAI-model-switcher";

import {
  UTILS_convertLineSetsToContext,
  UTILS_getObjectKeysOfLoadedTools,
  UTILS_loadAgentGlobalPrompt,
} from "@/src/lib/utils";


import { LOAD_AGENT_TOOLS } from "./agent-tools/load-agent-tools";

import { AGENT_TOOLS_agentGlobalState } from "@/src/app/api/pinecone/agent_global_state";
import { AGENT_TOOLS_agentDiary } from "./agent-tools/agent-diary";
// import { createAISDKTools } from "@agentic/ai-sdk";
// import { SerpAPIClient } from "@agentic/serpapi";
// import { BingClient } from "@agentic/bing";
// import { calculator } from "@agentic/calculator";
// import { TavilyClient } from "@agentic/tavily";
// import { JinaClient } from "@agentic/jina";
// import { SocialDataClient } from "@agentic/social-data";
// import { NovuClient } from "@agentic/novu";
// import { FirecrawlClient } from "@agentic/firecrawl";
// import { ExaClient } from "@agentic/exa";

import { AGENT_TOOLS_contextSets } from "@/src/lib/agent-tools/context-sets";
import {
  AGENT_TOOLS_agentToAgent,
  AGENT_TOOLS_agentToAgent_v2,
  SubConversationProps,
} from "./agent-tools/agent-to-agent";
import { AGENT_TOOLS_urlScrape } from "./agent-tools/agent-url-scrape";
import { VectorStoreRetriever } from "@langchain/core/vectorstores";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "@langchain/openai";
import {
  ANALYSIS_TOOLS_handlePostMessageRoutine,
  PostMessageAnalysisProps,
} from "@/src/lib/analysis_server";
import { TextChatLogProps } from "./text-chat-log";
import {
  ANALYSIS_TOOLS_preChatAnalysis,
  PreChatAnalysisProps,
} from "@/src/lib/pre-chat-analysis";
import { MEMORY_store } from "./agent-memory/store-retrieve";
import { AGENT_TOOLS_dynamicScript } from "./agent-tools/dynamic-tool/dynamic-action";
import { createStreamableValue } from "ai/rsc";
import { logger } from "@/src/lib/logger";
import { GLOBAL_getVectorStoreClient } from "@/src/lib/vectorstore_client";
import { AGENT_WORKFLOW_ORCHESTRATION_PROMPT } from "@/src/lib/prompts/workflow-prompt";
import { AGENT_TOOLS_loadCustomTools } from "@/src/lib/agent-tools/auto-gen-tool/load-custom-tools";
import { CustomToolDefinition } from "@/src/lib/agent-tools/auto-gen-tool/tool-generator";

import { AGENT_TOOLS_knowledgeBase_query, AGENT_TOOLS_pinecone } from "@/src/lib/agent-tools/pinecone";
import { AGENT_TOOLS_perplexity2 } from "@/src/lib/agent-tools/perplexity2";
import { AGENT_TOOLS_s3Store } from "@/src/lib/agent-tools/s3-store-tool";
import { AGENT_TOOLS_database } from "@/src/lib/agent-tools/database-tool/database-tool";

//let _data: any;

// Functioin for tool-based agent communication

let _communicationInProgress = false;
export async function agentToAgentChat(
  conversationLevel: number,
  agentName: string,
  agentType: AgentTypeEnum,
  senderName: string,
  message: string,
  history: ServerMessage[],
  convoTwo: {
    response: string;
    state: AISessionState;
    history: ServerMessage[];
  },
  convoThree: {
    response: string;
    state: AISessionState;
    history: ServerMessage[];
  },
  state: AISessionState,
  userId: string,
  teamName: string,
  vectorStore: MemoryVectorStore,
  contextSets: ContextContainerProps[],
  textChatLogs: TextChatLogProps[],
  orchestrationProps?: OrchestrationProps
): Promise<{
  response: string;
  context: ContextContainerProps[];
  state: AISessionState;
}> {
  logger.agent(
    `${senderName} initiates conversation with ${agentName}: ${message}`,
    {
      action: "AGENT_CHAT_START",
      sender: senderName,
      recipient: agentName,
    }
  );

  const recipient = state.currentAgents.agents.find(
    (agent) => agent.name === agentName
  ) as AgentComponentProps;

  if (!recipient) {
    logger.error("Unable to find agent in team roster", {
      action: "AGENT_NOT_FOUND",
      agent: agentName,
    });
    throw new Error(`Agent ${agentName} not found`);
  }

  const _prompt = await _generateDynamicPrompt(
    recipient,
    message,
    {
      agentType: recipient.type as AgentTypeEnum,
      thisAgentName: recipient.name || "",
      teamName: teamName,
      userId: userId,
      userName: state.genericData.userName || "",
      skillSet: recipient.systemPrompt || "",
      role: recipient.roleDescription || "",
      tools: recipient.tools || [],
      customTools: recipient.customTools,
      directives: recipient.promptDirectives || [],
      context: UTILS_convertLineSetsToContext(contextSets, recipient.name),
      mission: state.currentAgents.objectives,
      peerAgents: state.currentAgents.agents.filter(
        (agent) => agent.name !== recipient.name && !agent.disabled
      ),
      trainingMode: recipient.training || false,
    },
    orchestrationProps,
    contextSets
  );

  logger.agent(
    `Found agent ${recipient.name} - Message from ${senderName}: ${message}`,
    {
      action: "AGENT_FOUND",
      sender: senderName,
      recipient: recipient.name,
    }
  );

  textChatLogs.push({
    role: "system",
    message: `Starting new conversation with ${agentName}`,
    agentName: agentName,
  });

  // Format the incoming message
  logger.agent("Formatting message for agent communication", {
    action: "FORMATTING_INCOMING_MESSAGE",
    message,
  });
  const formattedUserMessage: ServerMessage = {
    role: "user",
    content: message.includes("**From")
      ? message
      : `**From ${senderName}: ${message}**`,
    agentName: recipient.name,
    conversationLevel: conversationLevel,
  };

  // Create a clean history for this conversation
  //const currentConversation = [formattedUserMessage];
  const currentConversation = [...convoTwo.history, formattedUserMessage];

  logger.log("Preparing conversation history", {
    action: "LOADING_CONVERSATION_HISTORY",
    history: currentConversation.map((m) => `${m.role}: ${m.content}` + "\n"),
  });
  //const currentConversation = [...history, ...convoTwo.history, formattedUserMessage];

  const _tools = {
    ...(await LOAD_TYPE_SPECIFIC_TOOLS(
      recipient.type as AgentTypeEnum,
      {},
      contextSets,
      convoTwo,
      convoThree,
      {
        agentType: recipient.type as AgentTypeEnum,
        thisAgentName: recipient.name || "",
        teamName: teamName,
        userId: userId,
        userName: state.genericData.userName || "",
        skillSet: recipient.systemPrompt || "",
        role: recipient.roleDescription || "",
        tools: recipient.tools || [],
        customTools: recipient.customTools,
        directives: recipient.promptDirectives || [],
        context: UTILS_convertLineSetsToContext(contextSets, recipient.name),
        mission: state.currentAgents.objectives,
        peerAgents: state.currentAgents.agents.filter(
          (_agent) => _agent.name !== recipient.name && !_agent.disabled
        ),
        trainingMode: recipient.training || false,
      },
      state,
      {
        conversationLevel,
        messageHistory: currentConversation,
        updateMessages: [],
        messageGoRound: false,
        userId,
        teamName,
        message,
      },
      vectorStore,
      textChatLogs,
      recipient.hasKnowledgeBase || false,
      recipient.allowedContacts || []
    )),
  };

  logger.tool("Loading agent tools and capabilities", {
    agent: recipient.name,
    action: "LOAD_AGENT_TOOLS",
    tools: await UTILS_getObjectKeysOfLoadedTools(_tools),
  });

  logger.prompt(_prompt, {
    agent: recipient.name,
    action: "LOAD_AGENT_PROMPT",
  });

  logger.log("Setting up conversation parameters", {
    action: "SET_CONVERSATION_LEVEL",
    level: conversationLevel,
  });
  textChatLogs.push({
    role: "system",
    message: `conversationLevel: ${conversationLevel}`,
    agentName: agentName,
  });
  logger.agent(
    `${recipient.name} processing message from ${senderName}: ${message}`,
    {
      action: "MESSAGE_PROCESS",
      sender: senderName,
      recipient: recipient.name,
    }
  );

  logger.tool(
    `${recipient.name} tools: ${await UTILS_getObjectKeysOfLoadedTools(
      _tools
    )}`,
    {
      agentName: agentName,
    }
  );

  textChatLogs.push({
    role: "system",
    message: `${recipient.name} tools: ${await UTILS_getObjectKeysOfLoadedTools(
      _tools
    )}`,
    agentName: agentName,
  });

  logger.debug("Setting conversation parameters", {
    action: "CONVERSATION_CONFIG",
    level: conversationLevel,
    agent: recipient.name,
    sender: senderName,
  });


  //const _vectorStore = await GLOBAL_getVectorStoreClient();

  const agentResponse = await generateText({
    model: await MODEL_getModel_ai(recipient.modelArgs),
    messages:
      recipient.modelArgs.modelName === "o1-mini" ||
      recipient.modelArgs.modelName === "o1-preview"
        ? (currentConversation as CoreMessage[])
        : [
            {
              role: "system",
              content: _prompt,
            },
            ...(currentConversation as CoreMessage[]),
          ],
    maxSteps: 6,
    maxRetries: 0,
    tools: _tools,
  });

  logger.agent(`${recipient.name} responds: ${agentResponse.text}`, {
    action: "AGENT_RESPONSE",
    sender: recipient.name,
    responseLength: agentResponse.text.length,
  });
  textChatLogs.push({
    role: "system",
    message: `${recipient.name} has completed their response`,
    agentName: agentName,
  });

  // Format the response message
  const formattedResponseMessage: ServerMessage = {
    role: "assistant",
    content: recipient.name + ": " + agentResponse.text,
    //content: `**From ${recipient.name}: ${agentResponse.text}**`,
    agentName: senderName,
    subMessages: convoThree.history,
    currentState: JSON.stringify({ ...state, contextSets }),
    conversationLevel: conversationLevel,
  };
  logger.log("Updating conversation history", {
    action: "UPDATE_CONVERSATION_HISTORY",
    agent: recipient.name,
    newMessagesCount: 2, // formattedUserMessage and formattedResponseMessage
    totalHistoryLength: convoTwo.history.length + 2,
  });

  // Update conversation histories
  convoTwo.response = agentResponse.text;
  convoTwo.history = [
    //...currentConversation,
    ...(convoTwo.history as ServerMessage[]),
    formattedUserMessage,
    formattedResponseMessage,
  ];

  logger.agent("Agent conversation completed", {
    action: "CHAT_COMPLETE",
    agent: recipient.name,
    responseLength: convoTwo.response.length,
  });
  textChatLogs.push({
    role: "agent",
    message: `agentToAgentChat complete -> agent response: ${convoTwo.response}`,
    agentName: agentName,
  });

  // At start
  console.log("AGENT CHAT START - ContextSets:", contextSets);

  // After tool usage/before return
  console.log("AGENT CHAT END - ContextSets:", contextSets);

  return {
    response: agentResponse.text,
    context: contextSets,
    state: state,
  };
}

export const agentChannelMessageRouter = async (
  message: string,
  messageHistory: ServerMessage[],
  agentsByName: Team,
  contextSets: ContextContainerProps[],
  modelNames: ModelArgs[],
  streaming: boolean,
  agentFoundationalPromptProps: AgentFoundationalPromptProps | null,
  state: AISessionState,
  userId: string,
  teamName: string,
  testing?: boolean
): Promise<AgentUserResponse | null> => {
  if (!message) {
    return null;
  }
  try {
    const preCheck: PreChatAnalysisProps = await ANALYSIS_TOOLS_preChatAnalysis(
      message,
      (agentFoundationalPromptProps as AgentFoundationalPromptProps)
        .thisAgentName,
      agentsByName,
      contextSets,
      agentFoundationalPromptProps as AgentFoundationalPromptProps,
      state,
      userId,
      teamName
    );

    let textChatLogs: TextChatLogProps[] = [];
    let response: AgentUserResponse | null;
    logger.debug("Starting to route message to appropriate agent", {
      action: "BEGIN_MESSAGE_ROUTING",
    });

    //return null;

    if (message.includes(":::")) {
      const [name, thisMessage] = message.split(":::");
      if (thisMessage.length < 2) {
        logger.error("Message is too short to process", {
          action: "MESSAGE_VALIDATION_ERROR",
          message,
          minLength: 2,
        });
        return {
          response: "Error in messageRouter: Message too short",
          history: [...messageHistory],
          context: contextSets,
          agentProps:
            agentFoundationalPromptProps as AgentFoundationalPromptProps,
          nextAction: "none",
          prompt: "",
          textChatLogs: [],
        };
      }

      for (const agent of agentsByName.agents) {
        const _name = agent.name?.toLowerCase().trim() || "";
        if (_name === name.toLowerCase().trim()) {
          logger.agent(`Routing message to ${agent.name}: ${thisMessage}`, {
            action: "MESSAGE_ROUTE",
            agent: agent.name,
          });
          response = await basicAgentChat(
            thisMessage,
            preCheck.updatedMessage || thisMessage,
            messageHistory,
            agentsByName,
            contextSets,
            {
              agentType: agent.type as AgentTypeEnum,
              thisAgentName: agent.name || "",
              teamName: teamName,
              userId: userId,
              userName: state.genericData.userName || "",
              skillSet: agent.systemPrompt || "",
              role: agent.roleDescription || "",
              tools: agent.tools || [],
              customTools: agent.customTools,
              directives: agent.promptDirectives || [],
              context: UTILS_convertLineSetsToContext(contextSets, agent.name),
              mission: state.currentAgents.objectives,
              peerAgents: state.currentAgents.agents.filter(
                (_agent) => _agent.name !== agent.name && !_agent.disabled
              ),
              trainingMode: agent.training || false,
            },
            state,
            userId,
            teamName,
            false,
            streaming,
            textChatLogs
          );

          if (response) {
            logger.agent(
              `${agent.name} generated response: ${response.response}`,
              {
                action: "RESPONSE_RECEIVED",
                agent: agent.name,
                isTraining: !!agent.training,
              }
            );

            if (response && !agent.training) {
              let postMessageAnalyisResult: PostMessageAnalysisProps = {
                nextFlag: "ANALYSIS",
                message: response.response as string,
                chatHistory: response.history,
                userId: userId,
                team: agentsByName,
                namesOfAgentsInConvo: [
                  (agentFoundationalPromptProps as AgentFoundationalPromptProps)
                    .thisAgentName,
                ],
                currentAgentIndex: 0,
                state: JSON.stringify(state),
                iteration: 0,
                memoryWorthy: false,
              };

              logger.agent("Starting post-message analysis", {
                action: "POST_MESSAGE_ANALYSIS_START",
                agent: (
                  agentFoundationalPromptProps as AgentFoundationalPromptProps
                ).thisAgentName,
                iteration: 0,
              });

              while (
                postMessageAnalyisResult.nextFlag !== "PASS" &&
                postMessageAnalyisResult.nextFlag !== "FAIL" &&
                postMessageAnalyisResult.nextFlag !== "COMPLETE" &&
                postMessageAnalyisResult.nextFlag !== "INFO_REQUEST" &&
                postMessageAnalyisResult.nextFlag !== "AUTH_URL"
              ) {
                postMessageAnalyisResult =
                  await ANALYSIS_TOOLS_handlePostMessageRoutine(
                    postMessageAnalyisResult
                  );

                postMessageAnalyisResult.iteration++;

                if (postMessageAnalyisResult.iteration > 4) {
                  logger.warn("Analysis iterations exceeded limit", {
                    action: "POST_MESSAGE_ANALYSIS_LIMIT",
                    agent: (
                      agentFoundationalPromptProps as AgentFoundationalPromptProps
                    ).thisAgentName,
                    iterations: postMessageAnalyisResult.iteration,
                  });
                  postMessageAnalyisResult.nextFlag = "FAIL";
                }
              }

              if(postMessageAnalyisResult.newContext  ) {
                contextSets = [...contextSets, ...postMessageAnalyisResult.newContext];
                response.context = contextSets;// append a messages stating that the
                response.response = postMessageAnalyisResult.message;
              }


              logger.log("Completed post-message analysis", {
                action: "POST_MESSAGE_ANALYSIS_COMPLETE",
                agent: (
                  agentFoundationalPromptProps as AgentFoundationalPromptProps
                ).thisAgentName,
                finalFlag: postMessageAnalyisResult.nextFlag,
              });

              response.postMessageProps = postMessageAnalyisResult ;
              return response;
            } else {
              return response;
            }
          }
        }
      }
    }
    return null;
  } catch (error) {
    logger.error("Failed to process agent conversation", {
      action: "AGENT_CONVERSATION_ERROR",
      error,
      agent: (agentFoundationalPromptProps as AgentFoundationalPromptProps)
        .thisAgentName,
    });
    throw error;
  }
};
let agentPromises: Promise<AgentUserResponse | null>[] = [];

// Add this helper function to estimate token count and provide rate limit protection
async function waitForRateLimit() {
  // Add a 2 second pause between requests to avoid hitting rate limits
  // Anthropic limit is 20,000 tokens per minute - this ensures max 30 requests per minute
  await new Promise((resolve) => setTimeout(resolve, 2000));
}

// Helper to estimate token count - rough approximation (4 chars ~= 1 token)
function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

// Intelligently summarize a message to 1-2 lines of essential content
function summarizeMessage(message: string, isRecent: boolean = false): string {
  if (!message) return "";
  
  // Already short message, just return it
  if (message.length < 120) return message;
  
  // Extract first sentence or portion
  const firstSentenceMatch = message.match(/^[^.!?]*[.!?]/);
  const firstSentence = firstSentenceMatch ? firstSentenceMatch[0].trim() : "";
  
  // For very recent messages (last 2), keep a bit more detail
  if (isRecent) {
    // Try to get two sentences if possible
    const firstTwoSentencesMatch = message.match(/^[^.!?]*[.!?][^.!?]*[.!?]/);
    return firstTwoSentencesMatch 
      ? firstTwoSentencesMatch[0].trim() 
      : (firstSentence || message.substring(0, 150) + "...");
  }
  
  // For older messages, just the most essential info
  return firstSentence || message.substring(0, 100) + "...";
}

// Modify the existing createSummarizedHistory function to be conditional
function createSummarizedHistory(
  history: ServerMessage[], 
  isManager: boolean = false, 
  orchestrationProps?: OrchestrationProps
): ServerMessage[] {
  // For agent-orchestrator mode, return the full conversation history unedited
  if ((!orchestrationProps?.chatMode || orchestrationProps?.chatMode === 'agent-orchestrator') || (orchestrationProps && orchestrationProps.agentOrder !== "auto")) {
    return history || [];
  }
  
  // For non-manager agents, we'll return empty conversation history
  if (!isManager) {
    return [];
  }
  
  if (!history || history.length === 0) return [];
  
  // Keep only recent messages (last 8)
  const recentHistory = history.slice(-8);
  
  // Create summaries for each message
  return recentHistory.map((msg, index) => {
    // Keep the last 2 messages more detailed
    const isRecent = index >= recentHistory.length - 2;
    
    // For system messages or very short messages, keep as is
    if (msg.role === "system" || (msg.content?.length || 0) < 120) {
      return msg;
    }
    
    // Create a summarized version
    return {
      ...msg,
      content: summarizeMessage(msg.content || "", isRecent),
    };
  });
}

export async function basicAgentChat(
  message: string,
  messageQuery: string,
  messageHistory: ServerMessage[],
  agentsByName: Team,
  contextSets: ContextContainerProps[],
  agentFoundationalPromptProps: AgentFoundationalPromptProps | null,
  state: AISessionState,
  userId: string,
  teamName: string,
  messageGoRound?: boolean,
  streaming?: boolean,
  textChatLogs?: TextChatLogProps[],
  orchestrationProps?: OrchestrationProps
): Promise<AgentUserResponse> {
  // Add rate limiting delay
  await waitForRateLimit();

  // Truncate helper function - keep for prompt truncation
  const truncateMessage = (msg: string) => {
    const MAX_LENGTH = 12000;
    return msg.length > MAX_LENGTH ? msg.slice(0, MAX_LENGTH) + '...' : msg;
  };

  // Initialize capturedVariables with default values
  let capturedVariables = {
    agent: {} as AgentComponentProps,
    currentConversation: [] as ServerMessage[],
    truncatedPrompt: "",
    _prompt: "",
    convoTwo: { response: "", state: {} as AISessionState, history: [] as ServerMessage[] },
    conversationLevel: 0,
    _tools: {},
    _providerOptions: {}
  };

  try {
    let agent: AgentComponentProps | undefined;
    if (agentFoundationalPromptProps) {
      agent = agentsByName.agents.find(
        (agent) =>
          agent.name === agentFoundationalPromptProps?.thisAgentName
      ) as AgentComponentProps;
    } else if (orchestrationProps?.currentAgent) {
      agent = orchestrationProps.currentAgent;
    }

    if (!agent) {
      logger.error("Agent not found", {
        agentName:
          agentFoundationalPromptProps?.thisAgentName ||
          orchestrationProps?.currentAgent?.name,
      });
      throw new Error(
        `Agent '${
          agentFoundationalPromptProps?.thisAgentName ||
          orchestrationProps?.currentAgent?.name
        }' not found`
      );
    }

    logger.agent(`Starting conversation with ${agent.name}: ${message}`, {
      action: "CHAT_START",
      agent: agent.name,
    });

    const vectorStore = await GLOBAL_getVectorStoreClient();

    let conversationLevel = 0;

    const _prompt = await _generateDynamicPrompt(
      agent,
      message,
      agentFoundationalPromptProps,
      orchestrationProps,
      contextSets
    );

    // Format the user message
    logger.log(`${agent.name} formatting user message: ${message}`, { message });
    const formattedUserMessage: ServerMessage = {
      role: "user",
      content: message,
      agentName:
        agentFoundationalPromptProps?.thisAgentName ||
        orchestrationProps?.currentAgent?.name,
      currentState: "",
      conversationLevel: conversationLevel,
    };

    // Check if agent is a manager type
    const isManager = agent.type === "manager";
    const isAgentOrchestrator = orchestrationProps?.chatMode === 'agent-orchestrator';
    
    // Create conversation history based on agent type and orchestration mode
    const summarizedHistory = createSummarizedHistory(messageHistory, isManager, orchestrationProps);
    
    logger.log(`${agent.name} creating conversation history`, {
      agentType: agent.type,
      isManager,
      isAgentOrchestrator,
      includingHistory: isManager || isAgentOrchestrator,
      historyLength: summarizedHistory.length
    });
    
    // Use empty or summarized history based on agent type
    const currentConversation = [...summarizedHistory, formattedUserMessage];

    // If we're including history, log token savings (only in summarization mode)
    if (isManager && !isAgentOrchestrator && messageHistory.length > 0) {
      const originalTokens = messageHistory.reduce((acc, msg) => acc + estimateTokenCount(msg.content || ""), 0);
      const summarizedTokens = summarizedHistory.reduce((acc, msg) => acc + estimateTokenCount(msg.content || ""), 0);
      logger.log(`Token savings from summarization: ${originalTokens - summarizedTokens} tokens (${Math.round((originalTokens - summarizedTokens) / originalTokens * 100)}%)`, {
        action: "SUMMARIZATION_SAVINGS",
        originalTokens,
        summarizedTokens,
      });
    } else {
      logger.log("Skipping conversation history for non-manager agent", {
        agent: agent.name,
        type: agent.type
      });
    }

    let convoTwo = { response: "", state, history: [] };
    let convoThree = { response: "", state, history: [] };

    logger.prompt(`${agent.name} prompt: ${_prompt}`, {
      action: "PROMPT_PREPARE",
      agent: agent.name,
      type: agent.type,

      context: message,
    });

    // Truncate prompt to avoid rate limits
    const truncatedPrompt = truncateMessage(_prompt);
    logger.log(`Prompt length after truncation: ${truncatedPrompt.length} characters`);

    // Before making the API call
    const promptAndConversationSize = estimateTokenCount(truncatedPrompt) + 
      currentConversation.reduce((acc, msg) => acc + estimateTokenCount(msg.content || ""), 0);
    
    logger.log(`Estimated token count for request: ${promptAndConversationSize}`, {
      agent: agent.name,
      action: "TOKEN_ESTIMATION",
      promptSize: estimateTokenCount(truncatedPrompt),
      conversationSize: currentConversation.reduce((acc, msg) => acc + estimateTokenCount(msg.content || ""), 0),
    });

    if (promptAndConversationSize > 15000) {
      logger.warn(`Large token count detected (${promptAndConversationSize}), consider further optimization`, {
        agent: agent.name,
        action: "TOKEN_WARNING"
      });
    }

    const _tools = {
      ...(await LOAD_TYPE_SPECIFIC_TOOLS(
        agent.type as AgentTypeEnum,
        {},
        contextSets,
        convoTwo,
        convoThree,
        {
          agentType: agent.type as AgentTypeEnum,
          thisAgentName: agent.name || "",
          teamName: teamName,
          userId: userId,
          userName: state.genericData.userName || "",
          skillSet: agent.systemPrompt || "",
          role: agent.roleDescription || "",
          tools: agent.tools || [],
          customTools: agent.customTools,
          directives: agent.promptDirectives || [],
          context: UTILS_convertLineSetsToContext(contextSets, agent.name),
          mission: state.currentAgents.objectives,
          peerAgents: state.currentAgents.agents.filter(
            (_agent) => _agent.name !== agent.name && !_agent.disabled
          ),
          trainingMode: agent.training || false,
        },
        state,
        {
          conversationLevel,
          messageHistory: currentConversation,
          updateMessages: [],
          messageGoRound: false,
          userId,
          teamName,
          message,
        },
        vectorStore,
        textChatLogs,
        agent.hasKnowledgeBase || false,
        agent.allowedContacts || []
      )),
    };

    console.log(`Tools for ${agent.name}:`, await UTILS_getObjectKeysOfLoadedTools(_tools));

    logger.tool(`Tools for ${agent.name}:`, {
      tools: await UTILS_getObjectKeysOfLoadedTools(_tools),
    });

    let _providerOptions = {};
    if (agent.modelArgs.modelName === "claude-3-7-sonnet-20250219") {
      _providerOptions = {
        anthropic: {
          thinking: { type: "enabled", budgetTokens: 12000 },
        },
      };
      logger.agent(`${agent.name} PROVIDER_OPTIONS: `, {
        action: "PROVIDER_OPTIONS",
        agent: agent.name,
        providerOptions: _providerOptions,
      });
    }

    // Update capturedVariables with actual values
    capturedVariables = {
      agent,
      currentConversation,
      truncatedPrompt,
      _prompt,
      convoTwo,
      conversationLevel,
      _tools,
      _providerOptions
    };

    const response = await generateText({
      model: await MODEL_getModel_ai(agent.modelArgs),
      messages:
        agent.modelArgs.modelName === "o1-mini" ||
        agent.modelArgs.modelName === "o3-mini" ||
        agent.modelArgs.modelName === "o1-preview"
          ? (currentConversation as CoreMessage[])
          : [
              {
                role: "system",
                content: truncatedPrompt,
              },
              ...(currentConversation as CoreMessage[]),
            ],
      maxSteps: 6,
      maxRetries: 2,
      tools: _tools,
      providerOptions: _providerOptions,
    });

    logger.agent(`${agent.name} final response: ${response.text.trim().substring(10,30)}...`, {
      action: "CHAT_COMPLETE",
      agent: agent.name,
      response: response.text,
    });
    console.log("END_BASIC_AGENT_CHAT: ", response.text);
    textChatLogs?.push({
      role: "system",
      message: `END_BASIC_AGENT_CHAT: Final Response from: ${
        agentFoundationalPromptProps?.thisAgentName ||
        orchestrationProps?.currentAgent?.name
      } ${response.text}`,
      agentName:
        agentFoundationalPromptProps?.thisAgentName ||
        orchestrationProps?.currentAgent?.name,
    });

    // Format the response message

    const formattedResponseMessage: ServerMessage = {
      role: "assistant",
      content: response.text,
      agentName:
        agentFoundationalPromptProps?.thisAgentName ||
        orchestrationProps?.currentAgent?.name,
      subMessages: convoTwo.history,
      currentState: JSON.stringify({ ...state, contextSets }),
      conversationLevel: conversationLevel,
    };

    // logger.user("FORMATTED_RESPONSE_MESSAGE", {
    //   formattedResponseMessage: formattedResponseMessage,
    // });

    return {
      response: response.text,
      history: [...currentConversation, formattedResponseMessage],
      context: contextSets,
      nextAction: "none",
      prompt: _prompt,
      
      } as AgentUserResponse
    
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("Overloaded")) {
        logger.warn("Model overloaded, implementing exponential backoff retry", {
          action: "RETRY_AFTER_OVERLOAD",
          agent: (agentFoundationalPromptProps as AgentFoundationalPromptProps)
            .thisAgentName,
        });
        
        // Implement exponential backoff
        const maxRetries = 3;
        let retryCount = 0;
        let lastError = error;
        
        while (retryCount < maxRetries) {
          try {
            // Wait with exponential backoff
            await new Promise((resolve) => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
            
            // Retry the generateText call
            const response = await generateText({
              model: await MODEL_getModel_ai(capturedVariables.agent.modelArgs),
              messages:
                capturedVariables.agent.modelArgs.modelName === "o1-mini" ||
                capturedVariables.agent.modelArgs.modelName === "o3-mini" ||
                capturedVariables.agent.modelArgs.modelName === "o1-preview"
                  ? (capturedVariables.currentConversation as CoreMessage[])
                  : [
                      {
                        role: "system",
                        content: capturedVariables.truncatedPrompt,
                      },
                      ...(capturedVariables.currentConversation as CoreMessage[]),
                    ],
              maxSteps: 6,
              maxRetries: 1,
              tools: capturedVariables._tools,
              providerOptions: capturedVariables._providerOptions,
            });
            
            return {
              response: response.text,
              history: [...capturedVariables.currentConversation, {
                role: "assistant",
                content: response.text,
                agentName: agentFoundationalPromptProps?.thisAgentName || orchestrationProps?.currentAgent?.name,
                subMessages: capturedVariables.convoTwo.history,
                currentState: JSON.stringify({ ...state, contextSets }),
                conversationLevel: capturedVariables.conversationLevel,
              }],
              context: contextSets,
              nextAction: "none",
              prompt: capturedVariables._prompt,
            } as AgentUserResponse;
          } catch (retryError) {
            lastError = retryError as Error;
            retryCount++;
            if (retryCount === maxRetries) {
              logger.error("Max retries reached after overload", {
                action: "MAX_RETRIES_REACHED",
                agent: (agentFoundationalPromptProps as AgentFoundationalPromptProps)
                  .thisAgentName,
                error: lastError.message,
              });
              throw lastError;
            }
          }
        }
      }
    }
    throw error;
  }
}

export async function LOAD_TYPE_SPECIFIC_TOOLS(
  type: AgentTypeEnum,
  tools: any,
  contextSets: ContextContainerProps[],
  convoTwo: SubConversationProps,
  convoThree: SubConversationProps,
  agentFoundationalPromptProps: AgentFoundationalPromptProps,
  state: AISessionState,

  agentChatProps: {
    conversationLevel: number;
    messageHistory: ServerMessage[];
    updateMessages: ServerMessage[];
    messageGoRound: boolean;
    userId: string;
    teamName: string;
    message: string;
  },
  vectorStore: MemoryVectorStore,
  textChatLogs?: TextChatLogProps[],
  hasKnowledgeBase?: boolean,
  allowedContacts?: string[],
  orchestrationProps?: OrchestrationProps
) {
  let _result = {};
  const currentAgent = state.currentAgents.agents.find(agent => agent.name === agentFoundationalPromptProps.thisAgentName) ;
  if (!currentAgent) {
    throw new Error(`Current agent not found: ${agentFoundationalPromptProps.thisAgentName}`);
  }
  const allAgents = state.currentAgents.agents.map(agent => agent.name);

  logger.debug("LOAD_TS_TOOLS_AGENT_TYPE", { type });
  textChatLogs?.push({
    role: "system",
    message: `LOAD_TS_TOOLS_AGENT_TYPE: ${type}`,
    agentName: agentFoundationalPromptProps.thisAgentName,
  });

  if (allowedContacts && allowedContacts.length > 0) {
    _result = {
      ..._result,
      ...(await AGENT_TOOLS_agentToAgent_v2(
        allowedContacts,
        agentChatProps?.conversationLevel || 0,
        agentFoundationalPromptProps,
        agentChatProps?.messageHistory || [],
        state,
        agentChatProps?.userId || "",
        agentChatProps?.teamName || "",
        vectorStore,
        contextSets,
        textChatLogs || [],
        convoTwo,
        convoThree
      )),
    };
  }

  switch (type) {
    case AgentTypeEnum.RESEARCHER:
      _result = {
        ..._result,
        ...tools,
        ...AGENT_TOOLS_perplexity2(),
        ...AGENT_TOOLS_urlScrape(textChatLogs || []),
        ...AGENT_TOOLS_contextSets(contextSets, textChatLogs || [], currentAgent, allAgents),
        ...AGENT_TOOLS_pinecone(textChatLogs || []),
        ...AGENT_TOOLS_database(contextSets, agentFoundationalPromptProps.userId || "", agentFoundationalPromptProps.thisAgentName, agentFoundationalPromptProps.peerAgents),
        ...AGENT_TOOLS_s3Store(contextSets, currentAgent),
      };
      break;
    case AgentTypeEnum.CONTEXT_MANAGER:
      _result = {
        ...tools,
        ...AGENT_TOOLS_contextSets(contextSets, textChatLogs || [], currentAgent, allAgents),
      };
      break;
    case AgentTypeEnum.RECORDS:
      _result = {
        ..._result,
        ...tools,
        ...(await AGENT_TOOLS_agentDiary(
          agentFoundationalPromptProps.thisAgentName,
          agentFoundationalPromptProps.teamName || "",
          agentFoundationalPromptProps.userId || "",
          textChatLogs || []
        )),
      };
      break;
    case AgentTypeEnum.MANAGER:
      if (orchestrationProps && orchestrationProps.agentOrder === "auto") {
        _result = {
          ..._result,
          ...AGENT_TOOLS_pinecone(textChatLogs || []),
          ...AGENT_TOOLS_database(contextSets, agentFoundationalPromptProps.userId || "", agentFoundationalPromptProps.thisAgentName, agentFoundationalPromptProps.peerAgents),
          ...AGENT_TOOLS_contextSets(contextSets, textChatLogs || [], currentAgent, allAgents),
        };
        break;
      }
      if (
        agentFoundationalPromptProps.peerAgents.some(
          (agent) => agent.type === AgentTypeEnum.CONTEXT_MANAGER
        )
      ) {
        _result = {
          ..._result,
          ...(await AGENT_TOOLS_agentToAgent(
            agentChatProps?.conversationLevel || 0,
            agentFoundationalPromptProps,
            agentChatProps?.messageHistory || [],
            state,
            convoTwo,
            convoThree,
            agentChatProps?.userId || "",
            agentChatProps?.teamName || "",
            agentChatProps?.messageGoRound || false,
            contextSets,
            vectorStore,
            textChatLogs || []
          )),
        };
      } else {
        _result = {
          ..._result,
          ...(await AGENT_TOOLS_agentToAgent(
            agentChatProps?.conversationLevel || 0,
            agentFoundationalPromptProps,
            agentChatProps?.messageHistory || [],
            state,
            convoTwo,
            convoThree,
            agentChatProps?.userId || "",
            agentChatProps?.teamName || "",
            agentChatProps?.messageGoRound || false,
            contextSets,
            vectorStore,
            textChatLogs || []
          )),
          ...AGENT_TOOLS_contextSets(contextSets, textChatLogs || [], currentAgent, allAgents),
        };
      }
      break;
      
    case AgentTypeEnum.TOOL_OPERATOR:
      // Only TOOL_OPERATOR agents can use custom tools
      if (agentFoundationalPromptProps.customTools && Object.keys(agentFoundationalPromptProps.customTools).length > 0) {
        logger.tool("Loading custom tools for TOOL_OPERATOR agent", {
          agentName: agentFoundationalPromptProps.thisAgentName,
          customToolCount: Object.keys(agentFoundationalPromptProps.customTools).length,
          customToolNames: Object.keys(agentFoundationalPromptProps.customTools).join(", ")
        });
        
        textChatLogs?.push({
          role: "system",
          message: `Loading ${Object.keys(agentFoundationalPromptProps.customTools).length} custom tools: ${Object.keys(agentFoundationalPromptProps.customTools).join(", ")}`,
          agentName: agentFoundationalPromptProps.thisAgentName,
        });

        const customTools: CustomToolDefinition[] = Object.values(agentFoundationalPromptProps.customTools);

        _result = {
          ..._result,
          ...AGENT_TOOLS_loadCustomTools(
            customTools,
            agentFoundationalPromptProps.thisAgentName,
            agentFoundationalPromptProps.userId || ""
          ),
        };
      }
      
      _result = {
        ..._result,
        ...tools,
        ...(await LOAD_AGENT_TOOLS(
          agentFoundationalPromptProps.tools,
          {},
          contextSets,
          vectorStore,
          textChatLogs || [],
          state,
          agentFoundationalPromptProps.thisAgentName,
          agentFoundationalPromptProps.userId,
          agentChatProps.message,
          agentFoundationalPromptProps.customTools
        )),
      };
      break;

    case AgentTypeEnum.DYNAMIC_TOOL:
      tools = {
        ...tools,
        ...(await AGENT_TOOLS_dynamicScript(
          agentFoundationalPromptProps.thisAgentName,
          agentChatProps?.userId || "",
          textChatLogs || []
        )),
      };
      agentFoundationalPromptProps.tools = [
        ...agentFoundationalPromptProps.tools,
        AI_Agent_Tools.DYNAMIC_SCRIPT,
      ];
      _result = {
        ..._result,
        ...tools,
        ...LOAD_AGENT_TOOLS(
          agentFoundationalPromptProps.tools,
          {},
          contextSets,
          vectorStore,
          textChatLogs || [],
          state,
          agentFoundationalPromptProps.thisAgentName,
          agentChatProps?.userId || "",
          agentChatProps?.message || ""
        ),
      };
      break;

    default:
      // For any other agent type, don't load custom tools
      _result = {
        ..._result,
        ...tools,
      };
  }
  _result = {
    ..._result,

    // ...(await AGENT_TOOLS_agentDiary(
    //   agentFoundationalPromptProps.thisAgentName,
    //   agentFoundationalPromptProps.teamName || "",
    //   agentFoundationalPromptProps.userId || ""
    // )),
  };
  if (hasKnowledgeBase) {
    _result = {
      ..._result,
      ...AGENT_TOOLS_knowledgeBase_query(
        agentFoundationalPromptProps.userId || "",
        agentFoundationalPromptProps.thisAgentName,
        agentFoundationalPromptProps.teamName || ""
      ),
    };
  }
  logger.tool("Loading agent-specific tools", {
    action: "LOAD_AGENT_TOOLS",
    agentType: type,
    toolCount: Object.keys(_result).length,
    hasKnowledgeBase,
  });

  // Log information about custom tools if present, but only for TOOL_OPERATOR agents
  if (type === AgentTypeEnum.TOOL_OPERATOR && 
      agentFoundationalPromptProps.customTools && 
      Object.keys(agentFoundationalPromptProps.customTools).length > 0) {
    logger.tool("Custom tools available to TOOL_OPERATOR", {
      action: "CUSTOM_TOOLS_LOADED",
      agentName: agentFoundationalPromptProps.thisAgentName,
      customToolCount: Object.keys(agentFoundationalPromptProps.customTools).length,
      customToolNames: Object.keys(agentFoundationalPromptProps.customTools).join(", ")
    });
  }

  logger.tool("Validating tool configuration", {
    action: "VALIDATE_TOOL_CONFIG",
    agentType: type,
    requestedTools: tools ? Object.keys(tools).length : 0,
    hasContextSets: !!contextSets?.length,
  });

  try {
    // ... existing tool loading code ...
  } catch (error) {
    logger.error("Failed to load agent tools", {
      action: "TOOL_LOAD_ERROR",
      agentType: type,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  logger.tool("Successfully loaded agent tools", {
    action: "TOOLS_LOADED",
    agentName: agentFoundationalPromptProps.thisAgentName,
    agentType: type,
    loadedTools: Object.keys(_result),
    totalTools: Object.keys(_result).length,
  });

  if (hasKnowledgeBase) {
    logger.log("Loading knowledge base tools", {
      action: "LOAD_KB_TOOLS",
      agent: agentFoundationalPromptProps.thisAgentName,
      userId: agentFoundationalPromptProps.userId,
    });
  }

  if (textChatLogs?.length) {
    logger.debug("Chat logs accumulated during tool loading", {
      action: "TOOL_CHAT_LOGS",
      logCount: textChatLogs.length,
      lastLogType: textChatLogs[textChatLogs.length - 1].role,
    });
  }

  return _result;
}

async function _generateDynamicPrompt(
  agent: AgentComponentProps,
  message: string,
  agentFoundationalPromptProps: AgentFoundationalPromptProps | null,
  orchestrationProps?: OrchestrationProps,
  contextSets?: ContextContainerProps[]
) {
  const _prompt = orchestrationProps
    ? await _loadPromptBasedOnOrchestrationProps(
        orchestrationProps as OrchestrationProps,
        contextSets || []
      )
    : agentFoundationalPromptProps
    ? await UTILS_loadAgentGlobalPrompt(
        agentFoundationalPromptProps,
        agent,
        agent.type as AgentTypeEnum,
        message
      )
    : "You are a helpful assistant.";
  return _prompt;
}

const _loadPromptBasedOnOrchestrationProps = async (orchestrationProps: OrchestrationProps, contextSets: ContextContainerProps[]) => {
  if(orchestrationProps.agentOrder === "auto") {
    if(orchestrationProps.currentAgent.type === AgentTypeEnum.MANAGER) {
      return await AGENT_WORKFLOW_ORCHESTRATION_PROMPT.autoManager_prompt(
        orchestrationProps as OrchestrationProps,
        contextSets
      );
    } else {
      return await AGENT_WORKFLOW_ORCHESTRATION_PROMPT.autoProcess_prompt(
        orchestrationProps as OrchestrationProps,
        contextSets
      );
    }
  } 
  return "You are a helpful assistant.";
  
}

// Here is a transcript to analyze:
// CLIENT:  hello

// ASSISTANT-HOOK HARBINGER: Hello! How can I assist you today? Are we working on some hooks or lyrics?

// CLIENT:  study the first hook in "Random choruses" and compare with first hook in "Lynns hooks" and provide me with a list of 10 main differences

// ASSISTANT-HOOK HARBINGER: Let's analyze the first hook from "Random Choruses" and compare it with the first hook from "Lynn's Hooks." Here's the breakdown:

// ### Random Chorus Hook: "Uncharted Hearts"
// *I'll take her places they ain't found yet
// I'll put it all on the line
// I'll be that someone she can count on
// One, two, three, four, five*

// ### Lynn's Hook: "Uncharted Hearts"
// *In the shadows where the wild winds blow,
// We'll dance on paths that no one knows,
// With every heartbeat, we'll break the mold,
// Together we'll write a story untold.*

// ### Differences:

// 1. **Imagery**:
// - Random Chorus: Focuses on taking someone to new places.
// - Lynn's Hook: Uses nature imagery (shadows, wild winds) to create a mystical atmosphere.

// 2. **Tone**:
// - Random Chorus: More straightforward and assertive.
// - Lynn's Hook: Evokes a sense of adventure and mystery.

// 3. **Structure**:
// - Random Chorus: Consists of four lines with a conversational tone.
// - Lynn's Hook: Also has four lines but employs a more poetic structure.

// 4. **Rhyme Scheme**:
// - Random Chorus: Lacks a consistent rhyme scheme.
// - Lynn's Hook: Features a clear rhyme scheme (AABB).

// 5. **Emotional Depth**:
// - Random Chorus: Emphasizes reliability and support.
// - Lynn's Hook: Focuses on shared experiences and creating a story together.

// 6. **Language Style**:
// - Random Chorus: Uses colloquial language ("ain't found yet").
// - Lynn's Hook: Employs more lyrical and elevated language.

// 7. **Action vs. Reflection**:
// - Random Chorus: More action-oriented ("I'll take her places").
// - Lynn's Hook: Reflects on the journey and connection ("we'll write a story").

// 8. **Repetition**:
// - Random Chorus: Includes a counting element ("One, two, three, four, five").
// - Lynn's Hook: Lacks numerical repetition, focusing instead on imagery.

// 9. **Perspective**:
// - Random Chorus: First-person perspective with a direct address.
// - Lynn's Hook: Uses a collective "we," creating a sense of unity.

// 10. **Theme**:
// - Random Chorus: Centers on adventure and commitment.
// - Lynn's Hook: Explores the theme of discovery and shared experiences.

// If you need further analysis or assistance, feel free to ask!

// CLIENT:  Please add those differences as an ordered list

// ASSISTANT-DEXTER CONTEXTER: COMPLETE

// modelName gpt-4o-mini
// response {
// result: 'RETRY',
// reason: 'The task was completed but not as requested. The differences were not added as an ordered list as requested by the client.'
// }
