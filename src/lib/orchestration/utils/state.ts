import { AgentComponentProps, ServerMessage, Team } from "@/src/lib/types";
import { OrchestrationConfig, OrchestrationState } from "../types/base";
import { ORCHESTRATION_resetAllControlFlags } from "./pause-cancel";

/**
 * Initializes the OrchestrationState based on the provided configuration.
 *
 * This function sets up the initial state object required to begin the
 * orchestration process, including setting status, round/step counters,
 * initial history/context, and resetting control flags.
 *
 * Note: This replaces the logic previously in `initializeOrchestrationState`
 * from the old structure, adapting it to the new types.
 */
export function ORCHESTRATION_initializeState(
  config: OrchestrationConfig
): OrchestrationState {

  // Reset pause/cancel flags at the beginning of a new orchestration
  ORCHESTRATION_resetAllControlFlags();

  // Prepare the initial conversation history if the initial message exists
  const initialHistory: ServerMessage[] = [];
  if (config.initialMessage) {
    initialHistory.push({
      role: "user", // Assuming the initial message is always from the user
      content: config.initialMessage,
      agentName: "User", // Or derive from config if user info is available
    });
  }

  const initialState: OrchestrationState = {
    config: { ...config }, // Store a copy of the config
    status: "initializing",
    currentRound: 0,
    currentCycleStep: 0,
    currentAgent: null, // Will be set by the specific mode/flow logic
    conversationHistory: initialHistory,
    contextSets: config.initialContext || [],
    currentSummary: undefined,
    error: undefined,
    pauseRequested: false,
    cancelRequested: false,
    continueFromPauseSignal: false,
  };

  return initialState;
}

/**
 * Helper function to set the currently active agent within the state.
 * (Similar to `setCurrentActiveAgent` from the old structure, but simplified
 * as it directly modifies the state object passed to it).
 *
 * IMPORTANT: This function MUTATES the state object directly.
 */
export function ORCHESTRATION_setActiveAgent(
  state: OrchestrationState,
  agent: AgentComponentProps | null
): void {
  state.currentAgent = agent;
  // Note: The old version updated an external store (via `set`).
  // In this refactored structure, the orchestration runner will manage the state object.
  // UI updates would need to happen based on observing changes to the OrchestrationState
  // or through events emitted by the orchestrator.
}

/**
 * Creates the initial `OrchestrationProps` object.
 * DEPRECATED in favor of `OrchestrationState` and `OrchestrationConfig`.
 * This function is kept for reference during refactoring but should eventually be removed.
 */
/*
export function createOrchestrationProps(
  // ... args
): OrchestrationProps {
  // ... old logic ...
}
*/ 