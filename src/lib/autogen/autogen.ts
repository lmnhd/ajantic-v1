"use server";
import {
  AI_Agent_Tools,
  AI_Agent_ToolsDescription,
  ModelProviderEnum,
  AgentTypeEnum,
  ToolRequest,
  ModelArgs
} from "@/src/lib/types";
import {
  UTILS_getAllAvailableToolGroups,
  UTILS_getAllAvailableToolsDescriptions,
  UTILS_getModelArgsByName,
  UTILS_getModelsJSON,
  ValueType,
  AUTOGEN_getModelList,
  mapToFullModelName
} from "@/src/lib/utils";
import { OrchestrationType2 } from "@/src/lib/orchestration/types/base";

import Document from "next/document";
import { z } from "zod";
import { PROMPT_AUTO_GENERATE_WORKFLOW } from "@/src/lib/prompts/autogen-workflow-prompt";
import { generateObject, generateText } from "ai";
import { MODEL_getModel_ai } from "@/src/lib/vercelAI-model-switcher";
import { PERPLEXITY_getResponse } from "../agent-tools/perplexity2/perplexity";
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
import { createCustomToolReference, getCustomToolId, isCustomToolReference } from "../agent-tools/tool-registry/custom-tool-ref";

import { 
  toolRequestSchema, 
  AutoGenAgent, 
  AutoGenTeam, 
  AutoGenWorkflowProps,
  autogen_outline_schema,
} from './autogen-types';
import { AgentComponentProps, Team, ContextContainerProps } from "@/src/lib/types";

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
): Promise<AutoGenWorkflowProps> => {
  console.log("!!!TEAM_autogen_create_workflow!!!", {
    processToAutomate,
    readyMadeAgents,
    outlineObjectString,
    modifications,
    outlineApproved,
  });
  let team: Team = {
    name: "",
    objectives: "",
    agents: [],
    contextSets: [],
  };
  let memoryNotes: string[] = [];
  try {
    if (!modifications || modifications.length === 0) {
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

      if (outlineObject?.orchestrationType) {
        if ((outlineObject?.orchestrationType as string).includes("auto")) {
          outlineObject.orchestrationType = OrchestrationType2.MANAGER_DIRECTED_WORKFLOW;
        }
        if ((outlineObject?.orchestrationType as string).includes("sequential")) {
          outlineObject.orchestrationType = OrchestrationType2.SEQUENTIAL_WORKFLOW;
        }
        if ((outlineObject?.orchestrationType as string).includes("random")) {
          outlineObject.orchestrationType = OrchestrationType2.RANDOM_WORKFLOW;
        }
        if ((outlineObject?.orchestrationType as string).includes("reverse")) {
          outlineObject.orchestrationType = OrchestrationType2.REVERSE_WORKFLOW;
        }
        if ((outlineObject?.orchestrationType as string).includes("llm")) {
          outlineObject.orchestrationType = OrchestrationType2.LLM_ROUTED_WORKFLOW;
        }
      }
      console.log("!!!outlineObject!!!", outlineObject);

      team.orchestrationType = outlineObject?.orchestrationType ?? OrchestrationType2.SEQUENTIAL_WORKFLOW;
      
      team.agents =
        outlineObject?.agentSequence.map((agentName) => {
          const existingAgent = readyMadeAgents.find(
            (a) => a.name === agentName
          );
          if (existingAgent) {
            return existingAgent;
          }

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
            
            team.agents = team.agents.map((a) => a.name === newAgent.name ? agent as AgentComponentProps : a); 
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (error) {
            console.error(`Error creating agent ${newAgent.name}:`, error);
          }
        }
      }

      const modelAssignments = await TEAM_autogen_assign_models(
        outlineObject?.newAgents ?? [],
        (
          AUTOGEN_getModelList("array") as { provider: string; modelName: string }[]
        ).map((model) => ({
          provider: model.provider.toUpperCase(),
          modelName: model.modelName,
        }))
      );
      if (modelAssignments) {
        const processedAgents = new Set<string>();
        const uniqueAssignments = modelAssignments.filter(assignment => {
          if (processedAgents.has(assignment.agentName)) {
            return false;
          }
          processedAgents.add(assignment.agentName);
          return true;
        });

        for (const assignment of uniqueAssignments) {
          const agent = team.agents.find(
            (a) => a.name === assignment.agentName
          );
          if (agent) {
            const provider = assignment.provider.toUpperCase();
            
            const isGoogleProvider = provider.includes('GOOGLE') || provider.startsWith('G-');
            const finalProvider = isGoogleProvider ? "GOOGLE_G" : provider;
            
            const modelArgs = {
              ...UTILS_getModelArgsByName(assignment.modelName),
              provider: finalProvider as ModelProviderEnum
            };
            agent.modelArgs = modelArgs;
          }
        }
      }
      const context: ContextContainerProps[] = [];
      
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
        id: `process-guidelines-${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      context.push(processGuidelinesContext);
      
      console.log("Created Process Guidelines context:", {
        contextName: processGuidelinesContext.setName,
        contextLength: processGuidelinesContext.text.length,
        contextFirstLine: processGuidelinesContext.text.split('\n')[0],
        hiddenFromCount: processGuidelinesContext.hiddenFromAgents?.length || 0,
        teamContextSets: team.contextSets?.length || 0
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
      
      console.log("Returning workflow with team and context:", {
        teamName: team.name,
        teamObjective: team.objectives,
        agentCount: team.agents.length,
        contextSetsCount: team.contextSets?.length || 0,
        returnedContextSetsCount: context.length
      });
      
      team.agents = team.agents.map(agent => {
        if (agent.modelArgs && 
            (String(agent.modelArgs.provider).toUpperCase().includes('GOOGLE') || 
             String(agent.modelArgs.provider).toUpperCase().startsWith('G-'))) {
          console.log(`Converting provider from ${agent.modelArgs.provider} to GOOGLE_G for agent ${agent.name}`);
          return {
            ...agent,
            modelArgs: {
              ...agent.modelArgs,
              provider: "GOOGLE_G" as ModelProviderEnum
            }
          };
        }
        return agent;
      });
      
      console.log("FINAL TEAM DETAILS BEFORE RETURN:", {
        name: team.name,
        objectives: team.objectives,
        agentCount: team.agents.length,
        orchestrationType: team.orchestrationType,
        contextSets: {
          count: team.contextSets?.length || 0,
          names: team.contextSets?.map(cs => cs.setName) ?? [],
          contentSizes: team.contextSets?.map(cs => cs.text?.length || 0) ?? []
        },
        agentNames: team.agents.map(a => a.name)
      });
      
      let requiredCredentialsSet = new Set<string>();
      if (team.agents && team.agents.length > 0) {
        for (const agent of team.agents) {
          if (agent.tools && agent.tools.length > 0) {
            for (const toolRef of agent.tools) {
              if (typeof toolRef === 'string' && isCustomToolReference(toolRef)) {
                try {
                  const toolId = getCustomToolId(toolRef);
                  const toolDefinition = await ToolRegistry.getToolById(toolId);
                  if (toolDefinition?.requiredCredentialNames && Array.isArray(toolDefinition.requiredCredentialNames) && toolDefinition.requiredCredentialNames.length > 0) {
                    toolDefinition.requiredCredentialNames.forEach(name => {
                      if (name && typeof name === 'string') {
                        requiredCredentialsSet.add(name);
                      }
                    });
                  }
                } catch (toolError) {
                  logger.error(`Error fetching tool definition during credential check: ${toolRef}`, { toolError });
                }
              }
            }
          }
        }
      }
      const requiredCredentialsArray = Array.from(requiredCredentialsSet);
      if (requiredCredentialsArray.length > 0) {
        logger.info("Identified required credentials for auto-generated team", { requiredCredentialsArray });
      }
      
      return {
        processToAutomate,
        readyMadeAgents,
        outlineObjectString: outlineObjectString,
        outlineApproved: outlineApproved,
        orchestrationType: team.orchestrationType,
        resultTeam: team,
        resultContext: team.contextSets ?? [],
        requiredCredentials: requiredCredentialsArray,
      } as AutoGenWorkflowProps;
    }

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
  const _outlinePrompt = await PROMPT_AUTO_GENERATE_WORKFLOW.outlinePrompt(
    processToAutomate,
    availableAgents,
    outlineObject,
    modifications,
    memoryNotes,
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
  type NewAgentSchemaType = z.infer<typeof newAgentSchema>;

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

  if (agentProperties.object) {
    const agentData = agentProperties.object as NewAgentSchemaType;

    const _automaticPromptBuilderInstructions = AGENT_AUTO_PROMPT({
      index: 0,
      isDirective: false,
      role: agentData.roleDescription,
      title: agentData.title,
      promptSuggestions: `Here are the steps for the agent to follow for successfull task completion: ${agentData.process.join(
        "\n"
      )}`,
      teamObjective: teamObjective,
      name: agentData.name,
    });
    const promptForNewAgent = await generateText({
      model: await MODEL_getModel_ai(
        UTILS_getModelArgsByName("claude-3-5-sonnet-20240620", 0.5)
      ),
      prompt: _automaticPromptBuilderInstructions,
      temperature: 0.5,
    });

    let agentTools: string[] = [];
    
    if (agentData.type === AgentTypeEnum.TOOL_OPERATOR) {
      agentTools = (agentData.tools || [])
        .map((toolName: any) => {
          if (Object.values(AI_Agent_Tools).includes(toolName as AI_Agent_Tools)) {
            return toolName;
          }
          const matchingEnum = Object.values(AI_Agent_Tools).find(
            enumVal => enumVal.toLowerCase() === toolName.toLowerCase()
          );
          return matchingEnum || toolName;
        });
    }

    if (
      agentData.toolRequests &&
      agentData.toolRequests.length > 0
    ) {
      try {
        const toolRequestPromises = agentData.toolRequests.map(
          async (toolRequest: any) => {
            const unifiedRequest = {
              name: toolRequest.toolName,
              description: toolRequest.toolDescription,
              inputs: toolRequest.suggestedInputs.map((input: any) => ({
                name: input,
                type: "string" as const,
                description: `Input: ${input}`,
                required: true,
              })),
              expectedOutput: toolRequest.suggestedOutputs.join(", "),
            } as ToolRequest;

            const existingTool = await ToolRegistry.findToolByName(toolRequest.toolName, userId);
            let toolRef = '';
            let isReused = false;
            
            if (existingTool) {
              toolRef = createCustomToolReference(existingTool.id);
              isReused = true;
              logger.tool("Using existing custom tool", {
                toolId: existingTool.id,
                toolName: existingTool.name,
                agent: agentData.name
              });
            } else {
              const defaultModelArgs: ModelArgs = {
                  provider: ModelProviderEnum.OPENAI,
                  modelName: "openai:gpt-4o",
                  temperature: 0.7                 
              };
              const toolDef = await CORE_generateCustomToolDefinition(
                unifiedRequest as ToolRequest,
                defaultModelArgs
              );
              
              toolRef = await ToolRegistry.registerTool(
                userId,
                toolDef.name,
                toolDef.description,
                toolDef.inputs,
                toolDef.implementation || "",
                "function",
                {
                  agentId: agentData.name,
                  userId: userId,
                  source: "autogen",
                  createdAt: new Date().toISOString()
                }
              );
            }
            
            if (!agentTools.includes(toolRef)) {
              agentTools.push(toolRef);
            }
            
            return {
              toolId: toolRef.split(':')[1],
              toolRef,
              name: toolRequest.toolName,
              reused: isReused
            };
          }
        );

        const registeredTools = await Promise.all(toolRequestPromises);
        
        const newTools = registeredTools.filter((t: any) => !t.reused);
        const reusedTools = registeredTools.filter((t: any) => t.reused);
        
        logger.tool("Created/Reused Custom Tools", {
          count: registeredTools.length,
          newCount: newTools.length,
          reusedCount: reusedTools.length,
          agent: agentData.name,
          toolReferences: registeredTools.map((t: any) => t.toolRef),
          toolNames: registeredTools.map((t: any) => t.name)
        });

        console.log(
          `DEBUG: Tools for ${agentData.name}: ` +
          registeredTools.map((t: any) => `${t.name}${t.reused ? ' (reused)' : ' (new)'}`).join(', ')
        );
        console.log(
          `SUMMARY: ${registeredTools.length} total tools - Created ${newTools.length} new, reused ${reusedTools.length} existing.`
        );
      } catch (error) {
        logger.error("Error creating custom tools", {
          error: error instanceof Error ? error.message : "Unknown error",
          agent: agentData.name,
        });
      }
    }

    result = {
      name: agentData.name,
      roleDescription: agentData.roleDescription,
      title: agentData.title,
      systemPrompt: promptForNewAgent.text,
      type: agentData.type,
      modelArgs: {
        provider: ModelProviderEnum.ANTHROPIC,
        modelName: "claude-3-5-sonnet-20240620",
        temperature: 0.7,
      },
      tools: agentTools,
    } as AgentComponentProps;

    logger.debug("Created agent with tools", {
      agentName: agentData.name,
      toolCount: agentTools.length,
      tools: agentTools,
      standardTools: agentTools.filter(tool => 
        Object.values(AI_Agent_Tools).includes(tool as AI_Agent_Tools)
      ),
      customTools: agentTools.filter(tool => 
        typeof tool === 'string' && tool.startsWith('CUSTOM_TOOL:')
      )
    });

    if (agentData.knowledgeBase) {
      logger.log(`Creating knowledge base for agent ${agentData.name} - this is a highly selective process`);
      
      const responsibilities = await generateObject({
        model: await MODEL_getModel_ai(
          UTILS_getModelArgsByName("claude-3-7-sonnet-20250219")
        ),
        schema: z.object({
          responsibilities: z.array(z.string()).max(3),
        }),
        prompt: PROMPT_AUTO_GENERATE_WORKFLOW.generateResponsibilities(
          agentData.title,
          agentData.roleDescription,
          teamObjective
        ) + "\n\nIMPORTANT: Be extremely focused and selective. Return ONLY the 2-3 most critical responsibilities.",
      });
      
      const limitedResponsibilities = responsibilities.object.responsibilities.slice(0, 3);
      
      logger.debug(`Generated ${limitedResponsibilities.length} responsibilities for knowledge base`, {
        agent: agentData.name,
        responsibilities: limitedResponsibilities
      });
      
      await KB_autoCreate(
        userId,
        agentData.name,
        limitedResponsibilities,
        agentData.title,
        agentData.roleDescription,
        teamObjective
      );
    }
  }

  return (
    result || {
      name: "Dumb Agent",
      roleDescription: "This is a dumb agent",
      title: "Dumb Agent",
      type: "agent",
      modelArgs: {
        provider: ModelProviderEnum.ANTHROPIC,
        modelName: "claude-3-5-sonnet-20240620",
        temperature: 0.7,
      },
      tools: [],
    }
  );
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
          provider: z.string()
            .transform(val => {
              return val === "GOOGLE_G" ? "GOOGLE" : val;
            })
            .pipe(z.enum(Array.from(new Set(Object.keys(UTILS_getModelsJSON()).map(key => key.toUpperCase()))) as [string, ...string[]])),
          modelName: z.string()
            .refine(
              (val) => {
                const validModelNames = (AUTOGEN_getModelList("array") as {provider: string, modelName: string}[])
                  .map(model => model.modelName);
                
                if (validModelNames.includes(val)) {
                  return true;
                }
                
                return validModelNames.some(modelName => 
                  modelName.includes(val) || val.includes(modelName)
                );
              },
              {
                message: "Model name must match or be contained in one of the valid model names",
              }
            )
            .transform(val => {
              const validModelNames = (AUTOGEN_getModelList("array") as {provider: string, modelName: string}[])
                .map(model => model.modelName);
              
              if (validModelNames.includes(val)) {
                return val;
              }
              
              const closestMatch = validModelNames.find(modelName => 
                modelName.includes(val) || val.includes(modelName)
              );
              
              return closestMatch || val;
            }),
        })
      ),
    }),
    prompt: PROMPT_AUTO_GENERATE_WORKFLOW.formatModelResearchOutput(
      modelResearch ?? "",
      modelNames
    ),
    providerOptions: {
      openai: {
        response_format: { type: "json_object" }
      }
    }
  });

  return modelResearchOutput.object.model_assignments;
};

