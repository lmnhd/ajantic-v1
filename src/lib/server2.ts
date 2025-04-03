"use server";

import { db } from "./db";
import {
  AgentComponentProps,
  AgentVoice,
  ContextContainerProps,
  ContextSet,
  Team,
} from "./types";
import { PINECONE_query_docs } from "@/src/app/api/pinecone";

export async function SERVER_saveTeam(
  team: Team,
  contextSets: ContextContainerProps[],
  userId: string,
  allOrOne: "all" | "one"
) {
  try {
    if (allOrOne === "all") {
      // First check if team exists
      const existingTeam = await db.team.findFirst({
        where: { name: team.name, userId: userId },
        include: { agents: true },
      });

      if (existingTeam) {
        // Update existing team
        await db.team.update({
          where: { id: existingTeam.id },
          data: {
            objectives: team.objectives,
            context: {
              create: {
                teamName: team.name,
                sets: {
                  createMany: {
                    data: contextSets.map((set) => ({
                      setName: set.setName,
                      text: set.text || "",
                      lines: JSON.stringify(set.lines),
                    })),
                  },
                },
              },
            },
            agents: {
              // Update or create agents
              upsert: team.agents.map((agent) => ({
                where: {
                  id:
                    existingTeam.agents.find((a) => a.name === agent.name)
                      ?.id || -1,
                },
                create: {
                  name: agent.name,
                  roleDescription: agent.roleDescription,
                  title: agent.title,
                  systemPrompt: agent.systemPrompt,
                  modelName: agent.modelArgs.modelName,
                  modelProvider: agent.modelArgs.provider,
                  temperature: agent.modelArgs.temperature,
                  tools: agent.tools?.map((tool) => tool as string),
                  promptDirectives: agent.promptDirectives || [],
                  disabled: agent.disabled,
                  training: agent.training,
                  type: agent.type,
                  voice: agent.voice,
                  userId: userId,
                },
                update: {
                  roleDescription: agent.roleDescription,
                  title: agent.title,
                  systemPrompt: agent.systemPrompt,
                  modelName: agent.modelArgs.modelName,
                  modelProvider: agent.modelArgs.provider,
                  temperature: agent.modelArgs.temperature,
                  tools: agent.tools?.map((tool) => tool as string),
                  promptDirectives: agent.promptDirectives || [],
                  disabled: agent.disabled,
                  training: agent.training,
                  type: agent.type,
                  voice: agent.voice,
                  userId: userId,
                },
              })),
            },
          },
        });
      } else {
        // Create new team
        await db.team.create({
          data: {
            name: team.name,
            objectives: team.objectives,
            userId: userId,

            agents: {
              createMany: {
                data: team.agents.map((agent) => ({
                  name: agent.name,
                  roleDescription: agent.roleDescription,
                  title: agent.title,
                  systemPrompt: agent.systemPrompt,
                  modelName: agent.modelArgs.modelName,
                  modelProvider: agent.modelArgs.provider,
                  temperature: agent.modelArgs.temperature,
                  tools: agent.tools?.map((tool) => tool as string),
                  promptDirectives: agent.promptDirectives || [],
                  disabled: agent.disabled,
                  training: agent.training,
                  type: agent.type,
                  voice: agent.voice,
                  userId: userId,
                })),
              },
            },
          },
        });
      }
    } else {
      // Update or creat one agent
      const existingAgent = await db.agentComponent.findFirst({
        where: { name: team.agents[0].name, userId: userId },
        include: { team: true },
      });
      if (existingAgent) {
        await db.agentComponent.update({
          where: { id: existingAgent.id },
          data: {
            roleDescription: team.agents[0].roleDescription,
            title: team.agents[0].title,
            systemPrompt: team.agents[0].systemPrompt,
            modelName: team.agents[0].modelArgs.modelName,
            modelProvider: team.agents[0].modelArgs.provider,
            temperature: team.agents[0].modelArgs.temperature,
            type: team.agents[0].type,
            voice: team.agents[0].voice,
            tools: team.agents[0].tools?.map((tool) => tool as string),
            promptDirectives: team.agents[0].promptDirectives || [],
            disabled: team.agents[0].disabled,
            training: team.agents[0].training,
            userId: userId,
          },
        });
      } else {
        await db.agentComponent.create({
          data: {
            name: team.agents[0].name,
            roleDescription: team.agents[0].roleDescription,
            title: team.agents[0].title,
            systemPrompt: team.agents[0].systemPrompt,
            modelName: team.agents[0].modelArgs.modelName,
            modelProvider: team.agents[0].modelArgs.provider,
            temperature: team.agents[0].modelArgs.temperature,
            type: team.agents[0].type,
            voice: team.agents[0].voice,
            tools: team.agents[0].tools?.map((tool) => tool as string),
            promptDirectives: team.agents[0].promptDirectives || [],
            disabled: team.agents[0].disabled,
            training: team.agents[0].training,
            userId: userId,
          },
        });
      }
    }
  } catch (error) {
    console.error(`Error storing or updating team ${team.name}:`, error);
    throw error;
  }
}

