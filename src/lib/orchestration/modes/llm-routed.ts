import {
    AgentTurnInput,
    AgentTurnResult,
    OrchestrationConfig,
    OrchestrationFinalResult,
    OrchestrationState,
    OrchestrationType2,
} from "../types";
import {
    ORCHESTRATION_executeAgentTurn,
    ORCHESTRATION_getLLMSummary,
    ORCHESTRATION_isCancelled,
    ORCHESTRATION_isPaused,
    ORCHESTRATION_resetAllControlFlags,
    ORCHESTRATION_setActiveAgent,
    ORCHESTRATION_shouldContinueFromPause,
    ORCHESTRATION_summarizeHistoryToString,
    ORCHESTRATION_getSummarizedHistory,
} from "../utils";
import { logger } from "@/src/lib/logger";
import { AISessionState, AgentComponentProps, AgentTypeEnum, ContextContainerProps, ServerMessage } from "@/src/lib/types";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { generateObject } from "ai";
import { z } from "zod";
import { MODEL_getModel_ai } from "@/src/lib/vercelAI-model-switcher";
import { UTILS_convertLineSetsToContext, UTILS_getModelArgsByName, UTILS_getModelsJSON } from "@/src/lib/utils";
import { AGENT_FORM_creator, AGENT_FORM_reWriteRequestMessage } from "@/src/lib/post-message-analysis/agent-request-form-creator";
import { UTILS_TEAMS_infoRequestContextFormSet } from "@/src/lib/teams/lib/teams-utils"; // Assuming this path is correct

// --- Interfaces --- //

// Interface for the result of the LLM routing decision
interface LLMRoutingResult {
    nextAgentName: string;
    contextRequest: boolean;
    redirectToUser: boolean;
    infoRequest: boolean; // Specifically asking user for form-fillable info
    rewrittenMessage: string; // Message intended for the next step (agent or user)
    workflowComplete: boolean;
    reasonForDecision: string;
    newContext?: ContextContainerProps[]; // Context updated by the routing LLM itself or by form creation
    infoRequestFormSchema?: any; // Schema for user form if infoRequest=true
}

// --- Helper Functions --- //

// Determine Primary Instructions based on Source
function _getPrimaryInstructions(
    messageSource: "user" | "agent" | "manager" | "system",
    managerAgentName: string,
    allAgents: AgentComponentProps[],
    currentMessage: string
): string {
    switch (messageSource) {
        case "user":
            return `CRITICAL RULE: This message is FROM THE USER. You MUST set nextAgent to "${managerAgentName}" and redirectToUser to false. This rule takes priority over any other consideration.`;
        case "agent":
            return `This message is from an agent. The next agent should be "${managerAgentName}" unless explicitly requesting another agent. Never set redirectToUser to true.`;
        case "manager":
            const mentionedAgent = allAgents.find(a =>
                currentMessage.includes(`@${a.name}`) || currentMessage.includes(`${a.name},`)
            );
            if (mentionedAgent) {
                return `This message is from "${managerAgentName}". It mentions a specific agent (${mentionedAgent.name}). Route to that agent. Only set redirectToUser=true if explicitly asking the USER for info.`;
            } else {
                 return `This message is from "${managerAgentName}". It doesn't mention a specific agent. Route to "${managerAgentName}" by default unless a user request is being made. Mark workflowComplete=true ONLY if the manager indicates completion AND makes no further requests. Only set redirectToUser=true if explicitly asking the USER for info.`;
            }
        case "system":
            return `This message is from the system. The next agent should be "${managerAgentName}". Never set redirectToUser to true.`;
        default:
            return `Default: Route to "${managerAgentName}" unless message explicitly directs otherwise or requests user input.`;
    }
}

// Format Agent List for Prompt
function _formatAgentsAndTheirProperties(
    agents: AgentComponentProps[]
): string {
    return agents
        .map(
            (agent) => `
      <agent>
          <name>${agent.name}</name>
          <type>${agent.type}</type>
          <title>${agent.title}</title>
          <roleDescription>${agent.roleDescription}</roleDescription>
      </agent>`
        )
        .join("\n");
}

