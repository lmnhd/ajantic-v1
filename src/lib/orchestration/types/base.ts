import { AgentComponentProps, ContextContainerProps, ModelArgs, ServerMessage, Team } from "@/src/lib/types";
import { z } from "zod";


/**
 * Defines the distinct orchestration types, replacing the previous Mode+Flow combination.
 */
export enum OrchestrationType2 {
  // Simple Interaction
  DIRECT_AGENT_INTERACTION = "direct_agent_interaction", // For single agent or externally managed flow.

  // Fixed Order Workflows
  SEQUENTIAL_WORKFLOW = "sequential_workflow",       // Agents process in fixed forward order.
  REVERSE_WORKFLOW = "reverse_workflow",         // Agents process in fixed reverse order.
  RANDOM_WORKFLOW = "random_workflow",           // Agents process in random order each round/cycle.

  // Dynamic Workflows
  LLM_ROUTED_WORKFLOW = "llm_routed_workflow",       // An LLM (like auto-redirect) analyzes messages to route tasks dynamically.
  MANAGER_DIRECTED_WORKFLOW = "manager_directed_workflow", // A Manager agent explicitly directs the next agent/task in its response.
}

/**
 * Configuration options provided when starting an orchestration process.
 */
export interface OrchestrationConfig {
  type: OrchestrationType2; // Use the new flattened type
  initialMessage: string;
  agents: AgentComponentProps[]; // The agents participating
  teamName: string;
  objectives: string; // Overall mission/objectives for the team
  userId: string;
  initialContext?: ContextContainerProps[];
  maxRounds?: number; // Still relevant for workflow types
  numRounds?: number; // Still relevant for workflow types
  customAgentSet?: string[]; // If using a subset/custom group of agents
  streaming?: boolean; // Whether agent responses should be streamed
  userActionModelArgs?: ModelArgs; // Model args for handling user action prompts
  factCheck?: boolean; // Flag for potential fact-checking steps
  agentOrder?: "sequential" | "seq-reverse" | "random"; // The order in which agents process for fixed-order workflows
  stopOnError?: boolean; // If true, workflow stops on agent error; if false, routes to manager. Defaults to true.
  currentAgentName?: string; // The name of the agent currently processing
}

/**
 * Represents the dynamic state of an ongoing orchestration process.
 */
export interface OrchestrationState {
  config: OrchestrationConfig;
  status: "initializing" | "running" | "paused" | "awaiting_user" | "completed" | "cancelled" | "error" | "awaiting_credential";
  currentRound: number;
  currentCycleStep: number; // Step within the current round's cycle
  currentAgent: AgentComponentProps | null; // Agent currently processing
  conversationHistory: ServerMessage[];
  contextSets: ContextContainerProps[];
  currentSummary?: string; // Optional summary of the conversation
  error?: string | null; // Error message if the process failed
  pauseRequested: boolean;
  cancelRequested: boolean;
  continueFromPauseSignal: boolean; // Flag to resume from pause
  resumableErrorAgentName?: string | null;
  resumableErrorMessage?: string | null;
}

/**
 * Data passed to an agent function to perform its turn.
 * This is analogous to the props/arguments needed by functions like `basicAgentChat`.
 */
export interface AgentTurnInput {
  message: string; // The specific message/task for this agent
  query?: string; // Potentially the underlying user query for context
  history: ServerMessage[]; // Relevant conversation history (potentially summarized)
  contextSets: ContextContainerProps[];
  agentConfig: AgentComponentProps; // The configuration of the agent taking the turn
  fullTeam: Team; // Information about the entire team
  orchestrationState: Readonly<OrchestrationState>; // Read-only access to the overall state
  userId: string;
  teamName: string;
  // Add other relevant pieces like vectorStore if needed directly by agents
}

/**
 * The result returned after an agent completes its turn.
 * Analogous to parts of `AgentUserResponse`.
 */
export interface AgentTurnResult {
  status: AgentTurnStatus; // Use the updated status type
  message?: string; // Optional main message/response content
  response?: string; // Often used for the primary text output
  agentName: string;
  error?: string; // Optional error message string
  contextModified?: boolean; // Optional flag
  agentDirectives?: any; // Keep existing fields
  validationResult?: any; // Keep existing fields (consider unifying with validationResult)
  validationStatus?: any; // Keep existing fields (consider unifying with validationResult)
  allContextSets?: any; // Keep existing fields
  credentialName?: string; // <-- Add optional credential name field
}

// Define the possible statuses
export type AgentTurnStatus =
  | 'COMPLETED'
  | 'ERROR'
  | 'COMPLETED_AND_VALIDATED'
  | 'VALIDATION_FAILED'
  | 'REQUIRES_CREDENTIAL_INPUT'; // <-- Add this status

// Add this near other schemas or helpers
export const ValidationSchema = z.object({
  meetsCriteria: z.boolean().describe("Does the response meet all the specified criteria?"),
  reason: z.string().optional().describe("Brief explanation if criteria are not met."),
});


/**
 * Represents the outcome of a single step (often one agent's turn or a routing decision)
 * within the orchestration loop.
 */
export interface OrchestrationStepResult {
  nextAgent?: AgentComponentProps | null; // Which agent should go next (null if user/complete)
  messageForNextAgent?: string; // The message to pass to the next agent
  updatedHistory: ServerMessage[]; // The conversation history including the last turn
  updatedContextSets?: ContextContainerProps[]; // Context after the step
  redirectToUser?: boolean; // Does the process need input from the user?
  infoRequestForm?: any; // Optional structured form for user input (e.g., from auto-redirect)
  workflowComplete?: boolean; // Has the overall goal been achieved?
  summarizeConversation?: boolean; // Signal if history needs summarization
  error?: string; // Error during this step
}

/**
 * The final output returned when the orchestration process concludes.
 */
export interface OrchestrationFinalResult {
  status: "completed" | "cancelled" | "error" | "stopped";
  finalMessage?: string; // A concluding message, if any
  finalConversationHistory: ServerMessage[];
  finalContextSets: ContextContainerProps[];
  error?: string; // Error message if stopped due to an error
  totalRounds: number;
}

/**
 * Interface for the core orchestration execution logic.
 * Different modes/flows will implement this.
 */
export interface Orchestrator {
  initialize(config: OrchestrationConfig): Promise<OrchestrationState>;
  run(initialState?: OrchestrationState): Promise<OrchestrationFinalResult>;
  // Potentially add methods for pause, resume, cancel if needed externally
  // pause(): Promise<void>;
  // resume(): Promise<void>;
  // cancel(): Promise<void>;
}

export interface ClientAugmentedServerMessage extends ServerMessage {
  _recipientAgentName?: string; // Optional client-side field
}
