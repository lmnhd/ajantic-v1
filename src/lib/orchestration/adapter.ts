import { 
  OrchestrationConfig, 
  OrchestrationFinalResult,
  OrchestrationState, 
  OrchestrationType2 
} from "./types";
import { OrchestrationType } from "../types";
import { AISessionState, ContextContainerProps, ServerMessage } from "../types";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { ORCHESTRATION_executeAgentTurn } from "./utils/agent-execution";
import { logger } from "@/src/lib/logger";

/**
 * State update callback system to support UI updates during orchestration
 */
let updateStateCallback: ((state: OrchestrationState) => Promise<void>) | null = null;

/**
 * Set the callback function to be called when state changes during orchestration
 * Client code should call this to register their state update function
 */
export function setOrchestrationStateCallback(callback: (state: OrchestrationState) => Promise<void>) {
  updateStateCallback = callback;
}

/**
 * Call this function to update the UI state with the current orchestration state
 * This will be called between agent turns to keep the UI in sync with the server
 */
export async function updateUIState(state: OrchestrationState): Promise<void> {
  if (updateStateCallback) {
    // Clone the state to avoid mutation issues
    const stateCopy = JSON.parse(JSON.stringify(state));
    
    try {
      // Call the callback with the state copy
      await updateStateCallback(stateCopy);
      
      // Check if we can directly update the client state via zustand
      // This ensures context changes are reflected immediately even during long runs
      try {
        if (typeof window !== 'undefined') {
          // Try to get the analysis store directly if we're on the client
          const analysisStore = (window as any).__ANALYSIS_STORE__;
          
          if (analysisStore && typeof analysisStore.getState === 'function') {
            const storeState = analysisStore.getState();
            
            // If we have a store with context set updating capability,
            // update the context set directly
            if (storeState && typeof storeState.setContextSet === 'function') {
              storeState.setContextSet({
                sets: state.contextSets,
                teamName: state.config.teamName
              });
              
              // Log the direct update
              console.log("Context set updated directly in UI store");
            }
          }
        }
      } catch (storeError) {
        // Ignore errors accessing the store
        console.warn("Could not directly update UI store:", storeError);
      }
      
      // Add delay to allow UI to update
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error("Error updating UI state:", error);
    }
  }
}

/**
 * Maps legacy orchestration types to new orchestration types
 */
export function mapOrchestrationTypes(
  legacyType: OrchestrationType,
  agentOrder: "sequential" | "seq-reverse" | "random"
): OrchestrationType2 {
  switch (legacyType) {
    case "agent-orchestrator":
      return OrchestrationType2.DIRECT_AGENT_INTERACTION;
    case "wf-sequential-1":
      if (agentOrder === "sequential") return OrchestrationType2.SEQUENTIAL_WORKFLOW;
      if (agentOrder === "seq-reverse") return OrchestrationType2.REVERSE_WORKFLOW;
      return OrchestrationType2.RANDOM_WORKFLOW;
    case "wf-sequential-2":
      return OrchestrationType2.LLM_ROUTED_WORKFLOW;
    case "wf-sequential-3":
      return OrchestrationType2.MANAGER_DIRECTED_WORKFLOW;
    default:
      return OrchestrationType2.SEQUENTIAL_WORKFLOW;
  }
}

/**
 * Helper function to create the initial orchestration state
 */
export function createInitialOrchestrationState(config: OrchestrationConfig): OrchestrationState {
  // Make sure config has the default if undefined
  const effectiveConfig = {
      ...config,
      stopOnError: config.stopOnError !== false // Defaults to true if undefined or null
  };
  
  return {
    config: effectiveConfig, // Use the config with default applied
    status: "initializing",
    currentRound: 0,
    currentCycleStep: 0,
    currentAgent: null,
    conversationHistory: [],
    contextSets: config.initialContext || [],
    pauseRequested: false,
    cancelRequested: false,
    continueFromPauseSignal: false,
    // resumable fields are initialized later or are null/undefined by default
  };
}

