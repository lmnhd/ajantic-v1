import { AgentComponentProps, ContextContainerProps, ServerMessage } from "@/src/lib/types";
import { OrchestrationType2 } from "../types/base";

/**
 * Context object for prompt generation functions.
 * Contains all information needed to construct an appropriate prompt
 * for a specific agent in a specific orchestration workflow.
 */
export interface OrchestrationPromptContext {
    // === Core Identification ===
    orchestrationType: OrchestrationType2;
    agentOrder: "sequential" | "seq-reverse" | "random"; // Explicit agent order for non-manager workflows
    currentAgent: AgentComponentProps;
    allAgents: AgentComponentProps[];
    teamName: string;
    userId: string;
    
    // === Task & Goal ===
    initialMessage: string;
    teamObjective: string;
    currentTaskMessage: string;

    // === State & History ===
    numRounds: number;
    currentRound: number;
    currentCycleStep: number;
    currentHistorySnapshot: ServerMessage[];
    currentContextSets: ContextContainerProps[];

    // === Dynamic Workflow Specifics (Optional) ===
    // Used primarily by LLM_ROUTED or MANAGER_DIRECTED prompts
    messageSource?: "user" | "agent" | "manager" | "system";

    /** Optional output criteria provided by the manager for this specific task */
    expectedOutputCriteria?: any;
} 

// can you double check the 'CurrentConversation" storage routines since we have now updated the serverMessage interface? Will we encounter issues with storing and loading new and legacy messages?