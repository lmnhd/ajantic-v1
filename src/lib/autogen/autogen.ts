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

// Using the unified ToolRequest interface from lib/types.ts

const toolRequestSchema = z.object({
  toolGroup: z.string().describe("The group name of the tool to be used"),
  toolName: z.string().describe("The name of the tool to be used"),
  toolDescription: z.string().describe("A description of the tool to be used"),
  suggestedInputs: z.array(z.string()).describe("The suggested inputs for the tool"),
  suggestedOutputs: z.array(z.string()).describe("The suggested outputs for the tool"),
});

const autogen_agent_knowledge_base_schema = z.object({
  knowledgeBaseItems: z
    .array(
      z.object({
        researchTopic: z.string(),
        description: z.string(),
      })
    )
    .describe(
      "A list of topics that should be researched and added to the agent's knowledge base. Minimum 3 items."
    ),
});

// Create a runtime array of the enum values instead of using Object.values
const formValueTypes = ["TEXT", "NUMBER", "BOOLEAN", "ENUM", "DATE"] as const;

const dynamicFormSchema: z.ZodSchema<DynamicFormSchema> = z.array(
  z.object({
    formName: z.string(),
    key: z.string(),
    valueType: z.enum([
      ValueType.STRING,
      ValueType.NUMBER,
      ValueType.BOOLEAN,
      ValueType.OBJECT,
      ValueType.ARRAY,
      ValueType.NULL,
      ValueType.UNDEFINED,
      ValueType.DATE,
      ValueType.ENUM,
      ValueType.FILE,
    ]),
    enumValues: z.array(z.string()).optional(),
    enumLabels: z.array(z.string()).optional(),
  })
);

// const autogen_schema = z.object({
//     team_name: z.string(),
//     team_objective: z.string(),
//     newAgents: z.array(newAgentSchema).describe("The list of new agents that will be created for the workflow. If no new agents are needed, use an empty array."),
//     existingAgents: z.array(z.string()).describe("The list of existing agent names that will be used in the workflow. If no existing agents are needed, use an empty array."),
//     agentSequence: z.array(z.string()).describe("The list of agents involved with the workflow. In a sequential workflow, the agents will be executed in the order they are listed."),
//     sequenceOrder: z.enum(["sequential", "random", "auto"]).describe("The order in which the agents will be executed. Sequential will execute the agents in the order they are listed. Random will execute the agents in a random order. Auto will use an LLM to determine the order in real time based on the messages."),
//     context: z.array(z.object({setName: z.string(), text: z.string(), visibleToAgents: z.array(z.string())})).describe("The context that will be used to store information relevant to the team. This will be used to store information that is relevant to the team, such as the conversation history, the current task, and any other relevant information."),
//     toolRequests: z.array(toolRequestSchema).describe("OPTIONAL: For requesting tools that do not already exist, use this section to describe the tool and its inputs and outputs.").optional(),
//     infoRequest: dynamicFormSchema.optional().describe("OPTIONAL: For requesting information from the user needed to complete the workflow."),
// });

const formatModelResearchOutputSchema = z.object({
  models: z.array(z.object({ provider: z.string(), modelName: z.string() })),
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
  orchestrationType: "sequential" | "random" | "auto";
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
    .enum(["sequential", "random", "auto"])
    .describe(
      "The type of orchestration to use for the workflow. Sequential will execute the agents in the order they are listed. Random will execute the agents in a random order. Auto will use an LLM (auto-agent/manager) to determine the order in real time based on the messages. Auto is recommended when task verification for agent processes is needed."
    ),
  processSteps: z
    .array(z.string())
    .describe("The steps of the process to be automated without the step numbers."),
});

// Function to extract all models with providers from the nested JSON structure
const getAllModelsWithProviders = () => {
  const modelsJSON = UTILS_getModelsJSON();
  const modelsList: string[] = [];

  // Iterate through provider categories
  Object.keys(modelsJSON).forEach((providerCategory) => {
    const modelsInCategory =
      modelsJSON[providerCategory as keyof typeof modelsJSON];

    // Iterate through models in each category
    Object.keys(modelsInCategory).forEach((modelKey) => {
      // Need to use a more specific type assertion
      const model = (modelsInCategory as any)[modelKey];
      modelsList.push(`${model.provider}/${model.name}`);
    });
  });

  return modelsList;
};