/**
 * Creates an orchestration config from legacy parameters
 */
export function createOrchestrationConfig(
  legacyType: OrchestrationType,
  agentOrder: "sequential" | "seq-reverse" | "random",
  initialMessage: string,
  agents: any[],
  teamName: string,
  objectives: string,
  userId: string,
  initialContext: ContextContainerProps[] = [],
  maxRounds: number = 10,
  numRounds: number = 0,
  customAgentSet: string[] = [],
  streaming: boolean = false,
  stopOnError: boolean = true // Default to true
): OrchestrationConfig {
  return {
    type: mapOrchestrationTypes(legacyType, agentOrder),
    initialMessage,
    agents,
    teamName,
    objectives,
    userId,
    initialContext,
    maxRounds,
    numRounds,
    customAgentSet,
    streaming,
    agentOrder,
    stopOnError // Add the flag here
  };
}

/**
 * Main adapter function that delegates to appropriate implementation
 */
export async function runOrchestration(
  orchType: OrchestrationType2,
  agentOrder: "sequential" | "seq-reverse" | "random",
  initialState: OrchestrationState,
  sessionState: AISessionState,
  
): Promise<OrchestrationFinalResult> {
  // Ensure config uses the provided type and agent order
  initialState.config.type = orchType;
  initialState.config.agentOrder = agentOrder;
  
  logger.log("Orchestration starting with type:", { 
    type: orchType,
    agentOrder
  });

  // Import implementations dynamically to avoid circular dependencies
  try {
    switch (orchType) {
      case OrchestrationType2.DIRECT_AGENT_INTERACTION: {
        const { ORCHESTRATION_runDirectInteraction } = await import("./modes/direct-interaction");
        // Create control flags for direct interaction
        const controlFlags = {
          paused: initialState.pauseRequested,
          cancelled: initialState.cancelRequested
        };
        return ORCHESTRATION_runDirectInteraction(initialState, sessionState, controlFlags);
      }
      
      case OrchestrationType2.SEQUENTIAL_WORKFLOW: {
        const { ORCHESTRATION_runSequentialWorkflow } = await import("./modes/workflow-sequential/sequential");
        return ORCHESTRATION_runSequentialWorkflow(initialState, sessionState);
      }
      
      case OrchestrationType2.REVERSE_WORKFLOW: {
        const { ORCHESTRATION_runReverseWorkflow } = await import("./modes/workflow-sequential/reverse");
        return ORCHESTRATION_runReverseWorkflow(initialState, sessionState);
      }
      
      case OrchestrationType2.RANDOM_WORKFLOW: {
        const { ORCHESTRATION_runRandomWorkflow } = await import("./modes/workflow-sequential/random");
        return ORCHESTRATION_runRandomWorkflow(initialState, sessionState);
      }
      
      case OrchestrationType2.LLM_ROUTED_WORKFLOW: {
        const { ORCHESTRATION_runLLMRoutedWorkflow } = await import("./modes/llm-routed");
        return ORCHESTRATION_runLLMRoutedWorkflow(initialState, sessionState);
      }
      
      case OrchestrationType2.MANAGER_DIRECTED_WORKFLOW: {
        const { ORCHESTRATION_runManagerDirectedWorkflow } = await import("./modes/manager-directed");
        return ORCHESTRATION_runManagerDirectedWorkflow(initialState, sessionState, updateUIState);
      }
      
      default: {
        // Fall back to sequential workflow
        const { ORCHESTRATION_runSequentialWorkflow } = await import("./modes/workflow-sequential/sequential");
        return ORCHESTRATION_runSequentialWorkflow(initialState, sessionState);
      }
    }
  } catch (error) {
    logger.error("Error in orchestration:", { error });
    return {
      status: "error",
      finalConversationHistory: initialState.conversationHistory,
      finalContextSets: initialState.contextSets,
      error: error instanceof Error ? error.message : String(error),
      totalRounds: initialState.currentRound
    };
  }
} 