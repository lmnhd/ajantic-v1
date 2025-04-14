"use server";
import {
  AgentComponentProps,
  AgentTypeEnum,
  AI_Agent_Tools,
  AI_Agent_ToolsDescription,
  ContextContainerProps,
  ModelProviderEnum,
  Team,
  ToolRequest,
} from "@/src/lib/types";
import {
  UTILS_getAllAvailableToolGroups,
  UTILS_getAllAvailableToolsDescriptions,
  UTILS_getModelArgsByName,
  UTILS_getModelsJSON,
  ValueType,
} from "@/src/lib/utils";
import { OrchestrationType2 } from "@/src/lib/orchestration/types/base";

import Document from "next/document";
import { z } from "zod";
import { PROMPT_AUTO_GENERATE_WORKFLOW } from "@/src/lib/prompts/autogen-workflow-prompt";
import { generateObject, generateText } from "ai";
import { MODEL_getModel_ai } from "@/src/lib/vercelAI-model-switcher";
import { PERPLEXITY_getResponse } from "../agent-tools/perplexity";
import { AGENT_AUTO_PROMPT } from "@/src/lib/prompts/auto-prompt";
import { CORE_generateCustomToolDefinition } from "../agent-tools/auto-gen-tool/auto-gen-tool_core";
import { AGENT_TOOLS_loadCustomTools } from "../agent-tools/auto-gen-tool/load-custom-tools";
import { logger } from "@/src/lib/logger";
import { KB_autoCreate } from "@/src/app/api/kb-auto-create/create-knowledge-base";
import {
  AUTOGEN_MEMORY_checkForProcessnotes,
  AUTOGEN_MEMORY_storeProcessNotesToMemory,
} from "@/src/lib/agent-memory/store-retrieve";
import { DynamicFormSchema } from "@/src/lib/post-message-analysis/form-creator-core";
import { anthropic } from "@ai-sdk/anthropic";
import { ToolRegistry } from "../agent-tools/tool-registry/registry";
import { createCustomToolReference } from "../agent-tools/tool-registry/custom-tool-ref";

// Using the unified ToolRequest interface from lib/types.ts

const toolRequestSchema = z.object({
  toolGroup: z.string().describe("The group name of the tool to be used"),
  toolName: z.string().describe("The name of the tool to be used"),
  toolDescription: z.string().describe("A description of the tool to be used"),
  suggestedInputs: z.array(z.string()).describe("The suggested inputs for the tool"),
  suggestedOutputs: z.array(z.string()).describe("The suggested outputs for the tool"),
});

export interface AutoGenAgent {
  name: string;
  type: "manager" | "agent" | "researcher" | "tool-operator";
  roleDescription: string;
  title: string;
  expectedOutput?: string;
  toolHints?: string[];
}
export interface AutoGenTeam {
  team_name: string;
  team_objective: string;
  availableAgents: AutoGenAgent[];
  newAgents: AutoGenAgent[];
  agentSequence: string[];
  orchestrationType: OrchestrationType2;
  processSteps: string[];
}

