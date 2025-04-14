import {
  AgentTypeEnum,
  AI_Agent_Tools,
  ContextContainerProps,
  OrchestrationProps,
  ServerMessage,
} from "../../types";
import { AGENT_TOOLS_database } from "../../agent-tools/database-tool/database-tool";

import {
  AGENT_TOOLS_agentToAgent,
  AGENT_TOOLS_agentToAgent_v2,
  AGENT_TOOLS_agentToAgent_v3,
} from "../../agent-tools/agent-to-agent";
import { logger } from "../../logger";
import { AgentComponentProps, AISessionState } from "../../types";
import { OrchestrationConfig, OrchestrationType2 } from "../types";
import { ORCH_LEGACY_UTILS_convertToFoundationalProps } from "./legacy_utilities";

import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { TextChatLogProps } from "../../text-chat-log";
import { AGENT_TOOLS_perplexity2 } from "../../agent-tools/perplexity2";
import { AGENT_TOOLS_urlScrape } from "../../agent-tools/url-scrape/url-scrape";
import { AGENT_TOOLS_contextSets } from "../../agent-tools/context-sets";
import {
  AGENT_TOOLS_knowledgeBase_query,
  AGENT_TOOLS_pinecone,
} from "../../agent-tools/pinecone";
import { AGENT_TOOLS_s3Store } from "../../agent-tools/s3-store-tool";
import { AGENT_TOOLS_agentDiary } from "../../agent-tools/agent-diary";
import { AGENT_TOOLS_loadCustomTools } from "../../agent-tools/auto-gen-tool/load-custom-tools";
import { CustomToolDefinition } from "../../agent-tools/auto-gen-tool/tool-generator";
import { LOAD_AGENT_TOOLS } from "../../agent-tools/load-agent-tools";
import { AGENT_TOOLS_dynamicScript } from "../../agent-tools/dynamic-tool/dynamic-action";
import { loadCustomToolsForOrchestration } from "./custom-tool-loader";