// Format Final Result (Helper)
function formatFinalResult(state: OrchestrationState): OrchestrationFinalResult {
    const finalStatus =
        state.status === "completed" ||
            state.status === "cancelled" ||
            state.status === "error"
            ? state.status
            : "stopped";
    return {
        status: finalStatus,
        finalConversationHistory: state.conversationHistory,
        finalContextSets: state.contextSets,
        error: state.error,
        totalRounds: state.currentRound,
    };
}

// --- LLM Routing Logic --- //
async function _determineNextStepLLM(
    currentMessage: string,
    historySummaryString: string,
    contextSets: ContextContainerProps[],
    allAgents: AgentComponentProps[],
    messageSource: "user" | "agent" | "manager" | "system",
    messageSenderAgent: AgentComponentProps | null,
    config: OrchestrationConfig
): Promise<LLMRoutingResult> {
    logger.log("Executing LLM routing determination...");

    const managerAgent = allAgents.find(a => a.type === AgentTypeEnum.MANAGER);
    const managerAgentName = managerAgent?.name || "Agent Chief";

    const primaryInstructions = _getPrimaryInstructions(messageSource, managerAgentName, allAgents, currentMessage);
    const truncatedContext = contextSets.length > 5 ? contextSets.slice(-5) : contextSets;
    const contextString = UTILS_convertLineSetsToContext(truncatedContext, "");

    const llmPrompt = `
<ORCHESTRATION_TASK>
  <OBJECTIVE>Determine the next recipient of the message OR the next action to take based on the current state.</OBJECTIVE>
  <PRIMARY_INSTRUCTIONS>${primaryInstructions}</PRIMARY_INSTRUCTIONS>

  <!-- Source of message: ${messageSource} -->
  <!-- IMPORTANT: If source is "user", nextAgent MUST be "${managerAgentName}" and redirectToUser MUST be false -->

  <CONVERSATION_DATA>
    <INITIAL_QUERY>${config.initialMessage}</INITIAL_QUERY>
    <CONVERSATION_HISTORY>${historySummaryString}</CONVERSATION_HISTORY>
    <CURRENT_MESSAGE>${currentMessage}</CURRENT_MESSAGE>
  </CONVERSATION_DATA>

  <MESSAGE_REWRITE_INSTRUCTIONS>
    <INSTRUCTIONS>Rewrite the current message for the intended recipient (next agent or user). Remove routing instructions (like @AgentName) and any other extraneous information. If redirecting to the user, ensure the message clearly states what is needed.</INSTRUCTIONS>
    <EXAMPLES>
      <EXAMPLE input="@Data Analyst, analyze the data." output="Analyze the data." nextAgent="Data Analyst" />
      <EXAMPLE input="Ok, I need the user's email address." output="Message to user: To proceed, please provide your email address." redirectToUser="true" />
    </EXAMPLES>
  </MESSAGE_REWRITE_INSTRUCTIONS>

  <DECISION_CRITERIA>
    <CRITERION name="nextAgent" type="string">
      <CONDITION>Agent name best suited to handle the REWRITTEN message, or the agent explicitly mentioned.</CONDITION>
      <RULE>Always select a nextAgent, even if redirecting to user. Default to "${managerAgentName}" if no other agent fits, if workflow is complete, or if routing to user.</RULE>
      <PRIORITY_RULE>PREFER the agent explicitly mentioned (@AgentName) in the CURRENT_MESSAGE if present.</PRIORITY_RULE>
    </CRITERION>
    <CRITERION name="contextRequest" type="boolean">
      <TRUE_CONDITION>CURRENT_MESSAGE explicitly requests a context update AND provides the necessary information, AND that information isn't already obviously present in CURRENT_CONTEXT.</TRUE_CONDITION>
      <FALSE_CONDITION>Otherwise.</FALSE_CONDITION>
    </CRITERION>
     <CRITERION name="infoRequest" type="boolean">
       <TRUE_CONDITION>CURRENT_MESSAGE explicitly requests specific, structured information that ONLY the user can provide to continue the workflow.</TRUE_CONDITION>
       <FALSE_CONDITION>Otherwise (e.g., status updates, agent tasks, general user questions).</FALSE_CONDITION>
    </CRITERION>
    <CRITERION name="redirectToUser" type="boolean">
      <TRUE_CONDITION>ONLY when the CURRENT_MESSAGE explicitly requests information/action that ONLY the user can provide AND the workflow is BLOCKED without it.</TRUE_CONDITION>
      <RULE>NEVER redirect for status updates, progress reports, confirmations, or agent-to-agent task handoffs.</RULE>
      <RULE>If CURRENT_MESSAGE is fulfilling a previous user request, set redirectToUser=false (route to manager).</RULE>
      <RULE>If infoRequest=true, then redirectToUser MUST be true.</RULE>
    </CRITERION>
    <CRITERION name="workflowComplete" type="boolean">
      <TRUE_CONDITION>Manager indicates completion AND doesn't assign a new task OR request user input.</TRUE_CONDITION>
      <FALSE_CONDITION>Tasks pending, specific agent action requested, or user input needed.</FALSE_CONDITION>
    </CRITERION>
  </DECISION_CRITERIA>

  <AVAILABLE_AGENTS>
    ${_formatAgentsAndTheirProperties(allAgents)}
  </AVAILABLE_AGENTS>

  <CURRENT_CONTEXT>
    ${contextString}
  </CURRENT_CONTEXT>

</ORCHESTRATION_TASK>
`;

    const schema = z.object({
        nextAgent: z.string().describe(`Name of the agent to handle the next step. MUST be one of [${allAgents.map(a => a.name).join(', ')}]. Default to "${managerAgentName}" if unsure, completing, or routing to user.`),
        contextRequest: z.boolean().describe("True if the CURRENT message provides new info AND explicitly asks for a context update."),
        infoRequest: z.boolean().describe("True ONLY if CURRENT message explicitly asks user for specific info needed to proceed."),
        redirectToUser: z.boolean().describe("True ONLY if workflow is BLOCKED without specific user input/action requested in CURRENT message."),
        rewrittenMessage: z.string().describe("The CURRENT_MESSAGE, rewritten for the next step (agent task or user request). Remove @mentions."),
        workflowComplete: z.boolean().describe("True if the manager indicates completion with no further tasks."),
        reasonForDecision: z.string().describe("Brief explanation for the routing decision."),
    });

    try {
        const llmArgs = UTILS_getModelArgsByName(UTILS_getModelsJSON().OpenAI["gpt-4o-mini"].name);
        const model = await MODEL_getModel_ai(llmArgs);

        const llmResult = await generateObject({
            model: model,
            schema: schema,
            prompt: llmPrompt,
            maxRetries: 1,
        });

        let finalResult: LLMRoutingResult = {
            nextAgentName: llmResult.object.nextAgent,
            contextRequest: llmResult.object.contextRequest,
            infoRequest: llmResult.object.infoRequest,
            redirectToUser: llmResult.object.redirectToUser,
            rewrittenMessage: llmResult.object.rewrittenMessage,
            workflowComplete: llmResult.object.workflowComplete,
            reasonForDecision: llmResult.object.reasonForDecision,
        };

        if (finalResult.infoRequest) {
            logger.log("InfoRequest detected, generating form...");
            try {
                 const formSchema = await AGENT_FORM_creator(finalResult.rewrittenMessage);
                 finalResult.infoRequestFormSchema = formSchema;
                 const formContextSet = UTILS_TEAMS_infoRequestContextFormSet(
                     formSchema, [], managerAgent ?? allAgents[0], [], false
                 );
                 finalResult.newContext = [...contextSets, formContextSet];
                 finalResult.contextRequest = true;
                 finalResult.rewrittenMessage = await AGENT_FORM_reWriteRequestMessage(
                     finalResult.rewrittenMessage, formSchema.formName ?? "Information Request"
                 );
                 finalResult.redirectToUser = true;
                 logger.log("Form generated and context updated for InfoRequest.");
            } catch (formError) {
                 logger.error("Failed to generate info request form", { formError });
                 finalResult.infoRequest = false;
                 finalResult.redirectToUser = false;
                 finalResult.rewrittenMessage = "Error: Could not generate the required information form. Please inform the manager.";
                 finalResult.nextAgentName = managerAgentName;
            }
        } else if (finalResult.contextRequest) {
            if(finalResult.newContext) {
                 logger.log("Context update indicated by routing LLM (via newContext).");
            } else {
                 logger.log("Context update requested for next agent.");
            }
        }

        if (messageSource === "user") {
            finalResult.nextAgentName = managerAgentName;
            finalResult.redirectToUser = false;
            finalResult.infoRequest = false;
            logger.log("Enforced rule: Message from user goes to manager, no user redirect.");
        }
        if (!finalResult.workflowComplete && !allAgents.some(a => a.name === finalResult.nextAgentName)) {
            logger.warn(`LLM selected invalid agent '${finalResult.nextAgentName}', defaulting to manager '${managerAgentName}'.`);
            finalResult.nextAgentName = managerAgentName;
        }
        if(finalResult.redirectToUser || finalResult.infoRequest){
           finalResult.nextAgentName = managerAgentName;
        }

        return finalResult;

    } catch (error) {
        logger.error("Error in _determineNextStepLLM generateObject call", { error });
        return {
            nextAgentName: managerAgentName,
            contextRequest: false,
            redirectToUser: false,
            infoRequest: false,
            rewrittenMessage: `Error during routing. Original message: ${currentMessage}`,
            workflowComplete: false,
            reasonForDecision: "Fallback due to LLM routing error.",
        };
    }
}

