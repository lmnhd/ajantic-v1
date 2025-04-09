import { AgentComponentProps, ContextContainerProps, ServerMessage } from "@/src/lib/types";
import { OrchestrationType2 } from "./base";

/**
 * Context object passed to prompt generation functions.
 * Contains relevant information derived from the current orchestration state and config.
 */
export interface OrchestrationPromptContext {
    // === Core Identification ===
    orchestrationType: OrchestrationType2; // The current orchestration strategy
    currentAgent: AgentComponentProps;    // The agent whose prompt is being generated
    allAgents: AgentComponentProps[];     // All agents in the team/workflow
    teamName: string;
    userId: string;

    // === Task & Goal ===
    initialMessage: string;               // The original user request
    teamObjective: string;                // Overall goal
    currentTaskMessage: string;           // The specific message/task for the current agent

    // === State & History ===
    numRounds: number;
    currentRound: number;
    currentCycleStep: number;
    currentHistorySnapshot: ServerMessage[]; // Relevant history (could be full or summarized)
    currentContextSets: ContextContainerProps[];

    // === Dynamic Workflow Specifics (Optional) ===
    // Used primarily by LLM_ROUTED or MANAGER_DIRECTED prompts
    messageSource?: "user" | "agent" | "manager" | "system"; // Who sent the previous message
} 