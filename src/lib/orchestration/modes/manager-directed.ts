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

// Import the server action

import { ORCHESTRATION_infoRequestToContextFormSet } from "./workflow-helpers";

// --- Interfaces --- //

// Interface for the result of parsing the manager's decision
interface ManagerDirectiveResult {
    messageTo: string; // Either "user" or agent name to direct message to
    message: string; // The message content
    workflowComplete: boolean; // Did the manager indicate completion with no further tasks?
    contextUpdates: boolean; // Did the manager indicate context updates?
    isInfoRequest: boolean; // Did the manager indicate an info request?
    contextSetUpdate?: {
        contextSets: Array<{
            name: string;
            context: string;
            visibleToAgents?: "none" | "all" | string[];
        }>;
    }; // Context sets to create or update
    expectedOutput?: { // Extract expected output criteria from text
        criteria: string;
        format?: string;
        requiredElements?: string[];
        validationStrategy?: "exact" | "semantic" | "contains" | "custom" | "simple";
    };
}

// --- Helper Functions --- //

// Parse manager's response to extract directives
function _parseManagerResponse(
    managerResponse: string,
    managerAgentName: string,
    allAgents: AgentComponentProps[]
): ManagerDirectiveResult {
    logger.log("Parsing manager response for directives...");
    
    let messageTo = managerAgentName; // Default back to manager
    let message = managerResponse; // Default is the full response
    let workflowComplete = false;
    let contextUpdates = false;
    let expectedOutput: ManagerDirectiveResult['expectedOutput'] = undefined;
    let isInfoRequest = false;

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

    // Check for info request
    if (/Information request:/i.test(managerResponse)) {
        isInfoRequest = true;
        logger.log("Manager response indicates an info request.");
    }

    // Check for expected output criteria
    // Using a simpler regex approach to avoid needing flags
    const expectedOutputSections = managerResponse.split(/Expected output:/i);
    if (expectedOutputSections.length > 1) {
        const criteriaText = expectedOutputSections[1].split(/\n\n/)[0].trim();
        
        // Initialize expected output object
        expectedOutput = {
            criteria: criteriaText
        };

        // Try to extract format if specified
        const formatSections = criteriaText.split(/format:/i);
        if (formatSections.length > 1) {
            const formatText = formatSections[1].split(/\n/)[0].trim();
            expectedOutput.format = formatText;
        }

        // Try to extract required elements if specified
        const elementsSections = criteriaText.split(/required elements:/i);
        if (elementsSections.length > 1) {
            const elementsText = elementsSections[1].split(/\n\n/)[0].trim();
            expectedOutput.requiredElements = elementsText.split(/[,;]/).map(item => item.trim());
        }

        // Try to extract validation strategy if specified
        const validationMatch = criteriaText.match(/validation:\s*(exact|semantic|contains|custom|simple)/i);
        if (validationMatch) {
            expectedOutput.validationStrategy = validationMatch[1].toLowerCase() as "exact" | "semantic" | "contains" | "custom" | "simple";
        }

        logger.log("Extracted expected output criteria from manager text response.");
    }

    // Check for message to user
    if (managerResponse.includes("Message to user:")) {
        messageTo = "user";
        logger.log("Manager directed message to user.");
        
        // Extract the message for the user
        const messageToUserPattern = /Message to user:([\s\S]*?)($|(?=\n\n))/;
        const messageToUserMatch = managerResponse.match(messageToUserPattern);
        if (messageToUserMatch && messageToUserMatch[1]) {
            message = messageToUserMatch[1].trim();
        }
    }
    // Check for agent mentions if not messaging user
    else {
        for (const agent of allAgents) {
            // Regex to find @AgentName followed by space, comma, colon, or newline
            const mentionPattern = new RegExp(`@${agent.name}[\\s\\,\\:]`, 'i'); 
            if (mentionPattern.test(managerResponse)) {
                messageTo = agent.name;
                
                // Extract the message for the agent
                const lines = managerResponse.split('\n');
                for (const line of lines) {
                    if (line.match(new RegExp(`@${agent.name}`, 'i'))) {
                        // Extract everything after the agent mention
                        const mentionIndex = line.search(new RegExp(`@${agent.name}`, 'i'));
                        const nameLength = agent.name.length + 1; // +1 for @ symbol
                        const afterMention = line.substring(mentionIndex + nameLength).trim();
                        
                        // Remove punctuation at the beginning if any
                        message = afterMention.replace(/^[\s\,\:]+/, '').trim();
                        
                        // If there are more lines after this one, include them
                        const lineIndex = lines.indexOf(line);
                        if (lineIndex < lines.length - 1) {
                            const remainingLines = lines.slice(lineIndex + 1).join('\n').trim();
                            if (remainingLines) {
                                message += '\n\n' + remainingLines;
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
        messageTo,
        message,
        workflowComplete,
        contextUpdates,
        expectedOutput,
        isInfoRequest
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
                turnResult = await ORCHESTRATION_executeManagerTurn(turnInput, sessionState, state.config);
            } else {
                turnResult = await ORCHESTRATION_executeAgentTurn(turnInput, sessionState, state.config);
            }
                
            logger.log(`Agent ${turnResult.agentName} completed turn.`);

            const agentResponseMessage: ServerMessage = {
                role: "assistant", 
                content: turnResult.response, 
                agentName: turnResult.agentName,
                agentDirectives: turnResult.agentDirectives,
                expectedOutput: turnResult.agentDirectives?.expectedOutput
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
                    
                    const messageTo = turnResult.agentDirectives?.messageTo || "";
                    if (messageTo === "user") {
                        logger.log("Manager directed message to user via structured output.");
                        state.status = "awaiting_user";
                        
                        // If this is an info request, process the form
                        if (turnResult.agentDirectives.isInfoRequest) {
                            logger.log("Processing information request form from structured output.");
                            
                            // The context updates are already processed in agent-execution.ts
                            if (turnResult.allContextSets) {
                                // Use the processed context sets directly
                                state.contextSets = turnResult.allContextSets;
                                logger.log(`Using pre-processed context sets with ${turnResult.allContextSets.length} items`);
                                
                                // Update the agent response to include form prompt if not already added
                                if (agentResponseMessage && !agentResponseMessage.content.includes("Please fill out the form")) {
                                    agentResponseMessage.content += "\n\n**Please fill out the form below to provide the requested information.**";
                                    
                                    // Update the message in the conversation history
                                    const lastIndex = state.conversationHistory.length - 1;
                                    if (lastIndex >= 0) {
                                        state.conversationHistory[lastIndex] = agentResponseMessage;
                                    }
                                }
                            }
                            
                            break; // Exit loop
                        }
                        
                        // Check if the manager's turn result included context updates
                        if (turnResult.contextModified) {
                            logger.log("Manager provided context updates.");
                            
                            // Use the pre-processed context sets
                            if (turnResult.allContextSets) {
                                logger.log(`Using pre-processed context sets with ${turnResult.allContextSets.length} items`);
                                state.contextSets = turnResult.allContextSets;
                                
                                // Include the context set in the message for UI display
                                if (agentResponseMessage && turnResult.contextSet) {
                                    agentResponseMessage.contextSet = turnResult.contextSet;
                                }
                            }
                        }
                        
                        break; // Exit loop
                    }
                    
                    const selectedAgent = agents.find(a => a.name === messageTo);
                    if (!selectedAgent) {
                        logger.warn(`Manager directed to invalid agent '${messageTo}' via structured output, defaulting to manager.`);
                        nextAgent = managerAgent;
                        messageForNextAgent = `Could not find agent ${messageTo}. Please clarify direction.`;
                    } else {
                        nextAgent = selectedAgent;
                        messageForNextAgent = turnResult.agentDirectives?.message || "";
                    }
                    
                    // Check if the manager's turn result included context updates
                    if (turnResult.contextModified || turnResult.agentDirectives.contextSetUpdate) {
                        logger.log("Manager provided context updates.");
                        
                        // If the agent returned the complete set of context sets, use that
                        if (turnResult.allContextSets && turnResult.allContextSets.length > 0) {
                            logger.log(`Using complete context set with ${turnResult.allContextSets.length} items from agent result`);
                            state.contextSets = turnResult.allContextSets;
                        } else {
                            // Process contextSetUpdate if provided
                            if (turnResult.agentDirectives.contextSetUpdate) {
                                const updates = turnResult.agentDirectives.contextSetUpdate.contextSets;
                                logger.log(`Processing ${updates.length} context set updates from directives`);
                                
                                for (const update of updates) {
                                    // --- Refactored Logic Start ---
                                    const index = state.contextSets.findIndex(cs => cs.setName === update.name);
                                    const isExisting = index >= 0;
                                    const isEmptyContext = update.context === "";

                                    // Convert visibleToAgents to hiddenFromAgents (consistent calculation)
                                    let hiddenFromAgents: string[] = isExisting ? state.contextSets[index].hiddenFromAgents || [] : [];
                                    const visibleTo = (update as any).visibleToAgents; // Use potentially provided visibility

                                    if (visibleTo) { // Only recalculate if visibility is specified in the update
                                        if (visibleTo === "none") {
                                            hiddenFromAgents = agents.map(agent => agent.name);
                                        } else if (visibleTo === "all") {
                                            hiddenFromAgents = [];
                                        } else {
                                            const visibleAgentNames = Array.isArray(visibleTo) ? visibleTo : [visibleTo];
                                                hiddenFromAgents = agents
                                                .filter(agent => !visibleAgentNames.includes(agent.name))
                                                    .map(agent => agent.name);
                                            }
                                    } else if (!isExisting) {
                                        // Default visibility for brand new sets if not specified: visible to all
                                        hiddenFromAgents = [];
                                    }
                                    // If visibility wasn't specified for an *existing* set, hiddenFromAgents retains its previous value

                                    if (isEmptyContext) {
                                        // Remove the context set if context is empty and it exists
                                        if (isExisting) {
                                            state.contextSets.splice(index, 1);
                                            logger.log(`Removed context set "${update.name}" (empty context provided)`);
                                        } else {
                                            // Do nothing if trying to add/update a non-existent set with empty context
                                            logger.log(`Skipped adding empty context set "${update.name}"`);
                                        }
                                    } else {
                                        // Create or Update the context set if context is not empty
                                        const newSetData: ContextContainerProps = {
                                            setName: update.name,
                                            text: update.context,
                                            lines: [], // Assuming text-based context primarily
                                            isDisabled: false, // Default value
                                            hiddenFromAgents: hiddenFromAgents,
                                            formSchema: (update as any).formSchema // Safely access formSchema
                                            // Add other relevant fields from ContextContainerProps if needed
                                        };

                                        if (isExisting) {
                                        // Update existing context set
                                                state.contextSets[index] = {
                                                ...state.contextSets[index], // Preserve existing fields not overwritten
                                                ...newSetData // Overwrite with new data
                                                };
                                            logger.log(`Updated context set "${update.name}"`);
                                        } else {
                                            // Add new context set
                                            state.contextSets.push(newSetData);
                                            logger.log(`Added new context set "${update.name}"`);
                                        }
                                    }
                                    // --- Refactored Logic End ---
                                }
                            }
                            
                            // Otherwise apply changes incrementally from the result
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

                    // Create directives object from the parsed text directive and add it to the response message
                    if (agentResponseMessage) {
                        // Add the parsed directives to the agent message
                        agentResponseMessage.agentDirectives = {
                            messageTo: directive.messageTo,
                            message: directive.message,
                            workflowComplete: directive.workflowComplete,
                            contextUpdates: directive.contextUpdates,
                            isInfoRequest: directive.isInfoRequest
                        };
                        
                        // Add the expected output if it was parsed
                        if (directive.expectedOutput) {
                            agentResponseMessage.expectedOutput = directive.expectedOutput;
                        }
                        
                        // Replace the message in the conversation history
                        const lastIndex = state.conversationHistory.length - 1;
                        if (lastIndex >= 0) {
                            state.conversationHistory[lastIndex] = agentResponseMessage;
                        }
                    }

                    if (directive.workflowComplete) {
                        logger.log("Manager indicated workflow complete.");
                        state.status = "completed";
                        break; // Exit loop
                    }

                    if (directive.messageTo === "user") {
                        logger.log("Manager directed message to user.");
                        state.status = "awaiting_user";
                        
                        // If this is an info request, process the form
                        if (directive.isInfoRequest) {
                            logger.log("Processing information request form from text parsing.");
                            
                            // Create form-based context set for this info request
                            const updatedContextSets = await ORCHESTRATION_infoRequestToContextFormSet(
                                directive.message,
                                state.contextSets,
                                managerAgent,
                                state.conversationHistory
                            );
                            
                            // Update the state with the modified context sets
                            state.contextSets = updatedContextSets;
                            
                            // Update the agent response to include form prompt
                            if (agentResponseMessage) {
                                agentResponseMessage.content += "\n\n**Please fill out the form below to provide the requested information.**";
                                
                                // Update the message in the conversation history
                                const lastIndex = state.conversationHistory.length - 1;
                                if (lastIndex >= 0) {
                                    state.conversationHistory[lastIndex] = agentResponseMessage;
                                }
                            }
                        }
                        
                        break; // Exit loop
                    }

                    // Find the next agent based on parsed name
                    const selectedAgent = agents.find(a => a.name === directive.messageTo);
                    if (!selectedAgent) {
                        logger.warn(`Manager directed to invalid agent '${directive.messageTo}', defaulting to manager.`);
                        nextAgent = managerAgent;
                        messageForNextAgent = `Could not find agent ${directive.messageTo}. Please clarify direction.`;
                    } else {
                        nextAgent = selectedAgent;
                        messageForNextAgent = directive.message;
                    }
                }
            } else {
                // An agent other than the manager just ran. Route back to the manager.
                logger.log(`Agent ${turnResult.agentName} finished, routing back to manager.`);
                nextAgent = managerAgent;
                
                // Look for the original message from manager to this agent to check for expected output criteria
                const originalManagerMessage = state.conversationHistory.find(msg => 
                    msg.agentName === managerAgent.name && 
                    msg.agentDirectives?.messageTo === turnResult.agentName &&
                    msg.expectedOutput
                );
                
                // Prepare the message back to the manager
                if (originalManagerMessage?.expectedOutput) {
                    // If the manager provided expected output criteria, include it for verification
                    const criteria = JSON.stringify(originalManagerMessage.expectedOutput, null, 2);
                    messageForNextAgent = `Agent ${turnResult.agentName} completed the task with the following response:\n\n${turnResult.response}\n\n---\nPlease verify this response against your expected output criteria:\n${criteria}`;
                    
                    logger.log(`Including expected output criteria for manager verification`);
                } else {
                    // Standard response without criteria
                    messageForNextAgent = turnResult.response;
                    
                    // For cases where the agent response is very lengthy, add the agent name as context
                    if (turnResult.response.length > 500) {
                        messageForNextAgent = `Agent ${turnResult.agentName} provided a response: ${turnResult.response}`;
                    }
                }
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


