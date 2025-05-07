// src/lib/orchestration/modes/direct-interaction.ts
import { ServerMessage } from "@/src/lib/types";
import {
    AgentTurnInput,
    AgentTurnResult, // Added
    OrchestrationFinalResult,
    OrchestrationState,
} from "@/src/lib/orchestration/types/base";

import {
    ORCHESTRATION_executeAgentTurn
} from "@/src/lib/orchestration/utils/agent-execution";
import { logger } from "@/src/lib/logger";
import { AISessionState } from "@/src/lib/types";
import { updateUIState } from "@/src/lib/orchestration/adapter";
import { useAnalysisStore } from "@/src/lib/store/analysis-store"; // Import store
import { MissingCredentialError } from "@/src/lib/agent-tools/load-agent-tools"; // Import error
import { ORCHESTRATION_isCancelled } from "../utils"; // Import cancel check

// Define the ControlFlags interface - this seems to be a local concept for this mode
interface ControlFlags {
    paused?: boolean;
    cancelled?: boolean;
    error?: string;
}

/**
 * Formats the final result of the orchestration
 */
function formatFinalResult(
    state: OrchestrationState,
    flags: ControlFlags // Keep using local ControlFlags for this formatter
): OrchestrationFinalResult {
    let status: "completed" | "cancelled" | "error" | "stopped";

    if (flags.error) {
        status = "error";
    } else if (flags.cancelled) {
        status = "cancelled";
    } else if (state.status === "completed") {
        status = "completed";
    } else {
        status = "stopped"; // Default for direct interaction if not explicitly completed/cancelled/error
    }

    return {
        status,
        finalConversationHistory: state.conversationHistory,
        finalContextSets: state.contextSets,
        error: flags.error,
        totalRounds: state.currentRound // Typically 1 for direct interaction
    };
}

/**
 * Runs a direct interaction with the first agent provided.
 */
