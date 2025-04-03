export const DYNAMIC_NAMES: {
    namespace_generic: (userId: string, nameSpace: string) => string;
    db_client_info: (agentName: string, userId: string) => string;
    semantic_knowledge_base: (userId: string) => string;
    agent_state: (userId: string) => string;
    indexdb_global_state: (userId: string) => string;
    service_tokens: (userId: string, platform: string) => string;
    agent_tools_process_notes: (platform: string) => string;
} = {
    namespace_generic: (userId: string, nameSpace: string) => `generic-${userId}-${nameSpace}`,
    db_client_info: (agentName: string, userId: string) => `client-info-${userId}-agent-${agentName}`,
    semantic_knowledge_base: (userId: string) => `KnowledgeBase-${userId}`,
    agent_state: (userId: string) => `AgentState-${userId}`,
    indexdb_global_state: (userId: string) => `M_STATE-${userId}`,
    service_tokens: (userId: string, platform: string) => `oauth::${platform.toLowerCase()}::${userId}`,
    agent_tools_process_notes: (platform: string) => `agent_tools_process_notes-${platform.trim().toLowerCase()}`
}
