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
import { AGENT_TOOLS_contextSets } from "../../agent-tools/context-sets/context-sets";
import {
  AGENT_TOOLS_knowledgeBase_query,
  AGENT_TOOLS_pinecone,
} from "../../agent-tools/pinecone-db/pinecone";
import { AGENT_TOOLS_s3Store } from "../../agent-tools/s3-store-tool";
import { AGENT_TOOLS_agentDiary } from "../../agent-tools/agent-diary";
import { AGENT_TOOLS_loadCustomTools } from "../../agent-tools/auto-gen-tool/load-custom-tools";
import { CustomToolDefinition } from "../../agent-tools/auto-gen-tool/tool-generator";
import { LOAD_AGENT_TOOLS } from "../../agent-tools/load-agent-tools";
import { AGENT_TOOLS_dynamicScript } from "../../agent-tools/dynamic-tool/dynamic-action";
import { loadCustomToolsForOrchestration } from "./custom-tool-loader";
import { AGENT_TOOLS_puppeteer } from "../../agent-tools/puppeteer-tool/puppeteer";
import { AGENT_TOOLS_fetch } from "../../agent-tools/fetch/fetch";
import { AGENT_TOOLS_gmail } from "../../agent-tools/gmail";
import { AGENT_TOOLS_NEXT_AUTH } from "../../agent-tools/next-auth-tool/next-auth-tool";
import { AGENT_TOOLS_DOCUMENT_PARSE } from "../../agent-tools/documents-tools/document-parse-tool";
import { AGENT_TOOLS_autoGenTool } from "../../agent-tools/auto-gen-tool/auto-gen-tool";
import { AGENT_TOOLS_documentProcessor } from "../../agent-tools/documents-tools/document-processor";
import { AGENT_TOOLS_video } from "../../agent-tools/video-gen/runway-video-tool";
import { AGENT_TOOLS_splitters } from "../../agent-tools/pinecone-db/pinecone";
import { isCustomToolReference } from "../../agent-tools/tool-registry/custom-tool-ref";

