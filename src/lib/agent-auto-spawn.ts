"use server";

import {
  AgentComponentProps,
  AgentVoiceProviderEnum,
  AISessionState,
  ModelArgs,
  ModelProviderEnum,
} from "@/src/lib/types";
import { generateObject, generateText } from "ai";
import { revalidatePath } from "next/cache";
import { MODEL_getModel_ai } from "./vercelAI-model-switcher";
import { AGENT_AUTO_SPAWN_PROMPT } from "@/src/lib/prompts/agent-auto-spawn";
import { z } from "zod";
import { WhisperVoicesEnum } from "@/src/lib/speech/voices-types";
import { AGENT_AUTO_PROMPT } from "@/src/lib/prompts/auto-prompt";
import { UTILS_getGenericData, UTILS_getModelArgsByName, UTILS_getModelsJSON } from "@/src/lib/utils";
import { logger } from "@/src/lib/logger";

export async function AGENT_AUTO_SPAWN(
  _shortDescription: string,
  state: AISessionState
): Promise<{
  agent: AgentComponentProps | null;
  message: string;
  success: boolean;
}> {
  const _agent: AgentComponentProps = {
    type: "agent",
    modelArgs: {
      modelName: "claude-3-5-sonnet-20240620",
      provider: ModelProviderEnum.ANTHROPIC,
      temperature: 0.5,
    },
    name: "",
    roleDescription: "",
    title: "",
    systemPrompt: _shortDescription,
    voice: {
      provider: AgentVoiceProviderEnum.OPENAI,
      nameOrVoiceID: WhisperVoicesEnum.nova,
    },
  };
  console.log(
    "AGENT_AUTO_SPAWN_PROMPT: ",
    AGENT_AUTO_SPAWN_PROMPT(_shortDescription, _getPeerAgentNames(state))
  );

  logger.prompt(
    "AGENT_AUTO_SPAWN_PROMPT: " +
      AGENT_AUTO_SPAWN_PROMPT(_shortDescription, _getPeerAgentNames(state)),
    {
      agent: _agent,
      shortDescription: _shortDescription,
      peerAgentNames: _getPeerAgentNames(state),
    }
  );

  const agentBaseValues = await generateObject({
    model: await MODEL_getModel_ai({
      modelName: UTILS_getModelsJSON().Anthropic["claude-3-7-sonnet-20250219"].name,
      provider: ModelProviderEnum.ANTHROPIC,
      temperature: 0.5,
    }),
    prompt: AGENT_AUTO_SPAWN_PROMPT(
      _shortDescription,
      _getPeerAgentNames(state)
    ),
    temperature: 0.5,
    schema: z.object({
      name: z.string().describe("Be creative!"),
      title: z.string(),
      roleDescription: z
        .string()
        .describe(
          "A clear description of the agent's purpose (maximum 2 sentences)"
        ),
      promptSuggestion: z
        .string()
        .describe(
          "IMPORTANT: A detailed prompt template that will help guide the agent's behavior"
        ),
    }),
    providerOptions: {
      anthropic: {
        thinking: { type: "enabled", budgetTokens: 12000 },
      },
    },
  });

  if (!agentBaseValues.object || !agentBaseValues.object.name || !agentBaseValues.object.title || !agentBaseValues.object.roleDescription) {
    logger.error("Failed to generate agent base values", {
      error: agentBaseValues.object,
    });
    return {
      success: false,
      message: "Failed to generate agent base values",
      agent: null,
    };
  }

  console.log("AGENT_BASE_VALUES: ", agentBaseValues);
  logger.log("AGENT_BASE_VALUES: ", agentBaseValues);

  function _createAgentAutoPromptParams(
    agentBaseValues: { object: { roleDescription: string; title: string; name: string; promptSuggestion: string } },
    teamObjective?: string,
    isDirective: boolean = false,
    index: number = 0
  ) {
    return {
      role: agentBaseValues.object.roleDescription,
      title: agentBaseValues.object.title,
      name: agentBaseValues.object.name,
      promptSuggestions: agentBaseValues.object.promptSuggestion,
      teamObjective,
      isDirective,
      index,
    };
  }

  function _logAgentAutoPrompt(params: ReturnType<typeof _createAgentAutoPromptParams>, agent: AgentComponentProps) {
    const promptText = AGENT_AUTO_PROMPT(params);
    console.log("AGENT_AUTO_PROMPT: ", promptText);
    logger.prompt("AGENT_AUTO_PROMPT: " + promptText, {
      agent,
      ...params,
    });
    return promptText;
  }

  const autoPromptModel = 
  {
    provider: ModelProviderEnum.ANTHROPIC,
    modelName: UTILS_getModelsJSON().Anthropic["claude-3-5-sonnet-20240620"].name,
    temperature: 0.5,
  };

  console.log("autoPromptModel: ", autoPromptModel);

  const promptParams = _createAgentAutoPromptParams(agentBaseValues);
  const promptText = _logAgentAutoPrompt(promptParams, _agent);

  const agentPrompt = await generateText({
    model: await MODEL_getModel_ai(UTILS_getModelArgsByName(UTILS_getModelsJSON().OpenAI["gpt-4o-mini"].name, 0.5)),
    prompt: promptText,
    temperature: 0.5,
  });

  if (!agentPrompt.response) {
    logger.error("Failed to generate agent prompt", {
      error: agentPrompt.response,
    });
    return {
      success: false,
      message: "Failed to generate agent prompt",
      agent: null,
    };
  }

  _agent.name = agentBaseValues.object.name;
  _agent.title = agentBaseValues.object.title;
  _agent.roleDescription = agentBaseValues.object.roleDescription;
  _agent.systemPrompt = agentPrompt.text;

  logger.log("AGENT_AUTO_SPAWN_FINISHED: ", {
    newAgent: _agent,
  });

  return {
    success: true,
    message: "Agent auto spawned",
    agent: _agent,
  };
}

function _getPeerAgentNames(state: AISessionState): string {
  return state.currentAgents.agents.map((a) => `<name>${a.name}</name>
  <role>${a.roleDescription}</role>
  <title>${a.title}</title>
  `).join("\n");
}

//This agent will compare presented lyric lines to an established 'STYLE REFERENCE' and judge whether or not they make the cut! pass the bar! make the grade! etc...

//This agent will be named 'Story Line Extractor' and she will take a given title and brilliantly extract an arbitrary and unusual story as the back story for a lyricist to write from - should look for double entandras and word play devices within the title