export async function ORCHESTRATION_runDirectInteraction(
    orchestrationState: OrchestrationState,
    sessionState: AISessionState, // Renamed from 'state' to 'sessionState' for clarity
    controlFlags: ControlFlags // Keep using local ControlFlags for this mode
): Promise<OrchestrationFinalResult> {

    // --- Initial Checks ---
    if (controlFlags.paused) { // Simplified initial pause check
        logger.log("Direct interaction start requested while paused, returning current state");
        return formatFinalResult(orchestrationState, controlFlags);
    }
    if (controlFlags.cancelled || ORCHESTRATION_isCancelled()) { // Check global cancel flag too
        logger.log("Direct interaction cancelled at start.");
        orchestrationState.status = "cancelled";
        controlFlags.cancelled = true; // Ensure local flag is set
        return formatFinalResult(orchestrationState, controlFlags);
    }

    const initialMessage = orchestrationState.conversationHistory.find(
        (msg: any) => msg.role === "user" // Removed isInitialMessage, assuming first user message
    );

    if (!initialMessage) {
        logger.error("No initial user message found in conversation history for direct interaction");
        controlFlags.error = "No initial user message found";
        orchestrationState.status = "error";
        return formatFinalResult(orchestrationState, controlFlags);
    }

    if (!orchestrationState.config.agents || orchestrationState.config.agents.length === 0) {
        logger.error("No agents provided in orchestration config for direct interaction");
        controlFlags.error = "No agents configured";
        orchestrationState.status = "error";
        return formatFinalResult(orchestrationState, controlFlags);
    }
    // Use the first agent available
    const agent = orchestrationState.config.agents[0];
    orchestrationState.currentAgent = agent; // Set current agent for UI

    const agentTurnInput: AgentTurnInput = {
        agentConfig: agent,
        message: initialMessage.content || "",
        history: orchestrationState.conversationHistory,
        contextSets: orchestrationState.contextSets || [],
        userId: orchestrationState.config.userId || "unknown",
        teamName: orchestrationState.config.teamName || "Direct Interaction",
        orchestrationState: orchestrationState, // Pass current state
        fullTeam: { agents: orchestrationState.config.agents, name: orchestrationState.config.teamName || "Direct Team", objectives: orchestrationState.config.objectives || "Direct objective" },
    };

    orchestrationState.status = "running";
    orchestrationState.currentRound = 1; // Direct interaction is like one round
    await updateUIState(orchestrationState); // Initial UI update

    // Initialize turnResult before the try block
    let turnResult: AgentTurnResult | undefined = undefined;

    try {
        turnResult = await ORCHESTRATION_executeAgentTurn(
            agentTurnInput,
            sessionState,
            orchestrationState.config
        );

        if (turnResult?.status === 'REQUIRES_CREDENTIAL_INPUT' && turnResult.credentialName) { // Optional chaining for status
            logger.warn(`Direct Interaction stopping: Agent ${turnResult.agentName} requires credential ${turnResult.credentialName}`);
            useAnalysisStore.getState().requireCredentialInput({
                credentialName: turnResult.credentialName,
                retryPayload: agentTurnInput
            });
            orchestrationState.status = "awaiting_credential"; // New status
            await updateUIState(orchestrationState);
            // No loop to break here, function will proceed to formatFinalResult
        }
        // No explicit catch for MissingCredentialError here, as direct interaction is simpler.
        // The top-level catch in the calling code (e.g., handleOrchestratedChatSubmit) might handle it,
        // OR we add it here for consistency if direct-interaction is also called from a place that won't re-trigger.
        // For now, assuming a simpler error path. If an error occurs, it falls to the processing below.

    } catch (error) {
        // Adding MissingCredentialError handling for consistency
        if (error instanceof MissingCredentialError) {
            logger.warn(`Direct Interaction stopping: Agent ${agent.name} requires credential ${error.credentialName} (caught error)`);
            useAnalysisStore.getState().requireCredentialInput({
                credentialName: error.credentialName,
                retryPayload: agentTurnInput
            });
            orchestrationState.status = "awaiting_credential";
            await updateUIState(orchestrationState);
            // Function will proceed to formatFinalResult
        } else {
            logger.error(`Error during direct agent turn execution for ${agent.name}:`, { error });
            controlFlags.error = error instanceof Error ? error.message : String(error);
            orchestrationState.status = "error";
            orchestrationState.error = controlFlags.error;
            await updateUIState(orchestrationState);
            return formatFinalResult(orchestrationState, controlFlags); // Return early on other errors
        }
    }

    // Process successful turn result or if status became 'awaiting_credential'
    if (orchestrationState.status === "awaiting_credential") {
        // Do nothing more, UI will handle.
    } else if (turnResult && turnResult.error) {
        logger.error(`Agent ${turnResult.agentName} turn resulted in error: ${turnResult.error}`);
        controlFlags.error = turnResult.error;
        orchestrationState.status = "error";
        orchestrationState.error = turnResult.error;
    } else if (turnResult) { // If turnResult is defined and has no error
        orchestrationState.conversationHistory.push({
            role: "assistant",
            content: turnResult.response || "",
            agentName: agent.name,
        } as ServerMessage);
        orchestrationState.status = "completed";
    } else {
        // Fallback: This 'else' block is reached if:
        // 1. orchestrationState.status was NOT "awaiting_credential" (handled by the first 'if').
        // 2. turnResult was undefined OR turnResult had no .error property (so not handled by the two 'else if' above).

        // At this point, if orchestrationState.status is still "running" (or anything other than
        // "error" set by the catch block, or "completed" / "awaiting_credential" set above),
        // it means the agent turn didn't produce a usable result or a recognized error state.
        if (orchestrationState.status === "running") {
             logger.warn("Direct interaction: Agent turn completed but turnResult is invalid and status is still 'running'. Marking as error.");
             orchestrationState.status = "error";
             controlFlags.error = "Unexpected end: Agent turn yielded no usable result.";
        }
        // If orchestrationState.status was already set to "error" by the 'catch' block,
        // or "awaiting_credential" (though the first 'if' should catch this), we don't overwrite it.
        // This primarily targets the scenario where 'turnResult' is undefined after the try-catch.
    }

    await updateUIState(orchestrationState);
    return formatFinalResult(orchestrationState, controlFlags);
}