// --- Main Workflow Function --- //

/**
 * Runs a dynamically routed workflow using an LLM to determine the next step.
 */
export async function ORCHESTRATION_runLLMRoutedWorkflow(
    initialState: OrchestrationState,
    sessionState: AISessionState,
    
): Promise<OrchestrationFinalResult> {
    let state = { ...initialState };
    state.status = "running";
    state.currentRound = 0;

    const { agents, maxRounds = 15 } = state.config;
    const managerAgent = agents.find(a => a.type === AgentTypeEnum.MANAGER);

    if (!managerAgent) {
       logger.error("LLM_ROUTED_WORKFLOW requires a 'manager' type agent.");
        state.status = "error";
        state.error = "LLM_ROUTED_WORKFLOW requires a 'manager' type agent.";
        return formatFinalResult(state);
    }

    try {
        logger.log("Starting LLM_ROUTED_WORKFLOW", { config: state.config });

        while (state.status === "running" || state.status === "paused") {
            if (state.currentRound >= maxRounds) {
                logger.warn(`LLM_ROUTED_WORKFLOW reached maximum round limit (${maxRounds}). Stopping.`);
                state.status = "completed";
                state.error = "Maximum round limit reached.";
                break;
            }
            logger.log(`LLM Route - Round ${state.currentRound + 1}`);

            if (ORCHESTRATION_isCancelled()) {
                logger.log("Workflow cancelled.");
                state.status = "cancelled";
                break;
            }
            if (ORCHESTRATION_isPaused()) {
                 logger.log("Workflow paused. Waiting for continue signal...");
                 while (ORCHESTRATION_isPaused() && !ORCHESTRATION_shouldContinueFromPause()) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                 }
                 if (ORCHESTRATION_isCancelled()) continue;
                 logger.log("Workflow resuming...");
            }

            const lastMessage = state.conversationHistory[state.conversationHistory.length - 1];
            const currentMessage = lastMessage?.content || state.config.initialMessage;
            const lastAgent = agents.find(a => a.name === lastMessage?.agentName);

            let messageSource: "user" | "agent" | "manager" | "system" = "system";
             if (state.currentRound === 0 && state.conversationHistory.length <= 1) {
                 messageSource = "user";
             } else if (lastMessage?.role === "user") {
                 messageSource = "user";
             } else if (lastAgent) {
                 messageSource = lastAgent.type === AgentTypeEnum.MANAGER ? "manager" : "agent";
             } else if (lastMessage?.role === "system") {
                 messageSource = "system";
             }

            const historySummaryString = ORCHESTRATION_summarizeHistoryToString(
                state.conversationHistory, 10, true
            );

            const routingResult = await _determineNextStepLLM(
                currentMessage,
                historySummaryString,
                state.contextSets,
                state.config.agents,
                messageSource,
                lastAgent || null,
                state.config
            );
             logger.log("LLM Routing Decision:", { routingResult });

            if (routingResult.workflowComplete) {
                logger.log("LLM indicated workflow complete.");
                state.status = "completed";
                break;
            }

             if (routingResult.contextRequest && routingResult.newContext) {
                state.contextSets = routingResult.newContext;
                logger.log("Context sets updated by routing LLM.");
            }

            if (routingResult.redirectToUser) {
                logger.log("Redirecting to user for input/action.", { hasForm: routingResult.infoRequest });
                state.status = "awaiting_user";

                if (routingResult.infoRequest) {
                    if (state.conversationHistory.length > 0) {
                         const lastMessageIndex = state.conversationHistory.length - 1;
                         state.conversationHistory[lastMessageIndex] = {
                            ...state.conversationHistory[lastMessageIndex],
                            content: routingResult.rewrittenMessage,
                         };
                         logger.log("Modified last history message content for InfoRequest.");
                    } else {
                         const messageToUser: ServerMessage = {
                             role: "assistant",
                             agentName: managerAgent.name,
                             content: routingResult.rewrittenMessage,
                         };
                        state.conversationHistory = [messageToUser];
                    }
                } else {
                    const messageToUser: ServerMessage = {
                        role: "assistant",
                        agentName: managerAgent.name,
                        content: routingResult.rewrittenMessage,
                    };
                    state.conversationHistory = [...state.conversationHistory, messageToUser];
                    logger.log("Appended new history message for user redirection.");
                }

                break;
            }

            const nextAgent = agents.find(a => a.name === routingResult.nextAgentName);
            if (!nextAgent) {
                logger.error(`LLM router selected invalid agent: ${routingResult.nextAgentName}`);
                state.status = "error";
                state.error = `LLM router selected invalid agent: ${routingResult.nextAgentName}`;
                break;
            }

            ORCHESTRATION_setActiveAgent(state, nextAgent);
            const messageForAgent = routingResult.rewrittenMessage;

            let historyForAgent: ServerMessage[];
            if (nextAgent.type === AgentTypeEnum.MANAGER) {
                 historyForAgent = ORCHESTRATION_getSummarizedHistory(state.conversationHistory);
                 logger.log("Providing summarized history to Manager.");
            } else {
                historyForAgent = [];
                 logger.log("Providing NO history to non-Manager agent.");
            }

            const turnInput: AgentTurnInput = {
                message: messageForAgent,
                history: historyForAgent,
                contextSets: state.contextSets,
                agentConfig: nextAgent,
                fullTeam: { name: state.config.teamName, agents: state.config.agents, objectives: state.config.objectives },
                orchestrationState: state,
                userId: state.config.userId,
                teamName: state.config.teamName,
            };

            const turnResult = await ORCHESTRATION_executeAgentTurn(
                turnInput,
                sessionState,
                state.config
            );
            logger.log(`Agent ${turnResult.agentName} completed turn.`);

            const agentResponseMessage: ServerMessage = {
                role: "assistant",
                content: turnResult.response,
                agentName: turnResult.agentName,
                agentDirectives: turnResult.agentDirectives,
                expectedOutput: turnResult.agentDirectives?.expectedOutput
            };
             state.conversationHistory = [...state.conversationHistory, agentResponseMessage];

             if(turnResult.contextModified){
                 logger.log(`Agent turn indicated context modification: ${turnResult.agentName}`);
                 
                 // Only apply context changes if they exist (from manager agent)
                 if (turnResult.allContextSets && turnResult.allContextSets.length > 0) {
                     state.contextSets = turnResult.allContextSets;
                     logger.log(`Updated context sets with ${state.contextSets.length} items`);
                 }
             }

            state.currentRound++;
        }

    } catch (error) {
        logger.error("Error during LLM-routed workflow execution:", { error });
        state.status = "error";
        state.error = error instanceof Error ? error.message : String(error);
    } finally {
        ORCHESTRATION_resetAllControlFlags();
        ORCHESTRATION_setActiveAgent(state, null);
    }

    return formatFinalResult(state);
} 