import { z } from "zod";
import {
  AgentComponentProps,
  Team,
  ContextContainerProps,
  ModelProviderEnum,
} from "@/src/lib/types";
import { OrchestrationType2 } from "../orchestration/types";

// Schema previously in autogen.ts
export const toolRequestSchema = z.object({
  toolGroup: z.string().describe("The group name of the tool to be used"),
  toolName: z.string().describe("The name of the tool to be used"),
  toolDescription: z.string().describe("A description of the tool to be used"),
  suggestedInputs: z.array(z.string()).describe("The suggested inputs for the tool"),
  suggestedOutputs: z.array(z.string()).describe("The suggested outputs for the tool"),
});

// Interface previously in autogen.ts
export interface AutoGenAgent {
  name: string;
  type: "manager" | "agent" | "researcher" | "tool-operator";
  roleDescription: string;
  title: string;
  expectedOutput?: string;
  toolHints?: string[];
}

// Interface previously in autogen.ts
export interface AutoGenTeam {
  team_name: string;
  team_objective: string;
  availableAgents: AutoGenAgent[];
  newAgents: AutoGenAgent[];
  agentSequence: string[];
  orchestrationType: OrchestrationType2;
  processSteps: string[];
}

// Type previously in autogen.ts
export type AutoGenWorkflowProps = {
  processToAutomate: string;
  readyMadeAgents: AgentComponentProps[];
  outlineObjectString?: string;
  modifications?: string[];
  outlineApproved?: boolean;
  error?: {
    message: string;
  };
  resultTeam?: Team;
  resultContext?: ContextContainerProps[];
  orchestrationType?: OrchestrationType2;
  modificationStore?: {
    modifications: string[];
  }[];
  requiredCredentials?: string[];
};

// Zod schema previously defined inline in autogen.ts
export const autogen_outline_schema = z.object({
  team_name: z.string(),
  team_objective: z.string(),
  availableAgents: z
    .array(
      z.object({
        name: z.string(),
        roleDescription: z.string(),
        title: z.string(),
        type: z.enum(["manager", "agent", "researcher", "tool-operator"]),
      })
    )
    .describe("The list of available agent names involved with the workflow."),
  newAgents: z
    .array(
      z.object({
        name: z.string(),
        type: z.enum(["manager", "agent", "researcher", "tool-operator"]),
        roleDescription: z.string(),
        title: z.string(),
        expectedOutput: z.string().describe("What is the expected output of this agent? (e.g. 'a list of urls', 'a pdf document', 'a csv file', 'a markdown report', 'a tweet', 'a linkedin post', etc.)"),
        toolHints: z.array(z.string()).optional().describe("OPTIONAL - Tool_operator agents only: List of suggestions for tools that this agent will need. (e.g. 'web scraper', 'oauth2 tool', 'puppeteer browser', 'pdf reader', 'linkedin poster', etc.)"),
      })
    )
    .describe(
      "The list of new agents that will be created for the workflow. If no new agents are needed, use an empty array."
    ),
  agentSequence: z
    .array(z.string())
    .describe(
      "The list of agents involved with the workflow. Do not add the same agent more than once. In a sequential workflow, the agents will be executed in the order they are listed."
    ),
  orchestrationType: z
    .nativeEnum(OrchestrationType2)
    .describe(
      "The type of orchestration to use for the workflow. SEQUENTIAL_WORKFLOW executes agents in sequence. RANDOM_WORKFLOW executes in random order. LLM_ROUTED_WORKFLOW uses an LLM to determine order (recommended for task verification). MANAGER_DIRECTED_WORKFLOW uses a manager agent to direct the workflow."
    ),
  processSteps: z
    .array(z.string())
    .describe("The steps of the process to be automated without the step numbers."),
}); 