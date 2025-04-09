import { ServerMessage } from "@/src/lib/types";
import {
    AgentTurnInput,
    AgentTurnResult,
    OrchestrationConfig,
    OrchestrationFinalResult,
    OrchestrationState,
    OrchestrationStepResult,
    OrchestrationType2,
} from "../../types/base";
import {
    ORCHESTRATION_isCancelled,
    ORCHESTRATION_isPaused,
    ORCHESTRATION_resetAllControlFlags,
    ORCHESTRATION_setActiveAgent,
    ORCHESTRATION_shouldContinueFromPause,
    ORCHESTRATION_executeAgentTurn,
    ORCHESTRATION_getLLMSummary
} from "../../utils";
import { logger } from "@/src/lib/logger"; // Assuming logger is accessible
import { AISessionState } from "@/src/lib/types"; // Import AISessionState
import { MemoryVectorStore } from "langchain/vectorstores/memory"; // Import MemoryVectorStore

/**
 * Runs a multi-agent workflow where agents are processed sequentially
 * in the order provided in the configuration.
 *
 * @param initialState The initial orchestration state.
 * @param sessionState The broader AI session state (for potential tool use).
 * @param memStore The memory vector store (for potential tool use).
 * @returns A promise resolving to the final result of the orchestration.
 */
export async function ORCHESTRATION_runSequentialWorkflow(
    initialState: OrchestrationState,
    sessionState: AISessionState, // Add parameter
    memStore: MemoryVectorStore // Add parameter
): Promise<OrchestrationFinalResult> {
    let state = { ...initialState }; // Work with a mutable copy
    state.status = "running";

    const { agents, maxRounds = 10, numRounds = 0 } = state.config;
    const effectiveMaxRounds = numRounds > 0 ? numRounds : maxRounds;

    try {
        logger.log("Starting SEQUENTIAL_WORKFLOW", { config: state.config });

        for (state.currentRound = 0; state.currentRound < effectiveMaxRounds; state.currentRound++) {
            logger.log(`Starting Round ${state.currentRound + 1}/${effectiveMaxRounds}`);

            // --- Summarize History (Start of round > 0) --- //
            if (state.currentRound > 0) {
                logger.log("Generating LLM summary for the previous round...");
                state.currentSummary = await ORCHESTRATION_getLLMSummary(
                    state.conversationHistory,
                    state.config.initialMessage,
                    state.contextSets
                    // Optionally pass specific model args from config if needed
                );
                logger.log(`Summary generated: ${state.currentSummary?.substring(0, 100)}...`);
            }
            // --- End Summarization --- //

            // Cycle through agents sequentially
            for (state.currentCycleStep = 0; state.currentCycleStep < agents.length; state.currentCycleStep++) {

                // --- Check for Controls --- //
                if (ORCHESTRATION_isCancelled()) {
                    logger.log("Workflow cancelled.");
                    state.status = "cancelled";
                    ORCHESTRATION_resetAllControlFlags();
                    return formatFinalResult(state);
                }

                if (ORCHESTRATION_isPaused()) {
                    logger.log("Workflow paused. Waiting for continue signal...");
                    state.status = "paused";
                    while (ORCHESTRATION_isPaused() && !ORCHESTRATION_shouldContinueFromPause()) {
                        await new Promise(resolve => setTimeout(resolve, 1000)); // Check every second
                    }
                    if (ORCHESTRATION_isCancelled()) { // Check again after pause
                       logger.log("Workflow cancelled during pause.");
                       state.status = "cancelled";
                       ORCHESTRATION_resetAllControlFlags();
                       return formatFinalResult(state);
                    }
                    logger.log("Workflow resuming...");
                    state.status = "running";
                }
                // --- End Controls Check --- //

                const currentAgent = agents[state.currentCycleStep];
                ORCHESTRATION_setActiveAgent(state, currentAgent);
                logger.log(`Round ${state.currentRound + 1}, Step ${state.currentCycleStep + 1}: Activating Agent ${currentAgent.name}`);

                // Determine the message for the current agent
                let messageForAgent:
                 string;
                if (state.currentRound === 0 && state.currentCycleStep === 0) {
                    messageForAgent = state.config.initialMessage;
                } else {
                    // Pass the response from the previous agent
                    const previousMessage = state.conversationHistory[state.conversationHistory.length - 1];
                    messageForAgent = previousMessage?.content || ""; // Handle potential undefined
                    // Optional: Add sender info, e.g., `From ${previousMessage?.agentName}: ${previousMessage?.content}`
                }

                const turnInput: AgentTurnInput = {
                    message: messageForAgent,
                    history: state.conversationHistory, // Provide full history for sequential
                    contextSets: state.contextSets,
                    agentConfig: currentAgent,
                    fullTeam: { name: state.config.teamName, agents: state.config.agents, objectives: state.config.objectives }, // Construct team info
                    orchestrationState: state,
                    userId: state.config.userId,
                    teamName: state.config.teamName,
                };

                // --- Execute Agent Turn --- //
                const turnResult = await ORCHESTRATION_executeAgentTurn(
                    turnInput,
                    sessionState, // Pass sessionState
                    state.config, // Pass config from state
                    memStore      // Pass memStore
                );
                logger.log(`Agent ${turnResult.agentName} completed turn.`);

                // --- Update State --- //
                const agentResponseMessage: ServerMessage = {
                    role: "assistant",
                    content: turnResult.response,
                    agentName: turnResult.agentName,
                };
                state.conversationHistory = [...state.conversationHistory, agentResponseMessage];

                if (turnResult.updatedContextSets) {
                    // Replace or merge context based on strategy (here, replacing)
                    state.contextSets = turnResult.updatedContextSets;
                    logger.log("Context sets updated.");
                }
                // --- End State Update --- //

                 // Optional: Add logic here to check for completion criteria based on agent response
                 // if (someCondition(turnResult.response)) { state.status = "completed"; break; }
            }

            // Check if workflow completed or was interrupted after a full cycle
            if (state.status !== "running") {
               logger.log(`Workflow status is now '${state.status}'. Exiting rounds loop.`);
               break; // Exit rounds loop
            }
        }

        // If loop finishes without explicit completion/cancellation
        if (state.status === "running") {
            logger.log("Maximum rounds reached.");
            state.status = "completed"; // Consider it completed or stopped based on requirements
        }

    } catch (error) {
        logger.error("Error during sequential workflow execution:", { error });
        state.status = "error";
        state.error = error instanceof Error ? error.message : String(error);
    } finally {
        ORCHESTRATION_resetAllControlFlags();
        ORCHESTRATION_setActiveAgent(state, null); // Clear active agent
    }

    return formatFinalResult(state);
}

/**
 * Helper to format the final result object from the state.
 */
function formatFinalResult(state: OrchestrationState): OrchestrationFinalResult {
    // Map intermediate states to 'stopped' for the final result
    const finalStatus = (
        state.status === "completed" ||
        state.status === "cancelled" ||
        state.status === "error"
    ) ? state.status : "stopped";

    return {
        status: finalStatus,
        finalConversationHistory: state.conversationHistory,
        finalContextSets: state.contextSets,
        error: state.error,
        totalRounds: state.currentRound,
        // finalMessage: state.conversationHistory[state.conversationHistory.length - 1]?.content // Optional: include last message
    };
} 