export async function SERVER_getTeam(teamId: number) {
  const team = await db.team.findUnique({
    where: { id: teamId },
    include: { agents: true, context: { include: { sets: true } } },
  });

  return {
    name: team?.name,
    agents:
      team?.agents.map((agent) => ({
        name: agent.name,
        roleDescription: agent.roleDescription,
        title: agent.title,
        systemPrompt: agent.systemPrompt || undefined,
        modelArgs: {
          modelName: agent.modelName,
          provider: agent.modelProvider,
          temperature: agent.temperature,
        },
        tools: agent.tools,
        promptDirectives: agent.promptDirectives,
        disabled: agent.disabled,
        training: agent.training,
        type: agent.type,
        voice: agent.voice as AgentVoice | undefined,
      })) || [],
    objectives: team?.objectives || "",
    context:
      team?.context?.sets.map((set) => ({
        setName: set.setName,
        text: set.text,
        lines: JSON.parse(set.lines),
        isDisabled: false,
      })) || [],
  } as Team;
}

export async function SERVER_getAgent(agentId: number) {
  const agent = await db.agentComponent.findUnique({
    where: { id: agentId },
  });
  return {
    name: agent?.name,
    roleDescription: agent?.roleDescription,
    title: agent?.title,
    systemPrompt: agent?.systemPrompt,
    modelArgs: {
      modelName: agent?.modelName,
      provider: agent?.modelProvider,
      temperature: agent?.temperature,
    },
    tools: agent?.tools,
    promptDirectives: agent?.promptDirectives,
    disabled: agent?.disabled,
    training: agent?.training,
    type: agent?.type,
    voice: agent?.voice,
  } as AgentComponentProps;
}

export async function SERVER_deleteTeam(
  teamId: number,
  includeAgents: boolean
) {
  try {
    if (includeAgents) {
      await db.agentComponent.deleteMany({ where: { teamId: teamId } });
    }
    await db.team.delete({ where: { id: teamId } });
    return true;
  } catch (error) {
    console.error(`Error deleting team ${teamId}:`, error);
    return false;
  }
}

export async function SERVER_getAllTeams(userId: string) {
  const teams = await db.team.findMany({
    where: { userId: userId },
    select: {
      id: true,
      name: true,
      objectives: true,
      agents: false,
    },
  });
  return teams;
}

export async function SERVER_getAllAgents(userId: string) {
  const agents = await db.agentComponent.findMany({
    where: { userId: userId },
    select: { id: true, name: true },
  });
  return agents;
}

export const SERVER_getAgentsAndTeams = async (userId: string) => {
  const agents = await db.agentComponent.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      roleDescription: true,
      title: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  const teams = await db.team.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      objectives: true,
    },
    orderBy: {
      id: "desc",
    },
  });

  return {
    agents,
    teams,
  };
};

export async function SERVER_kbQuery(
  query: string,
  userId: string,
  agentName: string,
  teamName: string
): Promise<string> {
  try {
    const namespace = `agent-kb-${userId}-${agentName}`;
    const results = await PINECONE_query_docs(query, namespace);

    if (!results || !Array.isArray(results)) {
      return "";
    }

    // Format the results into a readable string
    return results
      .map((result) => {
        if (result.metadata?.source) {
          return `[Source: ${result.metadata.source}]\n${result.pageContent}`;
        }
        return result.pageContent;
      })
      .join("\n\n");
  } catch (error) {
    console.error("Error in SERVER_kbQuery:", error);
    return "";
  }
}

export const SERVER_getSavedContextSets = async (userId: string) => {
  const contextSets = await db.contextSet.findMany({
    where: { userId },
    select: {
      id: true,
      teamName: true,
     sets:false
    },
  });
  return contextSets.reverse().map(set => ({
    id: set.id,
    teamName: set.teamName
  }));
};

export const SERVER_getSavedContextSet = async (id: number) => {
  const contextSet = await db.contextSet.findUnique({ where: { id } });
  if (contextSet) {
    const sets = await db.contextContainerProps.findMany({
      where: { contextSetId: id },
    });
    const finalSet = {
      teamName: contextSet.teamName,
      sets: sets.map(
        (set) =>
          ({
            setName: set.setName,
            lines: JSON.parse(set.lines),
            text: set.text,
            formSchema: set.formSchema ? JSON.parse(set.formSchema) : null,
            isDisabled: set.isDisabled,
            hiddenFromAgents: set.hiddenFromAgents,
          } as ContextContainerProps)
      ),
    } as ContextSet;
    return finalSet;
  }

  return null;
};

export const SERVER_saveContextSet = async (
  contextSet: ContextSet,
  userId: string,
  teamName?: string
) => {
  const _contextSet = await db.contextSet.create({
    data: {
      teamName: teamName || contextSet.teamName,
      userId: userId,
      sets: {
        createMany: {
          data: contextSet.sets.map((set) => ({
            setName: set.setName,
            lines: JSON.stringify(set.lines),
            text: set.text || "",
            formSchema: set.formSchema ? JSON.stringify(set.formSchema) : null,
            isDisabled: set.isDisabled,
            hiddenFromAgents: set.hiddenFromAgents,
          })),
        },
      },
    },
  });
  return _contextSet;
};

export const SERVER_deleteSavedContextSet = async (id: number) => {
  await db.contextSet.delete({ where: { id } });
  return true;
};

export const SERVER_deleteMultipleContextSets = async (ids: number[]) => {
  await db.contextSet.deleteMany({ where: { id: { in: ids } } });
  return true;
};
