import { ServerMessage } from "@/src/lib/types";
import {
    AgentTurnInput,
    OrchestrationFinalResult,
    OrchestrationState,
   
} from "@/src/lib/orchestration/types/base";

import {
    ORCHESTRATION_executeAgentTurn
} from "@/src/lib/orchestration/utils/agent-execution";
import { logger } from "@/src/lib/logger";
import { AISessionState } from "@/src/lib/types";
import { updateUIState } from "@/src/lib/orchestration/adapter";

// Define the ControlFlags interface
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
    flags: ControlFlags
): OrchestrationFinalResult {
    // Map the status to valid OrchestrationFinalResult status values
    let status: "completed" | "cancelled" | "error" | "stopped";
    
    if (flags.error) {
        status = "error";
    } else if (flags.cancelled) {
        status = "cancelled";
    } else if (state.status === "completed") {
        status = "completed";
    } else {
        status = "stopped";
    }
    
    return {
        status,
        finalConversationHistory: state.conversationHistory,
        finalContextSets: state.contextSets,
        error: flags.error,
        totalRounds: state.currentRound
    };
}

/**
 * Runs a direct interaction with the first agent provided.
 * This function runs primarily on the client side, calling server functions for LLM operations.
 * 
 * @param orchestrationState The current orchestration state
 * @param state Session state for tools and context
 * @param controlFlags Control flags for orchestration
 * @returns The final result of the orchestration
 */
export async function ORCHESTRATION_runDirectInteraction(
    orchestrationState: OrchestrationState,
    state: AISessionState,
    controlFlags: ControlFlags
): Promise<OrchestrationFinalResult> {
    // Check for paused or cancelled state
    if (controlFlags.paused || controlFlags.cancelled) {
        logger.log("Direct interaction is paused or cancelled, returning current state");
        return formatFinalResult(orchestrationState, controlFlags);
    }

    // Get initial message content
    const initialMessage = orchestrationState.conversationHistory.find(
        (msg: any) => msg.role === "user" && msg.isInitialMessage
    );

    if (!initialMessage) {
        logger.error("No initial message found in conversation history");
        return formatFinalResult(orchestrationState, {
            ...controlFlags,
            error: "No initial message found in conversation history",
        });
    }

    // Select the first agent - direct interaction only works with a single agent
    if (!orchestrationState.config.agentOrder) {
        logger.error("No agent order provided in orchestration config");
        return formatFinalResult(orchestrationState, {
            ...controlFlags,
            error: "No agent order provided in orchestration config",
        });
    }

    // Ensure team is defined
    if (!orchestrationState.config.teamName) {
        logger.error("No team provided in orchestration state");
        return formatFinalResult(orchestrationState, {
            ...controlFlags,
            error: "No team provided in orchestration state",
        });
    }

    // Get the agent to use
    const agentName = orchestrationState.config.agentOrder.split(",")[0].trim();
    const agent = orchestrationState.config.agents.find(
        (a: any) => a.name === agentName
    );

    if (!agent) {
        logger.error(`Agent ${agentName} not found in team`);
        return formatFinalResult(orchestrationState, {
            ...controlFlags,
            error: `Agent ${agentName} not found in team`,
        });
    }

    // Prepare agent turn input
    const agentTurnInput: AgentTurnInput = {
        agentConfig: agent,
        message: initialMessage.content || "",
        history: orchestrationState.conversationHistory,
        contextSets: orchestrationState.contextSets || [],
        userId: orchestrationState.config.userId || "unknown",
        teamName: orchestrationState.config.teamName || "Direct Interaction",
        orchestrationState: orchestrationState,
        fullTeam: {agents: orchestrationState.config.agents, name: orchestrationState.config.teamName, objectives: orchestrationState.config.objectives},
    };

    // Set current agent
    orchestrationState.currentAgent = agent;
    orchestrationState.status = "running";
    
    // Update UI state before agent execution
    await updateUIState(orchestrationState);

    // Execute the agent turn using the server function
    const turnResult = await ORCHESTRATION_executeAgentTurn(
        agentTurnInput,
        state,
        orchestrationState.config
    );

    // Update orchestration state with agent response
    orchestrationState.conversationHistory.push({
        role: "assistant",
        content: turnResult.response,
        senderName: agent.name,
        isResponse: true,
    } as ServerMessage);

    // Reset control flags and update status
    orchestrationState.status = "completed";
    controlFlags.paused = false;
    controlFlags.cancelled = false;
    
    // Final UI update
    await updateUIState(orchestrationState);

    // Return final result
    return formatFinalResult(orchestrationState, controlFlags);
} 