export async function ORCHESTRATION_load_agent_tools(
  currentAgent: AgentComponentProps,
  orchestrationConfig: OrchestrationConfig,
  contextSets: ContextContainerProps[],
  history: ServerMessage[],
  vectorStore: MemoryVectorStore,
  textChatLogs: TextChatLogProps[],
  //orchestrationProps: OrchestrationProps,
  teamObjective: string,
  state: AISessionState
) {
  let _result = {};

  const tools = {};

  const allAgents = orchestrationConfig.agents;

  logger.debug("LOAD_TS_TOOLS_AGENT_TYPE", { type: currentAgent.type });

  if (currentAgent.allowedContacts && currentAgent.allowedContacts.length > 0) {
    _result = {
      ..._result,
      ...(await AGENT_TOOLS_agentToAgent_v3({
        agentFoundationalPromptProps:
          ORCH_LEGACY_UTILS_convertToFoundationalProps(
            currentAgent,
            orchestrationConfig,
            contextSets,
            teamObjective
          ),
        availableAgents: currentAgent.allowedContacts,
        contextSets,
        conversationLevel: 0,
        convoThree: {
          response: "",
          state: state,
          history: [],
        },
        convoTwo: {
          response: "",
          state: state,
          history: [],
        },
        messageHistory: history,
        state: state,
        teamName: orchestrationConfig.teamName,
        userId: orchestrationConfig.userId,
        vc: vectorStore,
      })),
    };
  }

  switch (currentAgent.type) {
    case AgentTypeEnum.RESEARCHER:
      _result = {
        ..._result,
        ...tools,
        ...AGENT_TOOLS_perplexity2(),
        ...AGENT_TOOLS_urlScrape(textChatLogs || []),
        ...AGENT_TOOLS_contextSets(
          contextSets,
          textChatLogs || [],
          currentAgent,
          orchestrationConfig.agents.map((agent) => agent.name)
        ),
        ...AGENT_TOOLS_pinecone(textChatLogs || []),
        ...AGENT_TOOLS_database(
          contextSets,
          orchestrationConfig.userId || "",
          currentAgent.name,
          orchestrationConfig.agents.filter(
            (agent) => agent.name !== currentAgent.name
          )
        ),
        ...AGENT_TOOLS_s3Store(contextSets, currentAgent),
      };
      break;
    case AgentTypeEnum.CONTEXT_MANAGER:
      _result = {
        ...tools,
        ...AGENT_TOOLS_contextSets(
          contextSets,
          textChatLogs || [],
          currentAgent,
          orchestrationConfig.agents.map((agent) => agent.name)
        ),
      };
      break;
    case AgentTypeEnum.RECORDS:
      _result = {
        ..._result,
        ...tools,
        ...(await AGENT_TOOLS_agentDiary(
          currentAgent.name,
          orchestrationConfig.teamName || "",
          orchestrationConfig.userId || "",
          textChatLogs || []
        )),
      };
      break;
    case AgentTypeEnum.MANAGER:
      if (orchestrationConfig.type === OrchestrationType2.LLM_ROUTED_WORKFLOW || orchestrationConfig.type === OrchestrationType2.MANAGER_DIRECTED_WORKFLOW) {
        _result = {
          ..._result,
          ...AGENT_TOOLS_pinecone(textChatLogs || []),
          ...AGENT_TOOLS_database(
            contextSets,
            orchestrationConfig.userId || "",
            currentAgent.name,
            orchestrationConfig.agents.filter(
              (agent) => agent.name !== currentAgent.name
            )
          ),
          ...AGENT_TOOLS_contextSets(
            contextSets,
            textChatLogs || [],
            currentAgent,
            orchestrationConfig.agents.map((agent) => agent.name)
          ),
        };
        break;
      }
      if (
        orchestrationConfig.agents.some(
          (agent) => agent.type === AgentTypeEnum.CONTEXT_MANAGER
        )
      ) {
        _result = {
          ..._result,
          ...(await AGENT_TOOLS_agentToAgent(
            0,
            ORCH_LEGACY_UTILS_convertToFoundationalProps(
              currentAgent,
              orchestrationConfig,
              contextSets,
              teamObjective
            ),
            history,
            state,
            {
              response: "",
              state: state,
              history: [],
            },
            {
              response: "",
              state: state,
              history: [],
            },
            orchestrationConfig.teamName || "",
            orchestrationConfig.userId || "",
            false,
            contextSets,
            vectorStore,
            []
          )),
        };
      } else {
        _result = {
          ..._result,
          ...(await AGENT_TOOLS_agentToAgent(
            0,
            ORCH_LEGACY_UTILS_convertToFoundationalProps(
              currentAgent,
              orchestrationConfig,
              contextSets,
              teamObjective
            ),
            history,
            state,
            {
              response: "",
              state: state,
              history: [],
            },
            {
              response: "",
              state: state,
              history: [],
            },
            orchestrationConfig.teamName || "",
            orchestrationConfig.userId || "",
            false,
            contextSets,
            vectorStore,
            []
          )),
          ...AGENT_TOOLS_contextSets(
            contextSets,
            textChatLogs || [],
            currentAgent,
            orchestrationConfig.agents.map((agent) => agent.name)
          ),
        };
      }
      break;

    case AgentTypeEnum.TOOL_OPERATOR:
      // No need to check customTools - all tools (standard and custom) are now in the tools array
      
      _result = {
        ..._result,
        ...tools,
        ...(await LOAD_AGENT_TOOLS(
          currentAgent.tools || [],
          {},
          contextSets,
          vectorStore,
          textChatLogs || [],
          state,
          currentAgent.name,
          orchestrationConfig.userId || "",
          "",
          //undefined // No longer passing customTools
        )),
      };
      break;

    case AgentTypeEnum.DYNAMIC_TOOL:
      _result = {
        ..._result,
        ...(await AGENT_TOOLS_dynamicScript(
          currentAgent.name,
          orchestrationConfig.userId || "",
          textChatLogs || []
        )),
      };
      currentAgent.tools = [
        ...(currentAgent.tools || []),
        AI_Agent_Tools.DYNAMIC_SCRIPT,
      ];
      _result = {
        ..._result,
        ...tools,
        ...LOAD_AGENT_TOOLS(
          currentAgent.tools || [],
          {},
          contextSets,
          vectorStore,
          textChatLogs || [],
          state,
          currentAgent.name,
          orchestrationConfig.userId || "",
          ""
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

  // Then, add custom tools handling
  if (currentAgent.tools && currentAgent.tools.length > 0) {
    try {
      // Load custom tools from references
      const customTools = await loadCustomToolsForOrchestration(
        currentAgent.name,
        currentAgent.tools as string[],
        orchestrationConfig.userId || ""
      );
      
      // Merge with standard tools
      _result = {
        ..._result,
        ...customTools
      };
      
      if (Object.keys(customTools).length > 0) {
        logger.tool("Added custom tools to orchestration", {
          agentName: currentAgent.name,
          toolCount: Object.keys(customTools).length,
          toolNames: Object.keys(customTools).join(", ")
        });
      }
    } catch (error) {
      logger.error("Error loading custom tools for orchestration", {
        error, 
        agentName: currentAgent.name
      });
    }
  }

  _result = {
    ..._result,

    // ...(await AGENT_TOOLS_agentDiary(
    //   agentFoundationalPromptProps.thisAgentName,
    //   agentFoundationalPromptProps.teamName || "",
    //   agentFoundationalPromptProps.userId || ""
    // )),
  };
  if (currentAgent.hasKnowledgeBase) {
    _result = {
      ..._result,
      ...AGENT_TOOLS_knowledgeBase_query(
        orchestrationConfig.userId || "",
        currentAgent.name,
        orchestrationConfig.teamName || ""
      ),
    };
  }
  logger.tool("Loading agent-specific tools", {
    action: "LOAD_AGENT_TOOLS",
    agentType: currentAgent.type,
    toolCount: Object.keys(_result).length,
    hasKnowledgeBase: currentAgent.hasKnowledgeBase,
  });

  // Log information about custom tools if present, but only for TOOL_OPERATOR agents
  if (
    currentAgent.type === AgentTypeEnum.TOOL_OPERATOR &&
    currentAgent.tools?.some(tool => typeof tool === 'string' && tool.startsWith('CUSTOM_TOOL:'))
  ) {
    const customToolRefs = currentAgent.tools.filter(
      tool => typeof tool === 'string' && tool.startsWith('CUSTOM_TOOL:')
    );
    
    logger.tool("Custom tools available to TOOL_OPERATOR", {
      action: "CUSTOM_TOOLS_LOADED",
      agentName: currentAgent.name,
      customToolCount: customToolRefs.length,
      customToolRefs: customToolRefs.join(", "),
    });
  }

  logger.tool("Validating tool configuration", {
    action: "VALIDATE_TOOL_CONFIG",
    agentType: currentAgent.type,
    requestedTools: tools ? Object.keys(tools).length : 0,
    hasContextSets: !!contextSets?.length,
  });

  try {
    // ... existing tool loading code ...
  } catch (error) {
    logger.error("Failed to load agent tools", {
      action: "TOOL_LOAD_ERROR",
      agentType: currentAgent.type,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  logger.tool("Successfully loaded agent tools", {
    action: "TOOLS_LOADED",
    agentName: currentAgent.name,
    agentType: currentAgent.type,
    loadedTools: Object.keys(_result),
    totalTools: Object.keys(_result).length,
  });

  if (currentAgent.hasKnowledgeBase) {
    logger.log("Loading knowledge base tools", {
      action: "LOAD_KB_TOOLS",
      agent: currentAgent.name,
      userId: orchestrationConfig.userId || "",
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
