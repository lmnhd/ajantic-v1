// The manager in this mode will combine the roles of delegating tasks to agents, verifying their work, keeping the context updated, and determining the overall flow.

// Instead of relying on a seperate LLM to read each message and decide the next step, the manager will set these options simultaneously with the response using structured output.

// The agent-execution function should be modified to use 'generateObject' instead of 'generateText' to allow for structured output.

// The output should contain: response: string, newContextSets: ContextContainerProps[], nextAgentOrUser:enum({...allAgents, "user"}), message:string, etc.

// The prompt 'managerDirected_prompt' should be created in the same way as the other prompts, but updated to handle this process.


// Use the 'ORCHESTRATION_runLLMRoutedWorkflow' workflow function for reference on how to structure the process and code.

import {
    AgentTurnInput,
    AgentTurnResult,
    OrchestrationFinalResult,
    OrchestrationState,
} from "../types";
import {
    ORCHESTRATION_executeAgentTurn,
    ORCHESTRATION_executeManagerTurn,
    ORCHESTRATION_getSummarizedHistory,
    ORCHESTRATION_isCancelled,
    ORCHESTRATION_isPaused,
    ORCHESTRATION_resetAllControlFlags,
    ORCHESTRATION_setActiveAgent,
    ORCHESTRATION_shouldContinueFromPause,
} from "../utils";
import { logger } from "@/src/lib/logger";
import { AISessionState, AgentComponentProps, AgentTypeEnum, ContextContainerProps, ServerMessage } from "@/src/lib/types";
import { MemoryVectorStore } from "langchain/vectorstores/memory";

// --- Interfaces --- //

// Interface for the result of parsing the manager's decision
interface ManagerDirectiveResult {
    nextAgentName: string; // Agent explicitly called, or manager by default
    messageForNextAgent: string; // The message content intended for the next step
    redirectToUser: boolean; // Did the manager explicitly say "Message to user:"?
    workflowComplete: boolean; // Did the manager indicate completion with no further tasks?
    contextUpdates: boolean; // Did the manager indicate context updates?
}

// --- Helper Functions --- //

// Parse manager's response to extract directives
function _parseManagerResponse(
    managerResponse: string,
    managerAgentName: string,
    allAgents: AgentComponentProps[]
): ManagerDirectiveResult {
    logger.log("Parsing manager response for directives...");
    
    let nextAgentName = managerAgentName; // Default back to manager
    let messageForNextAgent = managerResponse; // Default is the full response
    let redirectToUser = false;
    let workflowComplete = false;
    let contextUpdates = false;

    // Check for message to user
    const userRedirectMatch = managerResponse.match(/Message to user:(.*?)(\n|$)/i);
    if (userRedirectMatch) {
        redirectToUser = true;
        messageForNextAgent = userRedirectMatch[1].trim();
        logger.log(`Manager directed message to user.`);
    }

    // Check for workflow completion
    if (/workflow complete|task complete|all done/i.test(managerResponse)) {
        workflowComplete = true;
        logger.log("Manager response suggests workflow completion.");
    }
    
    // Check for context updates
    if (/Context update:|Please add the following to the context:/i.test(managerResponse)) {
        contextUpdates = true;
        logger.log("Manager response indicates context updates.");
    }

    // Check for agent mentions if not redirecting to user
    if (!redirectToUser && !workflowComplete) {
        for (const agent of allAgents) {
            // Regex to find @AgentName followed by space, comma, colon, or newline
            const mentionPattern = new RegExp(`@${agent.name}[\\s\\,\\:]`, 'i'); 
            if (mentionPattern.test(managerResponse)) {
                nextAgentName = agent.name;
                
                // Extract the message for the agent
                const lines = managerResponse.split('\n');
                for (const line of lines) {
                    if (line.match(new RegExp(`@${agent.name}`, 'i'))) {
                        // Extract everything after the agent mention
                        const mentionIndex = line.search(new RegExp(`@${agent.name}`, 'i'));
                        const nameLength = agent.name.length + 1; // +1 for @ symbol
                        const afterMention = line.substring(mentionIndex + nameLength).trim();
                        
                        // Remove punctuation at the beginning if any
                        messageForNextAgent = afterMention.replace(/^[\s\,\:]+/, '').trim();
                        
                        // If there are more lines after this one, include them
                        const lineIndex = lines.indexOf(line);
                        if (lineIndex < lines.length - 1) {
                            const remainingLines = lines.slice(lineIndex + 1).join('\n').trim();
                            if (remainingLines) {
                                messageForNextAgent += '\n\n' + remainingLines;
                            }
                        }
                        
                        break;
                    }
                }
                
                logger.log(`Manager directed task to ${agent.name}.`);
                break;
            }
        }
    }

    return {
        nextAgentName,
        messageForNextAgent,
        redirectToUser,
        workflowComplete,
        contextUpdates
    };
}

