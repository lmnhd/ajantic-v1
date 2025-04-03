// "use server";

import { AgentComponentProps, AgentType, AgentTypeEnum, ModelProviderEnum } from "@/src/lib/types";
import { logger } from "@/src/lib/logger";

/**
 * Configuration for the automatic agent spawning system
 */
export const AGENT_AUTO_SPAWN_PROMPT = {
  system_prompt: `You are an AI TeamBuilder specializing in creating multi-agent teams.
Your task is to recommend a new AI agent to add to an existing team based on the team's objectives and current composition.
You should suggest agents that would add value by filling gaps in the team's capabilities or bringing a unique perspective.

When recommending an agent, provide:
1. A concise, descriptive name
2. A professional title
3. A detailed role description
4. A specialized system prompt that defines the agent's behavior, capabilities, and communication style

Your recommendations should be thoughtful, focusing on how the new agent complements the existing team.`,

  human_prompt: `Please recommend a new AI agent to add to our team with the following details:

Team Objective: {{teamObjective}}

Current Team Composition:
{{existingAgents}}

We need a new agent that will complement our current team by filling capability gaps or bringing a unique perspective.
The agent should clearly contribute to achieving our team objective.

Please provide the following details for the recommended agent:
1. Name: A concise, descriptive name
2. Title: A professional title
3. Role Description: A detailed explanation of the agent's purpose and responsibilities
4. System Prompt: A specialized prompt that defines the agent's behavior, capabilities, and communication style`,

  /**
   * Get a default agent with basic configuration
   */
  getDefaultAgent: (options: {
    name: string;
    title: string;
    type: AgentTypeEnum;
    roleDescription: string;
    systemPrompt?: string;
  }): AgentComponentProps => {
    logger.debug("Auto-Spawn - Creating default agent", {
      name: options.name,
      type: options.type
    });
    
    return {
      name: options.name,
      title: options.title,
      type: options.type as AgentType,
      roleDescription: options.roleDescription,
      systemPrompt: options.systemPrompt || `You are ${options.name}, a helpful AI assistant with the role of ${options.roleDescription}.`,
      modelArgs: {
        provider: ModelProviderEnum.OPENAI,
        modelName: "gpt-4",
        temperature: 0.7
      },
      tools: []
    };
  },
  
  /**
   * Auto-generate an agent based on the team objective and existing agents
   */
  generateAgent: async (objective: string, existingAgents: AgentComponentProps[]): Promise<AgentComponentProps | null> => {
    try {
      logger.debug("Auto-Spawn - Generating agent based on objective", { objective });
      
      // In a full implementation, this would call an AI model to generate a more specialized agent
      // For now, we just return a basic agent with a name not already used
      
      const existingNames = existingAgents.map(agent => agent.name);
      let newAgentNumber = 1;
      
      // Find an unused agent number
      while (existingNames.includes(`Agent ${newAgentNumber}`)) {
        newAgentNumber++;
      }
      
      return AGENT_AUTO_SPAWN_PROMPT.getDefaultAgent({
        name: `Agent ${newAgentNumber}`,
        title: "Auto-generated Assistant",
        type: AgentTypeEnum.AGENT,
        roleDescription: `An auto-generated assistant to help with the team objective: ${objective}`,
      });
    } catch (error) {
      logger.error("Auto-Spawn - Failed to generate agent", {
        objective,
        error: error instanceof Error ? error.message : "Unknown error"
      });
      
      return null;
    }
  }
}; 