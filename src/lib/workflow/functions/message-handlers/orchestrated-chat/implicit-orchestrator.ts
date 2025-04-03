"use server";

import {
  AgentComponentProps,
  ContextContainerProps,
  AISessionState,
  ModelProviderEnum,
  ServerMessage,
  ModelArgs,
  AgentTypeEnum,
  OrchestrationProps,
} from "@/src/lib/types";
import { generateObject } from "ai";

import { OpenAIModelNames } from "@/src/app/api/model/openai";
import { z } from "zod";
import { basicAgentChat } from "../../../../agent-channels";
import { BasicAgentChatProps } from "../orchestrated-chat";
import { logger } from "@/src/lib/logger";
import { UTILS_isToolAgent, UTILS_getModelArgsByName, UTILS_getModelsJSON } from "@/src/lib/utils";
import { MODEL_getModel_ai } from "../../../../vercelAI-model-switcher";

export interface ImplicitOrchestratorResult {
  redirect: boolean;
  analysis?: string;
  newAgentSequence?: string[];
}

export const implicitOrchestratorAnalyze = async (
  currentMessage: string,
  currentConversation: ServerMessage[],
  currentAgent: string,
  allAgents: AgentComponentProps[],
  agentsBeforeThisMessage: string[],
  agentRemainingSequence: string[],
  analysisModelArgs?: ModelArgs
  //basicAgentChatProps: BasicAgentChatProps
) => {
  if (!analysisModelArgs) {
    analysisModelArgs = UTILS_getModelArgsByName(
      UTILS_getModelsJSON().OpenAI["gpt-4o-mini"].name, 
      0
    );
  }
  // Here we will run the 'implicit-orchestrator' to redirect to a different agent if needed - then continue as normal
  const _prompt = `
<task>
  Determine if the current message would be better handled by a different agent.
</task>

<context>
  <current-agent>${currentAgent}</current-agent>
  <agent-count>${allAgents.length}</agent-count>
  <agents-before-this-message>${agentsBeforeThisMessage.join(",")}</agents-before-this-message>
  <remaining-agent-sequence>${agentRemainingSequence.join(",")}</remaining-agent-sequence>
</context>

<all-available-agents>
  ${allAgents
    .map(
      (agent) => `
  <agent>
    <name>${agent.name}</name>
    <type>${agent.type}</type>
    <tool-or-task-agent>${UTILS_isToolAgent(agent.type as AgentTypeEnum) ? "tool" : "task"}</tool-or-task-agent>
    <title>${agent.title}</title>
    <description>${agent.roleDescription}</description>
  </agent>`
    )
    .join("")}
</all-available-agents>

<current-message>${currentMessage}</current-message>

<conversation-history>
  ${currentConversation
    .map((msg) => `<message from="${msg.agentName}">${msg.content}</message>`)
    .join("")}
</conversation-history>

<instructions>
  1. Check if the message directly addresses a specific agent by name
  2. Check if the message requests a specific task that requires a specialized tool that another agent has access to
  3. Return true if redirection is warranted, otherwise return false
  4. If true, provide a reordered sequence of ALL the remaining agents in the conversation, starting with the agent that should handle the current message, back to the agent that wrote the current message, followed be the remaining agents in the original sequence
  5. If an agent ends their message with a clarification that presumes they are not finished with their task, you need to re-add them to the sequence for them to continue their work
  6. Default to continuing with ${currentAgent} unless redirection is clearly warranted
  7. If redirecting to a tool agent, ensure the last (who wrote this message) agent is revisited immediately after the tool agent to continue its work
</instructions>

<rules>
- Agents used before this message can be used only once again going forward
- You may add agents that are not in the original sequence if they are specifically requested by name or by required tool
- When redirecting to a tool agent (like DataAnalystAgent, ResearchAgent, or any agent that handles specific tasks), immediately add the agent that wrote the message back into the sequence after the tool agent so it can continue where it left off
- Do not redirect just because another agent might be "better suited" - only redirect for explicit requests
</rules>

<output-true>
 You are to provide a reordered sequence of the remaining agents in the conversation, starting with the agent that should handle the current message.
</output-true>

<output-false>
  No action is needed.
</output-false>

<example>
  <scenario>
    <agents-before-this-message>ResearchAgent,DataAnalystAgent</agents-before-this-message>
    <current-agent>CodeExpertAgent</current-agent>
    <remaining-agent-sequence>CodeExpertAgent,UXDesignerAgent,ProjectManagerAgent</remaining-agent-sequence>
    <current-message>I need more information about the research methodology we discussed earlier.</current-message>
  </scenario>
  <analysis>
    The current message does not explicitly request a specific agent by name or mention a specialized tool that another agent has. While it mentions research methodology, it's not clearly requesting a redirect. The current agent should continue handling this query.
  </analysis>
  <output>
    {
      "redirect": false,
      "analysis": "The current message does not explicitly request a specific agent by name or mention a specialized tool that another agent has. While it mentions research methodology, it's not clearly requesting a redirect. The current agent should continue handling this query."
    }
  </output>
</example>

<example>
  <scenario>
    <agents-before-this-message>ResearchAgent,DataAnalystAgent</agents-before-this-message>
    <current-agent>CodeExpertAgent</current-agent>
    <remaining-agent-sequence>CodeExpertAgent,UXDesignerAgent,ProjectManagerAgent</remaining-agent-sequence>
    <current-message>Can you help me implement the algorithm we just discussed?</current-message>
  </scenario>
  <analysis>
    The current message is asking about implementing an algorithm, which is directly relevant to the CodeExpertAgent's expertise. The current agent is the most appropriate one to handle this query.
  </analysis>
  <output>
    {
      "redirect": false,
      "analysis": "The current message is asking about implementing an algorithm, which is directly relevant to the CodeExpertAgent's expertise. The current agent is the most appropriate one to handle this query."
    }
  </output>
</example>

<example>
  <scenario>
    <agents-before-this-message>StartingAgent,ResearchAgent</agents-before-this-message>
    <current-agent>ProjectManagerAgent</current-agent>
    <remaining-agent-sequence>ProjectManagerAgent,UXDesignerAgent,CodeExpertAgent</remaining-agent-sequence>
    <current-message>I'd like the DataAnalystAgent to look at the survey data we collected to see user preferences.</current-message>
  </scenario>
  <analysis>
    The current message explicitly requests the DataAnalystAgent by name. This is a clear case for redirection to the requested agent.
  </analysis>
  <output>
    {
      "redirect": true,
      "analysis": "The current message explicitly requests the DataAnalystAgent by name. This is a clear case for redirection to the requested agent.",
      "newAgentSequence": ["DataAnalystAgent", "ProjectManagerAgent", "UXDesignerAgent", "CodeExpertAgent"]
    }
  </output>
</example>

<example>
  <scenario>
    <agents-before-this-message>StartingAgent,ResearchAgent</agents-before-this-message>
    <current-agent>ProjectManagerAgent</current-agent>
    <remaining-agent-sequence>ProjectManagerAgent,UXDesignerAgent,CodeExpertAgent</remaining-agent-sequence>
    <current-message>Can you use SQL to analyze the user database and tell me how many users signed up last month?</current-message>
  </scenario>
  <analysis>
    The current message explicitly requests SQL analysis of a database, which is a specialized tool that the DataAnalystAgent would have access to. This requires a specific tool redirection.
  </analysis>
  <output>
    {
      "redirect": true,
      "analysis": "The current message explicitly requests SQL analysis of a database, which is a specialized tool that the DataAnalystAgent would have access to. This requires a specific tool redirection.",
      "newAgentSequence": ["DataAnalystAgent", "ProjectManagerAgent", "UXDesignerAgent", "CodeExpertAgent"]
    }
  </output>
</example>
`;
let providerOptions = {}

if (analysisModelArgs.modelName === UTILS_getModelsJSON().Anthropic["claude-3-5-sonnet-20240620"].name) {
    
  providerOptions = {
    anthropic: {
      thinking: { type: "enabled", budgetTokens: 12000 },
    },
  };
}
  const _analysis = await generateObject({
    model: await MODEL_getModel_ai(analysisModelArgs),
    prompt: _prompt,
    schema: z.object({
      redirect: z.boolean(),
      analysis: z.string(),
      newAgentSequence: z.array(z.string()).default(agentRemainingSequence),
    }),
    providerOptions: providerOptions
  });

  logger.log(`Implicit Orchestrator Analysis Redirect Agent: ${_analysis.object.redirect}`, {currentMessage, currentAgent, allAgents, agentsBeforeThisMessage, agentRemainingSequence, ..._analysis.object});

  return _analysis.object;
};




// test question: what is the healthiest fruit to eat in the mornings?
// test question 2: What are some of the best resources for an affiliate marketing business?
// test question 3: what is the best way to learn to code?