// Format Final Result
function formatFinalResult(state: OrchestrationState): OrchestrationFinalResult {
    const finalStatus =
        state.status === "completed" || state.status === "cancelled" || state.status === "error"
            ? state.status
            : "stopped";
    return { 
        status: finalStatus, 
        finalConversationHistory: state.conversationHistory, 
        finalContextSets: state.contextSets,
        error: state.error, 
        totalRounds: state.currentRound 
    };
}

// --- Main Workflow Function --- //

/**
 * Runs a workflow where the Manager agent explicitly directs the next step.
 */
export async function ORCHESTRATION_runManagerDirectedWorkflow(
    initialState: OrchestrationState,
    sessionState: AISessionState,
    memStore: MemoryVectorStore
): Promise<OrchestrationFinalResult> {
    let state = { ...initialState };
    state.status = "running";
    state.currentRound = 0;

    const { agents, maxRounds = 15 } = state.config;
    const managerAgent = agents.find(a => a.type === AgentTypeEnum.MANAGER);

    if (!managerAgent) {
        logger.error("MANAGER_DIRECTED_WORKFLOW requires a 'manager' type agent.");
        state.status = "error";
        state.error = "MANAGER_DIRECTED_WORKFLOW requires a 'manager' type agent.";
        return formatFinalResult(state);
    }

    let nextAgent: AgentComponentProps | null = managerAgent; // Start with the manager
    let messageForNextAgent = state.config.initialMessage;

    try {
        logger.log("Starting MANAGER_DIRECTED_WORKFLOW", { config: state.config });

        while (state.status === "running" || state.status === "paused") {
            if (state.currentRound >= maxRounds) {
                logger.warn(`MANAGER_DIRECTED_WORKFLOW reached maximum round limit (${maxRounds}). Stopping.`);
                state.status = "completed";
                state.error = "Maximum round limit reached.";
                break;
            }
            logger.log(`Manager Directed - Round ${state.currentRound + 1}`);

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

            // --- Prepare and Execute Agent Turn --- //
            if (!nextAgent) {
                logger.error("Workflow error: nextAgent is null.");
                state.status = "error"; 
                state.error = "Internal workflow error: next agent not determined.";
                break;
            }
            
            ORCHESTRATION_setActiveAgent(state, nextAgent);
            logger.log(`Activating Agent: ${nextAgent.name}`);

            let historyForAgent: ServerMessage[];
            if (nextAgent.type === AgentTypeEnum.MANAGER) {
                historyForAgent = ORCHESTRATION_getSummarizedHistory(state.conversationHistory);
                logger.log("Providing summarized history to Manager.");
            } else {
                // Non-managers get no history in this mode
                historyForAgent = [];
                logger.log("Providing NO history to non-Manager agent.");
            }

            const turnInput: AgentTurnInput = {
                message: messageForNextAgent,
                history: historyForAgent,
                contextSets: state.contextSets,
                agentConfig: nextAgent,
                fullTeam: { 
                    name: state.config.teamName, 
                    agents: agents, 
                    objectives: state.config.objectives 
                },
                orchestrationState: state,
                userId: state.config.userId,
                teamName: state.config.teamName,
            };

            // Use the appropriate execution function based on agent type
            let turnResult: AgentTurnResult;
            if (nextAgent.type === AgentTypeEnum.MANAGER) {
                turnResult = await ORCHESTRATION_executeManagerTurn(turnInput, sessionState, state.config, memStore);
            } else {
                turnResult = await ORCHESTRATION_executeAgentTurn(turnInput, sessionState, state.config, memStore);
            }
                
            logger.log(`Agent ${turnResult.agentName} completed turn.`);

            const agentResponseMessage: ServerMessage = {
                role: "assistant", 
                content: turnResult.response, 
                agentName: turnResult.agentName,
            };
            state.conversationHistory = [...state.conversationHistory, agentResponseMessage];

            if (turnResult.error) {
                logger.error(`Agent ${turnResult.agentName} turn resulted in error: ${turnResult.error}`);
                // Route back to manager on agent error
                nextAgent = managerAgent;
                messageForNextAgent = `Agent ${turnResult.agentName} encountered an error: ${turnResult.error}. Original task message was: ${turnInput.message}`;
                state.currentRound++;
                continue; // Go to start of loop to process manager turn
            }

            // --- Determine Next Step based on who just ran --- //
            if (turnResult.agentName === managerAgent.name) {
                logger.log("Processing manager turn directives");
                // The last turn was from the manager, so use its directives
                
                if (turnResult.agentDirectives) {
                    logger.log("Manager provided structured directives:", { directives: turnResult.agentDirectives });
                    
                    if (turnResult.agentDirectives.workflowComplete) {
                        logger.log("Manager indicated workflow complete via structured output.");
                        state.status = "completed";
                        break; // Exit loop
                    }
                    
                    if (turnResult.agentDirectives.redirectToUser) {
                        logger.log("Manager directed to user via structured output.");
                        state.status = "awaiting_user";
                        break; // Exit loop
                    }
                    
                    const directedAgentName = turnResult.agentDirectives?.nextAgentName || "";
                    const selectedAgent = agents.find(a => a.name === directedAgentName);
                    if (!selectedAgent) {
                        logger.warn(`Manager directed to invalid agent '${directedAgentName}' via structured output, defaulting to manager.`);
                        nextAgent = managerAgent;
                        messageForNextAgent = `Could not find agent ${directedAgentName}. Please clarify direction.`;
                    } else {
                        nextAgent = selectedAgent;
                        messageForNextAgent = turnResult.agentDirectives?.messageForNextAgent || "";
                    }
                    
                    // Check if the manager's turn result included context updates
                    if (turnResult.contextModified) {
                        logger.log("Manager provided context updates.");
                        
                        // If the agent returned the complete set of context sets, use that
                        if (turnResult.allContextSets && turnResult.allContextSets.length > 0) {
                            logger.log(`Using complete context set with ${turnResult.allContextSets.length} items from agent result`);
                            state.contextSets = turnResult.allContextSets;
                        } else {
                            // Otherwise apply changes incrementally
                            
                            // Handle new context sets
                            if (turnResult.updatedContextSets && turnResult.updatedContextSets.length > 0) {
                                logger.log(`Adding ${turnResult.updatedContextSets.length} new context sets`);
                                state.contextSets = [...state.contextSets, ...turnResult.updatedContextSets];
                            }
                            
                            // Handle edited context sets
                            if (turnResult.editedContextSets && turnResult.editedContextSets.length > 0) {
                                logger.log(`Editing ${turnResult.editedContextSets.length} existing context sets`);
                                
                                // Apply each edit to the matching context set
                                turnResult.editedContextSets.forEach(edit => {
                                    const originalSetName = edit.originalSetName;
                                    const index = state.contextSets.findIndex(cs => cs.setName === originalSetName);
                                    
                                    if (index >= 0) {
                                        // Update the existing context set
                                        state.contextSets[index] = {
                                            ...state.contextSets[index],
                                            text: edit.newText,
                                            setName: edit.newSetName || state.contextSets[index].setName,
                                            hiddenFromAgents: edit.hiddenFromAgents || state.contextSets[index].hiddenFromAgents
                                        };
                                        logger.log(`Updated context set "${originalSetName}"`);
                                    } else {
                                        logger.warn(`Couldn't find context set "${originalSetName}" to edit`);
                                    }
                                });
                            }
                        }
                        
                        // Add full updated context to the response message for visibility
                        if (agentResponseMessage) {
                            agentResponseMessage.contextSet = {
                                teamName: state.config.teamName,
                                sets: state.contextSets
                            };
                        }
                    }
                } else {
                    // Fall back to parsing the response text
                    const directive = _parseManagerResponse(turnResult.response, managerAgent.name, agents);
                    logger.log("Parsed Manager Directive from text:", { directive });

                    if (directive.workflowComplete) {
                        logger.log("Manager indicated workflow complete.");
                        state.status = "completed";
                        break; // Exit loop
                    }

                    if (directive.redirectToUser) {
                        logger.log("Manager directed message to user.");
                        state.status = "awaiting_user";
                        break; // Exit loop
                    }

                    // Find the next agent based on parsed name
                    const selectedAgent = agents.find(a => a.name === directive.nextAgentName);
                    if (!selectedAgent) {
                        logger.warn(`Manager directed to invalid agent '${directive.nextAgentName}', defaulting to manager.`);
                        nextAgent = managerAgent;
                        messageForNextAgent = `Could not find agent ${directive.nextAgentName}. Please clarify direction.`;
                    } else {
                        nextAgent = selectedAgent;
                        messageForNextAgent = directive.messageForNextAgent;
                    }
                }
            } else {
                // An agent other than the manager just ran. Route back to the manager.
                logger.log(`Agent ${turnResult.agentName} finished, routing back to manager.`);
                nextAgent = managerAgent;
                messageForNextAgent = `Agent ${turnResult.agentName} response: ${turnResult.response}`;
            }

            state.currentRound++; // Increment round counter
        }

    } catch (error) {
        logger.error("Error during manager-directed workflow execution:", { error });
        state.status = "error";
        state.error = error instanceof Error ? error.message : String(error);
    } finally {
        ORCHESTRATION_resetAllControlFlags();
        ORCHESTRATION_setActiveAgent(state, null);
    }

    return formatFinalResult(state);
}


