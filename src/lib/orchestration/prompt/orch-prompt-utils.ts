import { generateObject } from "ai";
import { ContextContainerProps, ModelProviderEnum, OrchestrationProps, ServerMessage } from "../../types";
import { MODEL_JSON, UTILS_convertLineSetsToContext, UTILS_getModelArgsByName, UTILS_getModelsJSON } from "../../utils";
import { OrchestrationPromptContext, OrchestrationType2 } from "../types";
import { MODEL_getModel_ai } from "../../vercelAI-model-switcher";
import { AnthropicModelNames } from "@/src/app/api/model/anthropic";
import { OpenAIModelNames } from "@/src/app/api/model/openai";
import { z } from "zod";

export const ORCH_PROMPT_UTILS_OPC_to_props = (opc: OrchestrationPromptContext): OrchestrationProps => {
    const props: OrchestrationProps = {
        currentAgent: opc.currentAgent,
        allAgents: opc.allAgents,
        agentOrder: ORCH_PROMPT_UTILS_devise_agent_order(opc),
        chatMode: opc.orchestrationType === OrchestrationType2.DIRECT_AGENT_INTERACTION ? "agent-orchestrator" : "wf-sequential-1",
        currentCycleStep: opc.currentCycleStep,
        currentRound: opc.currentRound,
        currentStepResponseType: 'initial-thought',
        initialMessage: opc.initialMessage,
        isFinalRoundAndStep: false,
        numAgents: opc.allAgents.length,
        numRounds: opc.numRounds,
        teamObjective: opc.teamObjective,
        autoProps: opc.orchestrationType === OrchestrationType2.LLM_ROUTED_WORKFLOW || opc.orchestrationType === OrchestrationType2.MANAGER_DIRECTED_WORKFLOW ? {
            contextSets: opc.currentContextSets,
            messageHistory: opc.currentHistorySnapshot,
            allAvailableAgents: opc.allAgents,
            currentMessage: opc.currentTaskMessage,
            currentMessageRewritten: "",
            initialMessage: opc.initialMessage,
            messageFrom: opc.messageSource ?? "user",
            result: "continue",
            nextAgent: opc.currentAgent,
            taskCompletionQuery: "",
            summarizeConversation: false
        } : undefined
    }
    return props;
}

export const ORCH_PROMPT_UTILS_devise_agent_order = (opc: OrchestrationPromptContext): "sequential" | "seq-reverse" | "random" | "auto"  => {
    switch (opc.orchestrationType) {
        case OrchestrationType2.LLM_ROUTED_WORKFLOW:
            return "auto";
        case OrchestrationType2.MANAGER_DIRECTED_WORKFLOW:
            return "auto";
        case OrchestrationType2.DIRECT_AGENT_INTERACTION:
            return "sequential";
        case OrchestrationType2.SEQUENTIAL_WORKFLOW:
            return "sequential";
        case OrchestrationType2.REVERSE_WORKFLOW:
            return "seq-reverse";
        case OrchestrationType2.RANDOM_WORKFLOW:
            return "random";
        default:
            return "auto";

    }
}

export const ORCH_PROMPT_UTILS_message_to_semantic_query = async (message: string, history: ServerMessage[], context: ContextContainerProps[], agentName: string) => {

    const _queryPrompt = `
    Your task is to extract the perfect 'query' string for a semantic database search that encompasses all of the relevant information provided in the message, conversation history, and context.
    Your response should be a single string sentence.

    <MESSAGE>
    ${message}
    </MESSAGE>

    <CONVERSATION_HISTORY>
    ${history.map(h => `${h.role}: ${h.content}`).join("\n")}
    </CONVERSATION_HISTORY>

    <CONTEXT>
    ${UTILS_convertLineSetsToContext(context, agentName)}
    </CONTEXT>
    
    `

    const _responsOBJ = await generateObject({
        model: await MODEL_getModel_ai(UTILS_getModelArgsByName(MODEL_JSON().OpenAI["gpt-4o"].name)),
        output: "object",  
        prompt: _queryPrompt,
        schema: z.object({
            query: z.string()
        })
    })

    return _responsOBJ.object.query;
}
