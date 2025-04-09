import { AISessionState, ServerMessage } from "@/src/lib/types";
import {
    AgentTurnInput,
    AgentTurnResult,
    OrchestrationFinalResult,
    OrchestrationState,
} from "../types/base";

import { logger } from "@/src/lib/logger";
import { ORCHESTRATION_setActiveAgent } from "../utils";
import { ORCHESTRATION_resetAllControlFlags } from "../utils/pause-cancel";
import { ORCHESTRATION_executeAgentTurn } from "../utils/agent-execution";
import { MemoryVectorStore } from "langchain/vectorstores/memory";


// Placeholder - Copied from sequential.ts
// TODO: Refactor into a shared utility
function formatFinalResult(orchState: OrchestrationState): OrchestrationFinalResult {
    const finalStatus =
        orchState.status === "completed" ||
            orchState.status === "cancelled" || // Cancelled status might still be set externally
            orchState.status === "error"
            ? orchState.status
            : "completed"; // Default to completed for direct interaction if no error/cancel
    return {
        status: finalStatus,
        finalConversationHistory: orchState.conversationHistory,
        finalContextSets: orchState.contextSets,
        error: orchState.error,
        totalRounds: orchState.currentRound, // Will likely always be 0 or 1 here
    };
}

/**
 * Runs a simple interaction, typically executing a single turn for the first agent provided.
 * Assumes external logic handles any further back-and-forth if needed.
 *
 * @param orchState The initial orchState of the orchestration.
 * @returns A promise resolving to the final result of the orchestration.
 */
export async function ORCHESTRATION_runDirectInteraction(
    initialState: OrchestrationState,
    sessionState: AISessionState,
    memStore: MemoryVectorStore
): Promise<OrchestrationFinalResult> {
    let orchState = { ...initialState };
    orchState.status = "running";
    orchState.currentRound = 0; // Only one effective "round"
    orchState.currentCycleStep = 0;

    const { agents } = orchState.config;

    if (!agents || agents.length === 0) {
        logger.warn("DIRECT_AGENT_INTERACTION called with no agents.");
        orchState.status = "error";
        orchState.error = "No agents provided for direct interaction.";
        ORCHESTRATION_resetAllControlFlags();
        return formatFinalResult(orchState);
    }

    const currentAgent = agents[0]; // Only use the first agent

    try {
        logger.log("Starting DIRECT_AGENT_INTERACTION", { agent: currentAgent.name, config: orchState.config });
        ORCHESTRATION_setActiveAgent(orchState, currentAgent);

        // Prepare input for the single turn
        const turnInput: AgentTurnInput = {
            message: orchState.config.initialMessage,
            history: orchState.conversationHistory, // Pass initial history (likely just user message)
            contextSets: orchState.contextSets,
            agentConfig: currentAgent,
            fullTeam: { name: orchState.config.teamName, agents: orchState.config.agents, objectives: orchState.config.objectives },
            orchestrationState: orchState,
            userId: orchState.config.userId,
            teamName: orchState.config.teamName,
        };

        // --- Execute Agent Turn --- //
        const turnResult = await ORCHESTRATION_executeAgentTurn(turnInput, sessionState, orchState.config, memStore);
        logger.log(`Agent ${turnResult.agentName} completed turn.`);

        // --- Update State --- //
        const agentResponseMessage: ServerMessage = {
            role: "assistant",
            content: turnResult.response,
            agentName: turnResult.agentName,
        };
        // Replace history instead of appending, or keep initial message? Append for now.
        orchState.conversationHistory = [...orchState.conversationHistory, agentResponseMessage];

        if (turnResult.updatedContextSets) {
            orchState.contextSets = turnResult.updatedContextSets;
            logger.log("Context sets updated.");
        }

        if (turnResult.error) {
            throw new Error(turnResult.error);
        }

        orchState.status = "completed"; // Assume completion after one turn

    } catch (error) {
        logger.error("Error during direct interaction execution:", { error });
        orchState.status = "error";
        orchState.error = error instanceof Error ? error.message : String(error);
    } finally {
        ORCHESTRATION_resetAllControlFlags();
        ORCHESTRATION_setActiveAgent(orchState, null);
    }

    return formatFinalResult(orchState);
} 