export async function ORCHESTRATION_load_agent_tools(
  currentAgent: AgentComponentProps,
  orchestrationConfig: OrchestrationConfig,
  contextSets: ContextContainerProps[],
  history: ServerMessage[],
  vectorStore: MemoryVectorStore,
  textChatLogs: TextChatLogProps[],
  teamObjective: string,
  state: AISessionState
) {
  let loadedTools: Record<string, any> = {};
  const allAgentNames = orchestrationConfig.agents.map((agent) => agent.name);
  const loadedToolKeys = new Set<string>(); // Keep track of keys added

  logger.debug("ORCHESTRATION_load_agent_tools - START", { agentName: currentAgent.name, agentType: currentAgent.type });

  // Helper function to merge tools and track keys
  const mergeTools = (newTools: Record<string, any>) => {
    // Merge only the tools whose keys weren't already loaded
    const toolsToMerge = Object.fromEntries(
         Object.entries(newTools).filter(([key]) => !loadedToolKeys.has(key))
    );
    loadedTools = { ...loadedTools, ...toolsToMerge };
    Object.keys(toolsToMerge).forEach(key => loadedToolKeys.add(key));
  };

  // 1. Load Agent-to-Agent communication tools (if configured based on allowedContacts)
  // This handles agent-to-agent V3 based on direct permissions
  if (currentAgent.allowedContacts && currentAgent.allowedContacts.length > 0) {
    try {
      const agentCommTools = await AGENT_TOOLS_agentToAgent_v3({
        agentFoundationalPromptProps: ORCH_LEGACY_UTILS_convertToFoundationalProps(
            currentAgent, orchestrationConfig, contextSets, teamObjective
          ),
        availableAgents: currentAgent.allowedContacts,
        contextSets,
        conversationLevel: 0,
        convoThree: { response: "", state: state, history: [] },
        convoTwo: { response: "", state: state, history: [] },
        messageHistory: history,
        state: state,
        teamName: orchestrationConfig.teamName,
        userId: orchestrationConfig.userId,
        vc: vectorStore,
      });
      mergeTools(agentCommTools);
      logger.tool("Loaded agent communication tools (v3 based on allowedContacts)", { agentName: currentAgent.name, count: Object.keys(agentCommTools).length });
    } catch (error) {
      logger.error("Error loading agent communication tools (v3)", { error, agentName: currentAgent.name });
    }
  }

  // 2. Load IMPLICIT Standard Tools based on Agent Type
  logger.debug("Loading implicit tools based on type", { agentName: currentAgent.name, type: currentAgent.type });
  try {
      let implicitTools = {};
  switch (currentAgent.type) {
    case AgentTypeEnum.RESEARCHER:
              implicitTools = {
        ...AGENT_TOOLS_urlScrape(textChatLogs || []),
                  ...AGENT_TOOLS_perplexity2(),
              };
              logger.tool("Implicitly loaded RESEARCHER tools", { agentName: currentAgent.name, keys: Object.keys(implicitTools) });
      break;
    case AgentTypeEnum.CONTEXT_MANAGER:
              implicitTools = {
                  ...AGENT_TOOLS_contextSets(contextSets, textChatLogs || [], currentAgent, allAgentNames)
              };
               logger.tool("Implicitly loaded CONTEXT_MANAGER tools", { agentName: currentAgent.name, keys: Object.keys(implicitTools) });
      break;
    case AgentTypeEnum.RECORDS:
               implicitTools = {
                  ...(await AGENT_TOOLS_agentDiary(currentAgent.name, orchestrationConfig.teamName || "", orchestrationConfig.userId || "", textChatLogs || []))
               }
                logger.tool("Implicitly loaded RECORDS tools", { agentName: currentAgent.name, keys: Object.keys(implicitTools) });
               break;
           case AgentTypeEnum.DYNAMIC_TOOL:
                implicitTools = {
                   ...(await AGENT_TOOLS_dynamicScript(currentAgent.name, orchestrationConfig.userId || "", textChatLogs || []))
                }
                 logger.tool("Implicitly loaded DYNAMIC_TOOL tools", { agentName: currentAgent.name, keys: Object.keys(implicitTools) });
      break;
          // --- BEGIN MANAGER IMPLICIT LOGIC ---
    case AgentTypeEnum.MANAGER:
              // Logic based on the old LOAD_TYPE_SPECIFIC_TOOLS function
      if (orchestrationConfig.type === OrchestrationType2.LLM_ROUTED_WORKFLOW || orchestrationConfig.type === OrchestrationType2.MANAGER_DIRECTED_WORKFLOW) {
                  // In specific workflow modes, Manager gets DB, Pinecone, ContextSets implicitly
                   implicitTools = {
          ...AGENT_TOOLS_pinecone(textChatLogs || []),
                       ...AGENT_TOOLS_database(contextSets, orchestrationConfig.userId || "", currentAgent.name),
                       ...AGENT_TOOLS_contextSets(contextSets, textChatLogs || [], currentAgent, allAgentNames),
                   };
                    logger.tool("Implicitly loaded MANAGER tools (Workflow Mode)", { agentName: currentAgent.name, keys: Object.keys(implicitTools) });
              } else {
                  // In other modes (or if type is undefined/different)
                  // Manager always got AGENT_TOOLS_agentToAgent (V1/V2).
                  // We are already handling V3 based on allowedContacts in section #1.
                  // Avoid loading the older V1/V2 here unless specifically needed and distinct.
                  // Check if CONTEXT_SETS should be loaded implicitly only if no Context Manager exists
                  const hasContextManager = orchestrationConfig.agents.some(
          (agent) => agent.type === AgentTypeEnum.CONTEXT_MANAGER
                  );
                  if (!hasContextManager) {
                      implicitTools = {
                          ...AGENT_TOOLS_contextSets(contextSets, textChatLogs || [], currentAgent, allAgentNames),
                      };
                      logger.tool("Implicitly loaded MANAGER tools (No Context Manager)", { agentName: currentAgent.name, keys: Object.keys(implicitTools) });
      } else {
                      logger.tool("MANAGER in non-workflow mode, no implicit tools loaded (Context Manager exists)", { agentName: currentAgent.name });
                  }
      }
      break;
          // --- END MANAGER IMPLICIT LOGIC ---
          default:
              // No implicit tools for other types by default
              break;
      }
      mergeTools(implicitTools); // Merge implicit tools into the main object
  } catch (error) {
      logger.error("Error loading implicit tools", { error, agentName: currentAgent.name, type: currentAgent.type });
  }

  // 3. Load EXPLICIT Standard Tools from currentAgent.tools array
  const explicitStandardToolRefs = (currentAgent.tools || [])
      .filter(Boolean)
      .filter(name => !isCustomToolReference(name as string)) as AI_Agent_Tools[];

  logger.debug("Identified explicit standard tool references", { agentName: currentAgent.name, refs: explicitStandardToolRefs });

  for (const toolRef of explicitStandardToolRefs) {
      try {
          let toolSet = {};
          // Load standard tool based on switch
          switch (toolRef) {
              // --- Cases for ALL standard tools ---
              case AI_Agent_Tools.PERPLEXITY: toolSet = AGENT_TOOLS_perplexity2(); break;
              case AI_Agent_Tools.URL_SCRAPE: toolSet = AGENT_TOOLS_urlScrape(textChatLogs || []); break;
              case AI_Agent_Tools.CONTEXT_SETS: toolSet = AGENT_TOOLS_contextSets(contextSets, textChatLogs || [], currentAgent, allAgentNames); break;
              case AI_Agent_Tools.PINECONE: toolSet = AGENT_TOOLS_pinecone(textChatLogs || []); break;
              case AI_Agent_Tools.DATABASE: toolSet = AGENT_TOOLS_database(contextSets, orchestrationConfig.userId || "", currentAgent.name); break;
              case AI_Agent_Tools.FILE_STORE: toolSet = AGENT_TOOLS_s3Store(contextSets, currentAgent); break;
              
              case AI_Agent_Tools.DYNAMIC_SCRIPT: toolSet = await AGENT_TOOLS_dynamicScript(currentAgent.name, orchestrationConfig.userId || "", textChatLogs || []); break;
              case AI_Agent_Tools.FETCH: toolSet = AGENT_TOOLS_fetch(textChatLogs || []); break;
              case AI_Agent_Tools.PUPPETEER: toolSet = AGENT_TOOLS_puppeteer("local", vectorStore, textChatLogs || []); break;
              case AI_Agent_Tools.GMAIL: toolSet = AGENT_TOOLS_gmail(textChatLogs || [], orchestrationConfig.userId || ""); break;
              case AI_Agent_Tools.OAUTH_PROVIDER: toolSet = AGENT_TOOLS_NEXT_AUTH( orchestrationConfig.userId || "", "", currentAgent, contextSets, vectorStore, textChatLogs || [] ); break;
              case AI_Agent_Tools.DOCUMENT_PARSE: toolSet = AGENT_TOOLS_DOCUMENT_PARSE(); break;
              case AI_Agent_Tools.AUTO_GEN_TOOL: toolSet = AGENT_TOOLS_autoGenTool(currentAgent.name, orchestrationConfig.userId || "", textChatLogs || []); break;
              case AI_Agent_Tools.DOCUMENT_PROCESSOR: toolSet = AGENT_TOOLS_documentProcessor(orchestrationConfig.userId || "", currentAgent.name, textChatLogs || []); break;
              case AI_Agent_Tools.VIDEO_GEN: toolSet = AGENT_TOOLS_video(orchestrationConfig.userId || "", currentAgent.name); break;
              case AI_Agent_Tools.TEXT_SPLITTER: toolSet = AGENT_TOOLS_splitters(state, textChatLogs || []); break;
              default: logger.warn(`Explicit standard tool reference not handled: ${toolRef}`, { agentName: currentAgent.name }); continue; // Skip unknown refs
          }
          mergeTools(toolSet); // Use helper to merge and track keys (avoids duplicates)
      } catch (error) {
          logger.error(`Error loading explicit standard tool: ${toolRef}`, { error, agentName: currentAgent.name });
      }
  }
  logger.tool("Processed explicit standard tools from agent config", { agentName: currentAgent.name, count: explicitStandardToolRefs.length });

  // 4. Load Custom Tools (Handles CUSTOM_TOOL:... references)
  if (currentAgent.tools && currentAgent.tools.length > 0) {
    try {
      const customTools = await loadCustomToolsForOrchestration(
        currentAgent.name,
        currentAgent.tools as string[],
        orchestrationConfig.userId || ""
      );
      // Merge custom tools - these should have unique names generated by the factory/registry
      mergeTools(customTools);
      
      if (Object.keys(customTools).length > 0) {
        logger.tool("Loaded custom tools", {
          agentName: currentAgent.name,
          toolCount: Object.keys(customTools).length,
          toolNames: Object.keys(customTools).join(", ")
        });
      }
    } catch (error) {
      logger.error("Error loading custom tools", { error, agentName: currentAgent.name });
    }
  }

  // 5. Load Knowledge Base query tool (if configured)
  if (currentAgent.hasKnowledgeBase) {
    try {
      const kbTool = AGENT_TOOLS_knowledgeBase_query(
        orchestrationConfig.userId || "",
        currentAgent.name,
        orchestrationConfig.teamName || ""
      );
      mergeTools(kbTool); // Use helper to merge and track keys
      logger.tool("Loaded knowledge base query tool", { agentName: currentAgent.name, keys: Object.keys(kbTool).filter(key => !loadedToolKeys.has(key)) }); // Log only newly added keys if needed
    } catch (error) {
      logger.error("Error loading knowledge base query tool", { error, agentName: currentAgent.name });
    }
  }

  // 6. Final Logging and Return
  logger.tool("ORCHESTRATION_load_agent_tools - FINISHED", {
    action: "TOOLS_LOADED",
    agentName: currentAgent.name,
    agentType: currentAgent.type,
    loadedToolKeys: Array.from(loadedToolKeys), // Log the tracked keys
    totalTools: loadedToolKeys.size,
    hasKnowledgeBase: currentAgent.hasKnowledgeBase,
  });

  console.log(`Final tools loaded for ${currentAgent.name}:`, Array.from(loadedToolKeys));

  if (textChatLogs?.length) {
    logger.debug("Chat logs during tool loading", {
      action: "TOOL_CHAT_LOGS",
      count: textChatLogs.length,
      lastRole: textChatLogs[textChatLogs.length - 1]?.role
    });
  }

  return loadedTools; // Return the final merged object
}
