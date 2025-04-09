import { AISessionState, ServerMessage } from "@/src/lib/types";
import {
    AgentTurnInput,
    AgentTurnResult,
    OrchestrationFinalResult,
    OrchestrationState,
} from "../../types/base";
import {
    ORCHESTRATION_isCancelled,
    ORCHESTRATION_isPaused,
    ORCHESTRATION_resetAllControlFlags,
    ORCHESTRATION_setActiveAgent,
    ORCHESTRATION_shouldContinueFromPause,
    ORCHESTRATION_executeAgentTurn
} from "../../utils";
import { logger } from "@/src/lib/logger"; // Assuming logger is accessible
import { MemoryVectorStore } from "langchain/vectorstores/memory";

// Placeholder - Copied from sequential.ts
// TODO: Refactor agent execution logic into a shared utility/service
/*
async function executeAgentTurn(input: AgentTurnInput): Promise<AgentTurnResult> {
    logger.log(`Executing turn for agent: ${input.agentConfig.name} with message: ${input.message.substring(0, 50)}...`);
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate async work
    return {
        response: `Response from ${input.agentConfig.name} based on: ${input.message.substring(0, 30)}...`,
        agentName: input.agentConfig.name,
    };
}
*/

// Placeholder - Copied from sequential.ts
// TODO: Refactor into a shared utility
function formatFinalResult(orchState: OrchestrationState): OrchestrationFinalResult {
    const finalStatus =
        orchState.status === "completed" ||
            orchState.status === "cancelled" ||
            orchState.status === "error"
            ? orchState.status
            : "stopped";
    return {
        status: finalStatus,
        finalConversationHistory: orchState.conversationHistory,
        finalContextSets: orchState.contextSets,
        error: orchState.error,
        totalRounds: orchState.currentRound,
    };
}

/**
 * Runs a multi-agent workflow where agents are processed sequentially
 * in REVERSE order of the configuration.
 *
 * @param orchState The initial or current orchState of the orchestration.
 * @returns A promise resolving to the final result of the orchestration.
 */
export async function ORCHESTRATION_runReverseWorkflow(
    initialState: OrchestrationState,
    sessionState: AISessionState,
    memStore: MemoryVectorStore
): Promise<OrchestrationFinalResult> {
    let orchState = { ...initialState };
    orchState.status = "running";

    const { agents, maxRounds = 10, numRounds = 0 } = orchState.config;
    const effectiveMaxRounds = numRounds > 0 ? numRounds : maxRounds;

    try {
        logger.log("Starting REVERSE_WORKFLOW", { config: orchState.config });

        for (orchState.currentRound = 0; orchState.currentRound < effectiveMaxRounds; orchState.currentRound++) {
            logger.log(`Starting Round ${orchState.currentRound + 1}/${effectiveMaxRounds}`);

            // --- Cycle through agents in REVERSE order --- //
            for (let i = agents.length - 1; i >= 0; i--) {
                orchState.currentCycleStep = i; // Keep track of the original index if needed, though loop uses i

                // --- Check for Controls --- //
                if (ORCHESTRATION_isCancelled()) {
                    logger.log("Workflow cancelled.");
                    orchState.status = "cancelled";
                    ORCHESTRATION_resetAllControlFlags();
                    return formatFinalResult(orchState);
                }
                if (ORCHESTRATION_isPaused()) {
                     logger.log("Workflow paused. Waiting for continue signal...");
                    orchState.status = "paused";
                    while (ORCHESTRATION_isPaused() && !ORCHESTRATION_shouldContinueFromPause()) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                    if (ORCHESTRATION_isCancelled()) {
                        logger.log("Workflow cancelled during pause.");
                        orchState.status = "cancelled";
                        ORCHESTRATION_resetAllControlFlags();
                        return formatFinalResult(orchState);
                    }
                    logger.log("Workflow resuming...");
                    orchState.status = "running";
                }
                // --- End Controls Check --- //

                const currentAgent = agents[i]; // Get agent based on reverse loop index
                ORCHESTRATION_setActiveAgent(orchState, currentAgent);
                // Note: Step count logs might be confusing in reverse, adjust if needed
                logger.log(`Round ${orchState.currentRound + 1}, Reverse Step ${agents.length - i}: Activating Agent ${currentAgent.name}`);

                // Determine message for agent (same logic as sequential)
                let messageForAgent: string;
                const isFirstTurnOverall = orchState.currentRound === 0 && i === agents.length - 1;
                if (isFirstTurnOverall) {
                    messageForAgent = orchState.config.initialMessage;
                } else {
                    const previousMessage = orchState.conversationHistory[orchState.conversationHistory.length - 1];
                    messageForAgent = previousMessage?.content || "";
                }

                const turnInput: AgentTurnInput = {
                    message: messageForAgent,
                    history: orchState.conversationHistory,
                    contextSets: orchState.contextSets,
                    agentConfig: currentAgent,
                    fullTeam: { name: orchState.config.teamName, agents: orchState.config.agents, objectives: orchState.config.objectives },
                    orchestrationState: orchState,
                    userId: orchState.config.userId,
                    teamName: orchState.config.teamName,
                };

                // Use the real execution function
                const turnResult = await ORCHESTRATION_executeAgentTurn(turnInput, sessionState, orchState.config, memStore);
                logger.log(`Agent ${turnResult.agentName} completed turn.`);

                const agentResponseMessage: ServerMessage = {
                    role: "assistant",
                    content: turnResult.response,
                    agentName: turnResult.agentName,
                };
                orchState.conversationHistory = [...orchState.conversationHistory, agentResponseMessage];

                if (turnResult.updatedContextSets) {
                    orchState.contextSets = turnResult.updatedContextSets;
                    logger.log("Context sets updated.");
                }
            }

            // Check if workflow interrupted after a full cycle
            if (orchState.status !== "running") {
                logger.log(`Workflow status is now '${orchState.status}'. Exiting rounds loop.`);
                break;
            }
        }

        if (orchState.status === "running") {
            logger.log("Maximum rounds reached.");
            orchState.status = "completed";
        }

    } catch (error) {
        logger.error("Error during reverse workflow execution:", { error });
        orchState.status = "error";
        orchState.error = error instanceof Error ? error.message : String(error);
    } finally {
        ORCHESTRATION_resetAllControlFlags();
        ORCHESTRATION_setActiveAgent(orchState, null);
    }

    return formatFinalResult(orchState);
} 