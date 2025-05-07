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
    ClientAugmentedServerMessage,
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
import { MissingCredentialError } from "@/src/lib/agent-tools/load-agent-tools"; // Import the error
import { useAnalysisStore } from "@/src/lib/store/analysis-store"; // Import store hook

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
        error: state.error || undefined, 
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
    updateUIStateCallback: (state: OrchestrationState) => Promise<void>
): Promise<OrchestrationFinalResult> {
    let state = { ...initialState };
    state.status = "running";
    state.currentRound = 0;

    const storeActions = useAnalysisStore.getState(); // Get store actions

    const { agents, maxRounds = 15, stopOnError = true } = state.config;
    const managerAgent = agents.find(a => a.type === AgentTypeEnum.MANAGER);

    if (!managerAgent) {
        logger.error("MANAGER_DIRECTED_WORKFLOW requires a 'manager' type agent.");
        state.status = "error";
        state.error = "MANAGER_DIRECTED_WORKFLOW requires a 'manager' type agent.";
        return formatFinalResult(state);
    }

    let nextAgent: AgentComponentProps | null = managerAgent;
    let messageForNextAgent = state.config.initialMessage;

    // Define the set of statuses that allow the loop to continue.
    // "awaiting_credential" is NOT in this set, so the loop will terminate.
    const activeLoopStatuses = new Set<OrchestrationState['status']>([
        "running",
        "paused"
        // "paused_awaiting_credential" is removed
    ]);

    try {
        logger.log("Starting MANAGER_DIRECTED_WORKFLOW", { config: state.config });

        while (activeLoopStatuses.has(state.status)) {
            if (state.currentRound >= maxRounds) {
                logger.warn(`MANAGER_DIRECTED_WORKFLOW reached maximum round limit (${maxRounds}). Stopping.`);
                state.status = "completed";
                state.error = "Maximum round limit reached.";
                break;
            }
            logger.log(`Manager Directed - Round ${state.currentRound + 1}, Status: ${state.status}`);

            // --- Regular Pause/Cancel Checks ---
            if (ORCHESTRATION_isCancelled()) { 
                logger.log("Workflow cancelled."); 
                state.status = "cancelled"; 
                break; 
            }
            if (ORCHESTRATION_isPaused()) { 
                logger.log("Workflow paused (regular). Waiting for continue signal...");
                while (ORCHESTRATION_isPaused() && !ORCHESTRATION_shouldContinueFromPause()) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                if (ORCHESTRATION_isCancelled()) { state.status = "cancelled"; break; }
                if (!ORCHESTRATION_shouldContinueFromPause()) {
                    logger.log("Pause ended without continue signal. Treating as stopped/cancelled.");
                    state.status = "cancelled"; // Or "stopped" if preferred for OrchestrationFinalResult
                    break;
                }
                state.status = "running"; // Explicitly set back if resuming
            }
            // --- End Regular Pause/Cancel ---

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
            try {
            if (nextAgent.type === AgentTypeEnum.MANAGER) {
                turnResult = await ORCHESTRATION_executeManagerTurn(turnInput, sessionState, state.config);
            } else {
                turnResult = await ORCHESTRATION_executeAgentTurn(turnInput, sessionState, state.config);

                    if (turnResult.status === 'REQUIRES_CREDENTIAL_INPUT' && turnResult.credentialName) {
                        logger.warn(`Orchestration stopping: Agent ${turnResult.agentName} requires credential ${turnResult.credentialName}`);
                        useAnalysisStore.getState().requireCredentialInput({
                            credentialName: turnResult.credentialName,
                            retryPayload: turnInput // Store the original turnInput for retry
                        });
                        state.status = "awaiting_credential"; // New status
                        await updateUIStateCallback(state); // Update UI before breaking
                        break; // Terminate the main orchestration loop
                    }
                }
            } catch (error) {
                if (error instanceof MissingCredentialError && nextAgent.type !== AgentTypeEnum.MANAGER) {
                    logger.warn(`Orchestration stopping: Agent ${nextAgent.name} requires credential ${error.credentialName} (caught error)`);
                    useAnalysisStore.getState().requireCredentialInput({
                        credentialName: error.credentialName,
                        retryPayload: turnInput // Store the original turnInput for retry
                    });
                    state.status = "awaiting_credential"; // New status
                    await updateUIStateCallback(state); // Update UI before breaking
                    break; // Terminate the main orchestration loop
                } else {
                    logger.error(`Unexpected error during execution for ${nextAgent.name}`, { error });
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    if (nextAgent.name === managerAgent.name || stopOnError) {
                         state.status = "error";
                         state.error = errorMessage;
                         break; 
                    } else {
                         logger.warn(`Agent ${nextAgent.name} execution error, but continuing (stopOnError=false). Routing to manager.`);
                         nextAgent = managerAgent;
                         messageForNextAgent = `Agent ${nextAgent.name} failed during execution: ${errorMessage}. Original task: ${turnInput.message}`;
                         state.currentRound++; 
                         continue; 
                    }
                }
            }
            // --- End Execute Agent Turn ---

            logger.log(`Agent ${turnResult.agentName} completed turn with status: ${turnResult.status}`);

            const agentResponseMessage: ServerMessage = {
                role: "assistant", 
                content: turnResult.response ?? "", 
                agentName: turnResult.agentName,
                agentDirectives: turnResult.agentDirectives,
                expectedOutput: turnResult.agentDirectives?.expectedOutput
            };
            state.conversationHistory = [...state.conversationHistory, agentResponseMessage];
            const currentMessageIndex = state.conversationHistory.length - 1;

            await updateUIStateCallback(state);
            await new Promise(resolve => setTimeout(resolve, 500));

            // --- Handle Turn Result Status (Errors handled within the execution block now) ---
            // Error handling logic moved inside/after the execution call

            // --- Determine Next Step based on who just ran --- //
            if (turnResult.agentName === managerAgent.name) {
                logger.log("Processing manager turn directives");

                let messageTo: string | null = null;
                let messageForNextAgentIfAgent: string | null = null;
                let workflowComplete = false;
                let isInfoRequest = false;

                // --- CONSOLIDATED CONTEXT UPDATE ---
                // Process context updates first, regardless of the next recipient
                // Check based on structured directives IF they exist
                if (turnResult.agentDirectives) {
                    // Prioritize the complete set if returned by the execution function
                    if (turnResult.allContextSets && turnResult.allContextSets.length > 0) {
                        logger.log(`Using complete context set with ${turnResult.allContextSets.length} items from agent result`);
                                state.contextSets = turnResult.allContextSets;
                         await updateUIStateCallback(state); // Update UI after context change
                                await new Promise(resolve => setTimeout(resolve, 500));
                    }
                    // Otherwise, process the contextSetUpdate directive if provided
                    else if (turnResult.agentDirectives.contextSetUpdate) {
                                const updates = turnResult.agentDirectives.contextSetUpdate.contextSets;
                                logger.log(`Processing ${updates.length} context set updates from directives`);
                        // --- Start processing contextSetUpdate ---
                                for (const update of updates) {
                                    const index = state.contextSets.findIndex(cs => cs.setName === update.name);
                                    const isExisting = index >= 0;
                             const isEmptyContext = !update.context || update.context.trim() === ""; // More robust empty check

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
                                    const deletedSetName = state.contextSets[index].setName; // Get name before splice
                                            state.contextSets.splice(index, 1);
                                    logger.log(`Removed context set "${deletedSetName}" (empty context provided)`);
                                            
                                    await updateUIStateCallback(state); // Update UI after context change
                                            await new Promise(resolve => setTimeout(resolve, 500));
                                            
                                            // Mark this deletion explicitly in the agent response for better client sync
                                            const deletionInfo = {
                                         deletedSet: deletedSetName,
                                                timestamp: Date.now()
                                            };
                                            if (agentResponseMessage) {
                                                agentResponseMessage.contextDeleted = 
                                                    agentResponseMessage.contextDeleted 
                                                    ? [...agentResponseMessage.contextDeleted, deletionInfo] 
                                                    : [deletionInfo];
                                            }
                                        } else {
                                            logger.log(`Skipped adding empty context set "${update.name}"`);
                                        }
                                    } else {
                                        // Create or Update the context set if context is not empty
                                        const newSetData: ContextContainerProps = {
                                            setName: update.name,
                                            text: update.context,
                                    lines: [],
                                    isDisabled: false,
                                            hiddenFromAgents: hiddenFromAgents,
                                    formSchema: (update as any).formSchema
                                        };

                                        if (isExisting) {
                                    state.contextSets[index] = { ...state.contextSets[index], ...newSetData };
                                            logger.log(`Updated context set "${update.name}"`);
                                        } else {
                                            state.contextSets.push(newSetData);
                                            logger.log(`Added new context set "${update.name}"`);
                                }
                                await updateUIStateCallback(state); // Update UI after context change
                                await new Promise(resolve => setTimeout(resolve, 500));
                            }
                        }
                         // --- End processing contextSetUpdate ---

                        // Add full updated context to the response message AFTER processing all updates
                        if (agentResponseMessage) {
                            agentResponseMessage.contextSet = {
                                teamName: state.config.teamName,
                                sets: state.contextSets // Use the final state
                            };
                        }
                    }
                    // --- END CONSOLIDATED CONTEXT UPDATE (Structured Directives part) ---

                    // Now determine the next recipient from directives
                    logger.log("Manager provided structured directives:", { directives: turnResult.agentDirectives });
                    messageTo = turnResult.agentDirectives.messageTo || null; // Default to null if missing
                    messageForNextAgentIfAgent = turnResult.agentDirectives.message || "";
                    workflowComplete = turnResult.agentDirectives.workflowComplete || false;
                    isInfoRequest = turnResult.agentDirectives.isInfoRequest || false;

                } else {
                    // Fall back to parsing the response text
                    const directive = _parseManagerResponse(turnResult.response ?? "", managerAgent.name, agents);
                    logger.log("Parsed Manager Directive from text:", { directive });

                    // Update the message in history with parsed directives
                    if (currentMessageIndex >= 0) {
                         state.conversationHistory[currentMessageIndex].agentDirectives = {
                            messageTo: directive.messageTo,
                            message: directive.message,
                            workflowComplete: directive.workflowComplete,
                             contextUpdates: directive.contextUpdates, // Keep track if text indicated update intention
                            isInfoRequest: directive.isInfoRequest
                        };
                        if (directive.expectedOutput) {
                            state.conversationHistory[currentMessageIndex].expectedOutput = directive.expectedOutput;
                        }
                    }

                    messageTo = directive.messageTo;
                    messageForNextAgentIfAgent = directive.message;
                    workflowComplete = directive.workflowComplete;
                    isInfoRequest = directive.isInfoRequest;

                    // Note: Context updates based on text parsing (like info request forms)
                    // happen *inside* the "Next Step" block below if messageTo is "user".
                }

                // --- CONSOLIDATED NEXT STEP DETERMINATION ---
                if (workflowComplete) {
                        logger.log("Manager indicated workflow complete.");
                        state.status = "completed";
                        break; // Exit loop
                    }

                if (messageTo === "user") {
                        logger.log("Manager directed message to user.");
                        state.status = "awaiting_user";
                        
                    // Handle info request forms (potentially triggered by structured or parsed text)
                    if (isInfoRequest) {
                        logger.log("Processing information request form.");

                        // If context wasn't already handled by structured directives via allContextSets...
                        if (!turnResult.allContextSets || turnResult.allContextSets.length === 0) {
                             // Create form-based context set (This updates state.contextSets)
                            const updatedContextSets = await ORCHESTRATION_infoRequestToContextFormSet(
                                 messageForNextAgentIfAgent || turnResult.response || "", // Use appropriate message
                                state.contextSets,
                                managerAgent,
                                 "" // Message ID placeholder
                            );
                            state.contextSets = updatedContextSets;
                            
                             // Update UI and Agent Response Message
                            await updateUIStateCallback(state);
                            await new Promise(resolve => setTimeout(resolve, 500));
                             if (agentResponseMessage && !agentResponseMessage.content?.includes("Please fill out the form")) {
                                 agentResponseMessage.content = (agentResponseMessage.content || "") + "\n\n**Please fill out the form below.**";
                                 if (currentMessageIndex >= 0) {
                                     state.conversationHistory[currentMessageIndex] = agentResponseMessage;
                                 }
                                 // Also update the contextSet on the message
                                 agentResponseMessage.contextSet = {
                                     teamName: state.config.teamName,
                                     sets: state.contextSets
                                 };
                             }
                        } else {
                            logger.log("Info request form context likely pre-processed via allContextSets.");
                             // Ensure form prompt is in the message even if context was pre-processed
                             if (agentResponseMessage && !agentResponseMessage.content?.includes("Please fill out the form")) {
                                 agentResponseMessage.content = (agentResponseMessage.content || "") + "\n\n**Please fill out the form below.**";
                                 if (currentMessageIndex >= 0) {
                                     state.conversationHistory[currentMessageIndex] = agentResponseMessage;
                                 }
                                }
                            }
                        }
                        
                    break; // Exit loop as we wait for user

                } else if (messageTo) {
                    // Message is directed to another agent
                    const selectedAgent = agents.find(a => a.name === messageTo);
                    if (!selectedAgent) {
                        logger.warn(`Manager directed to invalid agent '${messageTo}', defaulting back to manager.`);
                        nextAgent = managerAgent;
                        messageForNextAgent = `Could not find agent ${messageTo}. Please clarify direction.`;
                    } else {
                        nextAgent = selectedAgent;
                        messageForNextAgent = messageForNextAgentIfAgent || ""; // Use the message determined earlier

                        // *** AUGMENTATION POINT (Consolidated) ***
                         if (currentMessageIndex >= 0 && nextAgent.name !== managerAgent.name) {
                           logger.info(`Augmenting manager message at index ${currentMessageIndex} with recipient: ${nextAgent.name}`);
                           (state.conversationHistory[currentMessageIndex] as ClientAugmentedServerMessage)._recipientAgentName = nextAgent.name;
                        }
                        // *** END AUGMENTATION ***
                    }
                } else {
                    // No clear directive on who is next, default back to manager
                    logger.warn("Manager did not specify next recipient clearly, defaulting back to manager.");
                    nextAgent = managerAgent;
                    messageForNextAgent = "Please clarify the next step or recipient.";
                }
                // --- END CONSOLIDATED NEXT STEP ---

            } else {
                // An agent other than the manager just ran. Route back to the manager.
                logger.log(`Agent ${turnResult.agentName} finished, routing back to manager.`);
                nextAgent = managerAgent;
                
                const originalManagerMessage = state.conversationHistory.find(msg => 
                    msg.agentName === managerAgent.name && 
                     (msg.agentDirectives?.messageTo === turnResult.agentName || // Check structured directive
                     (msg.agentDirectives as any)?._recipientAgentName === turnResult.agentName) && // Check augmentation
                    msg.expectedOutput
                );
                
                if (originalManagerMessage?.expectedOutput) {
                    const criteria = JSON.stringify(originalManagerMessage.expectedOutput, null, 2);
                     messageForNextAgent = `Agent ${turnResult.agentName} completed the task with the following response:\n\n${turnResult.response ?? ""}\n\n---\nPlease verify this response against your expected output criteria:\n${criteria}`;
                    logger.log(`Including expected output criteria for manager verification`);
                } else {
                     messageForNextAgent = turnResult.response ?? "";
                     if (messageForNextAgent.length > 500) { // Check length before potentially modifying
                         messageForNextAgent = `Agent ${turnResult.agentName} provided a response: ${messageForNextAgent}`;
                    }
                }
            }

            state.currentRound++; // Increment round counter
        } // End while loop

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


