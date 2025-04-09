import { AgentComponentProps, AgentFoundationalPromptProps, ContextContainerProps } from "../../types";
import { UTILS_convertLineSetsToContext } from "../../utils";
import { OrchestrationConfig } from "../types";

export const ORCH_LEGACY_UTILS_convertToFoundationalProps = (agent: AgentComponentProps, config: OrchestrationConfig, contextSets: ContextContainerProps[], teamObjective: string) => {
    return {
        agentType: agent.type,
        context: UTILS_convertLineSetsToContext(contextSets, agent.name),
        directives: [],
        mission: teamObjective,
       peerAgents: config.agents.filter(a => a.name !== agent.name),
       role: agent.roleDescription,
       skillSet: agent.systemPrompt,
       teamName: config.teamName,
       thisAgentName: agent.name,
       tools: agent.tools,
       trainingMode: false,
       userId: config.userId,
       userName: '',
       allowedContacts: agent.allowedContacts,
       customTools: []
        
        
    } as AgentFoundationalPromptProps
}