const autogen_outline_schema = z.object({
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
  modificationStore?: {
    modifications: string[];
  }[];
};
export const TEAM_autogen_create_workflow = async (
  {
    processToAutomate,
    readyMadeAgents,
    outlineObjectString,
    modifications,
    outlineApproved,
    modificationStore
  }: AutoGenWorkflowProps,
  userId: string
) => {
  console.log("!!!TEAM_autogen_create_workflow!!!", {
    processToAutomate,
    readyMadeAgents,
    outlineObjectString,
    modifications,
    outlineApproved,
  });
  //return {processToAutomate, readyMadeAgents, outlineObject, modifications, outlineApproved}
  let team: Team = {
    name: "",
    objectives: "",
    agents: [],
    contextSets: [],
  };
  let memoryNotes: string[] = [];
  try {
    if (!modifications || modifications.length === 0) {
      // retrieve process notes from memory
      const processNotes = await AUTOGEN_MEMORY_checkForProcessnotes(
        userId,
        processToAutomate
      );
      if (processNotes && processNotes.length > 0) {
        console.log("Process notes found - using them to create team");
        processToAutomate += `\n\nHere are some notes about the process to automate:\n${processNotes.join(
          "\n"
        )}`;
       
        memoryNotes = [...processNotes];
        console.log("Process notes found - using them to create team");
        console.log(processToAutomate);
        console.log(modifications);
      }
    }
    // generate main team object
    if (!outlineApproved) {
      const outline = await TEAM_autogen_create_outline(
        processToAutomate,
        readyMadeAgents,
        outlineObjectString,
        modifications ?? [],
        memoryNotes
      );
      return {
        processToAutomate,
        readyMadeAgents,
        outlineObjectString: JSON.stringify(outline),
        outlineApproved: false,
        modifications: [],
        modificationStore: [...(modificationStore ?? []), {
          modifications: modifications ?? [],
        }]
      } as AutoGenWorkflowProps;
    } else {
      let outlineObject = JSON.parse(outlineObjectString ?? "{}") as AutoGenTeam;
      team.name = outlineObject?.team_name ?? "";
      team.objectives = outlineObject?.team_objective ?? "";
      
      // Directly use the orchestrationType from the outline
      team.orchestrationType = outlineObject?.orchestrationType || OrchestrationType2.SEQUENTIAL_WORKFLOW;
      
      // add only the agents found in the sequence
      team.agents =
        outlineObject?.agentSequence.map((agentName) => {
          // If this is an existing agent, find it in readyMadeAgents
          const existingAgent = readyMadeAgents.find(
            (a) => a.name === agentName
          );
          if (existingAgent) {
            return existingAgent;
          }

          // Otherwise create a basic agent placeholder
          return {
            name: agentName,
            roleDescription: "",
            title: "",
            type: "agent",
            modelArgs: {
              provider: ModelProviderEnum.ANTHROPIC,
              modelName: "claude-3-5-sonnet-20240620",
              temperature: 0.7,
            },
            tools: [] as string[],
          } as AgentComponentProps;
        }) ?? [];

      // generate NEW AGENTS
      
      if (
        outlineObject?.newAgents?.length &&
        outlineObject.newAgents.length > 0
      ) {
       
        for (const newAgent of outlineObject.newAgents) {
          try {
            const agent = await TEAM_autogen_create_agent(
              newAgent.name,
              newAgent.title,
              newAgent.roleDescription,
              newAgent.type,
              UTILS_getAllAvailableToolsDescriptions().flat(),
              newAgent.toolHints ?? [],
              outlineObject.team_objective,
              userId
            );
            
            // replace the generic agent with the new agent in the Team object
            team.agents = team.agents.map((a) => a.name === newAgent.name ? agent as AgentComponentProps : a); 
            // Optional: Add a small delay between requests to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (error) {
            console.error(`Error creating agent ${newAgent.name}:`, error);
            // Continue with the next agent even if one fails
          }
        }
      }

      // generate models for each new agent
      const modelAssignments = await TEAM_autogen_assign_models(
        outlineObject?.newAgents ?? [],
        (
          getModelList("array") as { provider: string; modelName: string }[]
        ).map((model) => ({
          provider: model.provider,
          modelName: model.modelName,
        }))
      );
      if (modelAssignments) {
        // Process assignments to only keep the first assignment per agent
        const processedAgents = new Set<string>();
        const uniqueAssignments = modelAssignments.filter(assignment => {
          if (processedAgents.has(assignment.agentName)) {
            return false; // Skip this assignment as we already have one for this agent
          }
          processedAgents.add(assignment.agentName);
          return true;
        });

        // Apply the filtered assignments
        for (const assignment of uniqueAssignments) {
          const agent = team.agents.find(
            (a) => a.name === assignment.agentName
          );
          if (agent) {
            agent.modelArgs = UTILS_getModelArgsByName(assignment.modelName);
          }
        }
      }
      // create a context and add a set with the process steps
      const context: ContextContainerProps[] = [];
      
      // Create a more complete context object with all expected properties
      const processGuidelinesContext = {
        setName: "Process Guidelines",
        text: outlineObject?.processSteps
          ?.map((step, index) => `${index + 1}. ${step}`)
          .join("\n") ?? "",
        hiddenFromAgents: team.agents
          .filter((a) => a.type !== "manager")
          .map((a) => a.name),
        lines: [],
        fullScreen: false,
        isDisabled: false,
        formSchema: undefined,
        id: `process-guidelines-${Date.now()}`, // Add a unique ID
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      context.push(processGuidelinesContext);
      
      // Set the context sets on the team object
      team.contextSets = context;
      
      // Log detailed information about the context for debugging
      console.log("Created Process Guidelines context:", {
        contextName: processGuidelinesContext.setName,
        contextLength: processGuidelinesContext.text.length,
        contextFirstLine: processGuidelinesContext.text.split('\n')[0],
        hiddenFromCount: processGuidelinesContext.hiddenFromAgents?.length || 0,
        teamContextSets: team.contextSets.length
      });
      
      if (modifications && modifications.length > 0) {
        const processNotes = await generateObject({
          model: await MODEL_getModel_ai(
            UTILS_getModelArgsByName("claude-3-7-sonnet-20250219")
          ),
          schema: z.object({
            processNotes: z.array(z.string()),
            keyword: z.string(),
          }),
          prompt: PROMPT_AUTO_GENERATE_WORKFLOW.processNotes(
            processToAutomate,
            modifications
          ),
        });
        await AUTOGEN_MEMORY_storeProcessNotesToMemory(
          processToAutomate,
          processNotes.object.processNotes,
          userId,
          { modifications: modifications, keyword: processNotes.object.keyword }
        );
      }
      
      // Add additional logging before return
      console.log("Returning workflow with team and context:", {
        teamName: team.name,
        teamObjective: team.objectives,
        agentCount: team.agents.length,
        contextSetsCount: team.contextSets.length,
        returnedContextSetsCount: context.length
      });
      
      return {
        processToAutomate,
        readyMadeAgents,
        outlineObjectString: outlineObjectString,
        outlineApproved: outlineApproved,
        resultTeam: team,
        resultContext: team.contextSets, // Ensure we're returning the same context objects
      } as AutoGenWorkflowProps;
    }

    //
  } catch (error: unknown) {
    console.error(error);
    return {
      processToAutomate,
      readyMadeAgents,
      outlineObjectString: outlineObjectString,
      outlineApproved: outlineApproved,
      modifications: [],
      error: {
        message:
          error instanceof Error ? error.message : "An unknown error occurred",
      },
    } as AutoGenWorkflowProps;
  }
};

export const TEAM_autogen_create_outline = async (
  processToAutomate: string,
  availableAgents: AgentComponentProps[],
  outlineObjectString?: string,
  modifications?: string[],
  memoryNotes?: string[]
) => {
  let outlineObject: AutoGenTeam | undefined = undefined;
  if (outlineObjectString) {
    outlineObject = JSON.parse(outlineObjectString) as AutoGenTeam;
  }
  // generate outline
  const _outlinePrompt = await PROMPT_AUTO_GENERATE_WORKFLOW.outlinePrompt(
    processToAutomate,
    availableAgents,
    outlineObject,
    modifications,
    memoryNotes,
    // Add info about available orchestration types
    [
      { name: "SEQUENTIAL_WORKFLOW", description: "Agents process in fixed forward order" },
      { name: "RANDOM_WORKFLOW", description: "Agents process in random order each round" },
      { name: "LLM_ROUTED_WORKFLOW", description: "An LLM analyzes messages to route tasks dynamically" },
      { name: "MANAGER_DIRECTED_WORKFLOW", description: "A Manager agent explicitly directs the next agent in its response" }
    ]
  );

  console.log("!!!_outlinePrompt!!!", _outlinePrompt);

  const outline = await generateObject({
    model: anthropic('claude-3-7-sonnet-20250219')
    ,
    schema: autogen_outline_schema,
    prompt: _outlinePrompt,
    providerOptions: {
      anthropic: {
        thinking: { type: "enabled", budgetTokens: 12000 },
      },
    },
  });

  return {
    team_name: outline.object.team_name,
    team_objective: outline.object.team_objective,
    availableAgents: outline.object.availableAgents,
    newAgents: outline.object.newAgents,
    agentSequence: outline.object.agentSequence,
    orchestrationType: outline.object.orchestrationType,
    processSteps: outline.object.processSteps,
  } as AutoGenTeam;
};

const newAgentSchema = z.object({
  name: z.string(),
  roleDescription: z.string(),
  title: z.string(),
  type: z.enum([
    AgentTypeEnum.AGENT,
    AgentTypeEnum.TOOL_OPERATOR,
    AgentTypeEnum.MANAGER,
    AgentTypeEnum.RESEARCHER,
  ]),
  process: z
    .array(z.string())
    .describe(
      "The specific steps of the process this agent will follow when processing."
    ),
  tools: z
    .array(z.enum(UTILS_getAllAvailableToolGroups() as [string, ...string[]]))
    .describe(
      "The tools that the agent can use. Only use if type is tool_user. Use empty array if no tools are needed or not applicable."
    ),
  toolRequests: z
    .array(toolRequestSchema)
    .describe(
      "OPTIONAL: For requesting tools that do not already exist, use this section to describe the tool and its inputs and outputs."
    )
    .optional(),
  knowledgeBase: z
    .boolean()
    .describe(
      "OPTIONAL: If the agent will require a knowledge base, set to true. If not, set to false."
    )
    .optional(),
});

export const TEAM_autogen_create_agent = async (
  name: string,
  title: string,
  roleDescription: string,
  type: "agent" | "tool-operator" | "manager" | "researcher",
  availableTools: AI_Agent_ToolsDescription[],
  toolHints: string[],
  teamObjective: string,
  userId: string
): Promise<AgentComponentProps | null> => {
  let result: AgentComponentProps | null = null;
  // generate agent prompt
  const _newAgentPrompt = PROMPT_AUTO_GENERATE_WORKFLOW.agentBuilderPrompt(
    name,
    title,
    roleDescription,
    type,
    availableTools,
    toolHints,
    teamObjective
  );

  console.log("!!!_newAgentPrompt!!!", _newAgentPrompt);
  // generate agent
  const _modelArgs = UTILS_getModelArgsByName("claude-3-7-sonnet-20250219");
  const _model = await MODEL_getModel_ai(_modelArgs);
  const agentProperties = await generateObject({
    model: _model,
    schema: newAgentSchema,
    prompt: _newAgentPrompt,
    providerOptions: {
      anthropic: {
        thinking: { type: "enabled", budgetTokens: 12000 },
      },
    },
  });

  // verify agent and tools
  if (agentProperties.object) {
    // Auto generate prompt
    const _automaticPromptBuilderInstructions = AGENT_AUTO_PROMPT({
      index: 0,
      isDirective: false,
      role: agentProperties.object.roleDescription,
      title: agentProperties.object.title,
      promptSuggestions: `Here are the steps for the agent to follow for successfull task completion: ${agentProperties.object.process.join(
        "\n"
      )}`,
      teamObjective: teamObjective,
      name: agentProperties.object.name,
      //extraInfo: `Be sure to clarify the process steps in a concise xml format.`
    });
    const promptForNewAgent = await generateText({
      model: await MODEL_getModel_ai(
        UTILS_getModelArgsByName("claude-3-5-sonnet-20240620", 0.5)
      ),
      prompt: _automaticPromptBuilderInstructions,
      temperature: 0.5,
    });

    // Initialize tools array with standard tools
    let agentTools: string[] = [];
    
    // Add standard tools from the enum if this is a TOOL_OPERATOR
    if (agentProperties.object.type === AgentTypeEnum.TOOL_OPERATOR) {
      // Convert standard tool names to actual enum values
      agentTools = (agentProperties.object.tools || [])
        .map(toolName => {
          // If it's a valid enum value, use it
          if (Object.values(AI_Agent_Tools).includes(toolName as AI_Agent_Tools)) {
            return toolName;
          }
          // If not, check if it's a string that matches an enum value
          const matchingEnum = Object.values(AI_Agent_Tools).find(
            enumVal => enumVal.toLowerCase() === toolName.toLowerCase()
          );
          return matchingEnum || toolName;
        });
    }

    // Generate any requested custom tools
    if (
      agentProperties.object.toolRequests &&
      agentProperties.object.toolRequests.length > 0
    ) {
      try {
        // Process all tool requests and combine their results
        const toolRequestPromises = agentProperties.object.toolRequests.map(
          async (toolRequest) => {
            const unifiedRequest = {
              name: toolRequest.toolName,
              description: toolRequest.toolDescription,
              inputs: toolRequest.suggestedInputs.map((input) => ({
                name: input,
                type: "string" as const,
                description: `Input: ${input}`,
                required: true,
              })),
              expectedOutput: toolRequest.suggestedOutputs.join(", "),
              toolName: toolRequest.toolName,
              toolDescription: toolRequest.toolDescription,
              suggestedInputs: toolRequest.suggestedInputs,
              suggestedOutputs: toolRequest.suggestedOutputs,
            } as ToolRequest;

            // Generate the tool definition
            const toolDef = await CORE_generateCustomToolDefinition(
              unifiedRequest
            );
            
            // Register the tool in the central registry
            const toolRef = await ToolRegistry.registerTool(
              toolDef.name,
              toolDef.description,
              toolDef.parameters,
              toolDef.implementation || "",
              "function",
              {
                agentId: agentProperties.object.name,
                userId: userId,
                source: "autogen",
                createdAt: new Date().toISOString()
              }
            );
            
            // Add the tool reference to the agent's tools array
            if (!agentTools.includes(toolRef)) {
              agentTools.push(toolRef);
            }
            
            return {
              toolId: toolRef.split(':')[1],
              toolRef,
              name: toolDef.name
            };
          }
        );

        // Wait for all tool registrations to complete
        const registeredTools = await Promise.all(toolRequestPromises);
        
        // Log the created tools
        logger.tool("Created Custom Tools", {
          count: registeredTools.length,
          agent: agentProperties.object.name,
          toolReferences: registeredTools.map(t => t.toolRef),
          toolNames: registeredTools.map(t => t.name)
        });

        // Add a special log just for debugging
        console.log(
          `DEBUG: Created ${
            registeredTools.length
          } custom tools for ${agentProperties.object.name}:`,
          registeredTools.map(t => t.name)
        );
      } catch (error) {
        logger.error("Error creating custom tools", {
          error: error instanceof Error ? error.message : "Unknown error",
          agent: agentProperties.object.name,
        });
      }
    }

    // IMPORTANT: Create agent with ONLY tool references now
    result = {
      name: agentProperties.object.name,
      roleDescription: agentProperties.object.roleDescription,
      title: agentProperties.object.title,
      systemPrompt: promptForNewAgent.text,
      type: agentProperties.object.type,
      modelArgs: {
        provider: ModelProviderEnum.ANTHROPIC,
        modelName: "claude-3-5-sonnet-20240620",
        temperature: 0.7,
      },
      tools: agentTools, // Contains standard tools and custom tool references
    } as AgentComponentProps;

    // Log the created agent's tools for debugging
    logger.debug("Created agent with tools", {
      agentName: agentProperties.object.name,
      toolCount: agentTools.length,
      tools: agentTools,
      standardTools: agentTools.filter(tool => 
        Object.values(AI_Agent_Tools).includes(tool as AI_Agent_Tools)
      ),
      customTools: agentTools.filter(tool => 
        typeof tool === 'string' && tool.startsWith('CUSTOM_TOOL:')
      )
    });

    // check for knowledge base
    if (agentProperties.object.knowledgeBase) {
      // Log that we're creating a knowledge base
      logger.log(`Creating knowledge base for agent ${agentProperties.object.name} - this is a highly selective process`);
      
      // create knowledge base with limited responsibilities
      const responsibilities = await generateObject({
        model: await MODEL_getModel_ai(
          UTILS_getModelArgsByName("claude-3-7-sonnet-20250219")
        ),
        schema: z.object({
          responsibilities: z.array(z.string()).max(3),
        }),
        prompt: PROMPT_AUTO_GENERATE_WORKFLOW.generateResponsibilities(
          agentProperties.object.title,
          agentProperties.object.roleDescription,
          teamObjective
        ) + "\n\nIMPORTANT: Be extremely focused and selective. Return ONLY the 2-3 most critical responsibilities.",
      });
      
      // Ensure we have no more than 3 responsibilities regardless of model output
      const limitedResponsibilities = responsibilities.object.responsibilities.slice(0, 3);
      
      logger.debug(`Generated ${limitedResponsibilities.length} responsibilities for knowledge base`, {
        agent: agentProperties.object.name,
        responsibilities: limitedResponsibilities
      });
      
      await KB_autoCreate(
        userId,
        agentProperties.object.name,
        limitedResponsibilities,
        agentProperties.object.title,
        agentProperties.object.roleDescription,
        teamObjective
      );
    }
    //
  }

  return (
    result || {
      name: "Dumb Agent",
      roleDescription: "This is a dumb agent",
      title: "Dumb Agent",
      type: "agent", // Default agent type
      modelArgs: {
        provider: ModelProviderEnum.ANTHROPIC,
        modelName: "claude-3-5-sonnet-20240620",
        temperature: 0.7,
      },
      tools: [],
    }
  );
};

const getModelList = (stringOrArray: "string" | "array") => {
  const model1 = UTILS_getModelArgsByName(
    UTILS_getModelsJSON().Anthropic["claude-3-5-sonnet-20240620"].name
  );
  const model2 = UTILS_getModelArgsByName(
    UTILS_getModelsJSON().Anthropic["claude-3-7-sonnet-20250219"].name
  );
  const model3 = UTILS_getModelArgsByName(
    UTILS_getModelsJSON().OpenAI["gpt-4.5-preview"].name
  )
  const model4 = UTILS_getModelArgsByName(
    UTILS_getModelsJSON().OpenAI["gpt-4o-mini"].name
  );
  const model5 = UTILS_getModelArgsByName(
    UTILS_getModelsJSON().OpenAI["gpt-4o"].name
  );
  const model6 = UTILS_getModelArgsByName(
    UTILS_getModelsJSON().OpenAI["gpt-3.5-turbo"].name
  );
  const model7 = UTILS_getModelArgsByName(
    UTILS_getModelsJSON().Cohere["command-r-plus"].name
  );
  const model8 = UTILS_getModelArgsByName(
    UTILS_getModelsJSON().Mistral["mistral-large-latest"].name
  );
  const model9 = UTILS_getModelArgsByName(
    UTILS_getModelsJSON().Mistral["open-mistral-7b"].name
  );
  const model10 = UTILS_getModelArgsByName(
    UTILS_getModelsJSON().DeepSeek["deepseek-reasoner"].name
  );
  const model11 = UTILS_getModelArgsByName(
    UTILS_getModelsJSON().Google["models/gemini-1.5-pro-latest"].name
  );
  const model12 = UTILS_getModelArgsByName(
    UTILS_getModelsJSON().Google["models/gemini-2.5-pro-exp-03-25"].name
  );

  return stringOrArray === "string"
    ? [
        model1,
        model2,
        model3,
        model4,
        model5,
        model6,
        model7,
        model8,
        model9,
        model10,
        model11,
        model12,
      ]
        .map((model) => `${model.provider}/${model.modelName}`)
        .join("\n")
    : [
        model1,
        model2,
        model3,
        model4,
        model5,
        model6,
        model7,
        model8,
        model9,
        model10,
        model11,
        model12,
      ];
};

export const TEAM_autogen_assign_models = async (
  agentRoles: AutoGenAgent[],
  modelNames: { provider: string; modelName: string }[]
): Promise<
  { agentName: string; provider: string; modelName: string }[] | null
> => {
  const _modelResearchPrompt =
    PROMPT_AUTO_GENERATE_WORKFLOW.perplexityModelResearch(
      agentRoles,
      modelNames
    );

  const modelResearch = await PERPLEXITY_getResponse(
    _modelResearchPrompt,
    "sonar-deep-research"
  );

  if (!modelResearch) {
    return null;
  }
  const modelResearchOutput = await generateObject({
    model: await MODEL_getModel_ai(
      UTILS_getModelArgsByName(UTILS_getModelsJSON().OpenAI["gpt-4o-mini"].name)
    ),
    schema: z.object({
      model_assignments: z.array(
        z.object({
          agentName: z.string(),
          provider: z.enum(Array.from(new Set(Object.keys(UTILS_getModelsJSON()))) as [string, ...string[]]),
          modelName: z.enum([...(getModelList("array") as {provider: string, modelName: string}[]).map(model => model.modelName)] as [string, ...string[]]),
        })
      ),
    }),
    prompt: PROMPT_AUTO_GENERATE_WORKFLOW.formatModelResearchOutput(
      modelResearch ?? "",
      modelNames
    ),
  });

  return modelResearchOutput.object.model_assignments;
};

// Helper function to convert object to XML-style string for better readability in prompts