// Create schema using the extracted model list
const autogen_agent_model_schema = z.array(
  z.enum(getAllModelsWithProviders() as [string, ...string[]])
);

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
      context.push({
        setName: "Process Steps",
        text: outlineObject?.processSteps?.join("\n") ?? "",
        hiddenFromAgents: team.agents
          .filter((a) => a.type !== "manager")
          .map((a) => a.name),
        lines: [],
        
        fullScreen: false,
        isDisabled: false,
        formSchema: undefined,
       
      });

      // If modifications are present, store process notes as memory - store useful info about common modifications for future auto-gen creations to remember
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
      return {
        processToAutomate,
        readyMadeAgents,
        outlineObjectString: outlineObjectString,
        outlineApproved: outlineApproved,
        resultTeam: team,
        resultContext: context,
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
    memoryNotes
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
    let agentTools: string[] = agentProperties.object.tools || [];
    let customToolsRecord: Record<string, any> = {};

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

            const _definition = await CORE_generateCustomToolDefinition(
              unifiedRequest
            );
            return _definition;
          }
        );

        // Wait for all tool definitions to be generated
        const toolDefinitions = await Promise.all(toolRequestPromises);

        // Create the custom tools
        const customToolsPromise = AGENT_TOOLS_loadCustomTools(
          toolDefinitions,
          agentProperties.object.name,
          userId
        );
        
        // Process any promises from the returned object
        customToolsRecord = {};
        try {
          for (const [key, value] of Object.entries(customToolsPromise)) {
            try {
              if (value instanceof Promise) {
                customToolsRecord[key] = await value;
              } else {
                customToolsRecord[key] = value;
              }
            } catch (toolError) {
              logger.error(`Error processing custom tool '${key}'`, {
                error: toolError instanceof Error ? toolError.message : "Unknown error",
                agent: agentProperties.object.name
              });
              // Skip this tool but continue with others
            }
          }
        } catch (toolsError) {
          logger.error("Error processing custom tools", {
            error: toolsError instanceof Error ? toolsError.message : "Unknown error",
            agent: agentProperties.object.name
          });
          // Continue with agent creation even if tools fail
        }

        // Add custom tool names to the agent's tools array
        Object.keys(customToolsRecord).forEach((toolName) => {
          if (!agentTools.includes(toolName)) {
            agentTools.push(toolName);
          }
        });

        // Log the created tools
        logger.tool("Created Custom Tools", {
          count: Object.keys(customToolsRecord).length,
          agent: agentProperties.object.name,
          toolNames: Object.keys(customToolsRecord),
        });

        // Add a special log just for debugging
        console.log(
          `DEBUG: Created ${
            Object.keys(customToolsRecord).length
          } custom tools for ${agentProperties.object.name}:`,
          Object.keys(customToolsRecord)
        );
      } catch (error) {
        logger.error("Error creating custom tools", {
          error: error instanceof Error ? error.message : "Unknown error",
          agent: agentProperties.object.name,
        });
      }
    }

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
      tools: agentTools,
      customTools: customToolsRecord, // Store the custom tools for later use
    } as AgentComponentProps;

    // check for knowledge base
    if (agentProperties.object.knowledgeBase) {
      // create knowledge base
      const responsibilities = await generateObject({
        model: await MODEL_getModel_ai(
          UTILS_getModelArgsByName("claude-3-7-sonnet-20250219")
        ),
        schema: z.object({
          responsibilities: z.array(z.string()),
        }),
        prompt: PROMPT_AUTO_GENERATE_WORKFLOW.generateResponsibilities(
          agentProperties.object.title,
          agentProperties.object.roleDescription,
          teamObjective
        ),
      });
      await KB_autoCreate(
        userId,
        agentProperties.object.name,
        responsibilities.object.responsibilities,
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

// For usage elsewhere (if needed)
export const MODEL_autogen_getAvailableModels = getAllModelsWithProviders;

// Helper function to convert object to XML-style string for better readability in prompts

