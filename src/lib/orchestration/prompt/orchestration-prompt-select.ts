
import { AgentTypeEnum } from "../../types";
import { OrchestrationType2 } from "../types";
import { OrchestrationPromptContext } from "../types/prompt";
import { ORCHESTRATION_PROMPTS } from "./orchestration-prompt";

export const ORCHESTRATION_PROMPT_SELECT = async (prompt_context:OrchestrationPromptContext, queryForSemanticSearch: string) => {
    const { orchestrationType, currentAgent, allAgents, teamName, userId, initialMessage, teamObjective, currentTaskMessage, currentRound, currentCycleStep, currentHistorySnapshot, currentContextSets } = prompt_context;
    
    let prompt = "";

    switch (orchestrationType) {
        case OrchestrationType2.LLM_ROUTED_WORKFLOW:
            if (currentAgent.type === AgentTypeEnum.MANAGER) {
                prompt = await ORCHESTRATION_PROMPTS.autoManager_prompt(prompt_context, currentContextSets, queryForSemanticSearch);
            } else {
                prompt = await ORCHESTRATION_PROMPTS.autoProcess_prompt(prompt_context, currentContextSets, queryForSemanticSearch);
            }
            break;
        case OrchestrationType2.MANAGER_DIRECTED_WORKFLOW:
            if (currentAgent.type === AgentTypeEnum.MANAGER) {
                prompt = await ORCHESTRATION_PROMPTS.autoManager_prompt(prompt_context, currentContextSets, queryForSemanticSearch);
            } else {
                prompt = await ORCHESTRATION_PROMPTS.autoProcess_prompt(prompt_context, currentContextSets, queryForSemanticSearch);
            }
           
            break;
        case OrchestrationType2.SEQUENTIAL_WORKFLOW:
            prompt = await ORCHESTRATION_PROMPTS.standard_prompt(prompt_context, currentContextSets, queryForSemanticSearch);
            break;
        case OrchestrationType2.DIRECT_AGENT_INTERACTION:
            prompt = await ORCHESTRATION_PROMPTS.standard_prompt(prompt_context, currentContextSets, queryForSemanticSearch);
            break;
        default:
            prompt = await ORCHESTRATION_PROMPTS.standard_prompt(prompt_context, currentContextSets, queryForSemanticSearch);
            break;
    }

    return prompt;
    
}
