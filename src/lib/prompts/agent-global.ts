import { SERVER_getGeneralPurposeDataMany } from "@/src/lib/server";
import {
  AgentComponentProps,
  AgentType,
  AgentTypeEnum,
  AI_Agent_Tools,
  AI_Agent_ToolsDescription,
  OrchestrationProps,
} from "@/src/lib/types";
import { MEMORY_retrieve } from "../agent-memory/store-retrieve";

import { SERVER_kbQuery } from "@/src/lib/server2";
import { AGENT_TOOLS_DIRECTIVE_GMAIL } from "../agent-tools/gmail";
import { AGENT_TOOLS_DIRECTIVE_OAUTH_PROVIDER } from "./tool-prompt-directives";
import { AGENT_TOOLS_DIRECTIVE_FILE_STORE } from "./tool-prompt-directives";
import { AGENT_TOOLS_DOCUMENT_PARSE_DIRECTIVE } from "../agent-tools/documents-tools/document-parse-tool";
import { AGENT_TOOLS_DYNAMIC_ACTION_getAllCustomScriptsForAgent } from "../agent-tools/dynamic-tool/dynamic-action-core";
import { AGENT_TOOLS_DIRECTIVE_DOCUMENT_PROCESSOR } from "../agent-tools/documents-tools/document-processor";
import { AGENT_TOOLS_DIRECTIVE_KNOWLEDGE_BASE } from "../agent-tools/knowledgebase-tool/kb-tool";
import { AGENT_TOOLS_DIRECTIVE_PERPLEXITY } from "../agent-tools/perplexity2";
import { AGENT_TOOLS_HELPER_getAgentDatabaseAll } from "../agent-tools/database-tool/database-tool_core";
import { AGENT_TOOLS_DIRECTIVE_DATABASE } from "../agent-tools/database-tool/database-tool";
import { AGENT_TOOLS_DIRECTIVE_VIDEO } from "../agent-tools/video-gen/runway-video-tool";
import { UTILS_getAllAvailableToolsDescriptions } from "../utils";

export const AGENT_GLOBAL_PROMPTS = {
  PROMPT_AGENT_foundationalPrompt2: async (
    query: string,
    userName: string,
    userId: string,
    thisAgent: AgentComponentProps,
    teamName: string,
    skillSet: string,
    role: string,
    tools: AI_Agent_Tools[] | string[],
    peerAgents: AgentComponentProps[],
    directives: string[],
    context: string,
    mission: string,
    trainingMode: boolean,
    hasKnowledgeBase: boolean
  ) => `${
    trainingMode
      ? `You are a helpful assistant that can help with a wide range of tasks. Please do exactly as instructed.`
      : `
      <PURPOSE>
    You are an AI assistant working as part of a coordinated team to help ${
      userName.split(" ")[0]
    }.
    Your mission is to: ${mission}
</PURPOSE>

<INSTRUCTIONS>
    <INSTRUCTION>Work with your team to achieve client goals efficiently</INSTRUCTION>
    <INSTRUCTION>Use tools only when needed for specific tasks</INSTRUCTION>
    <INSTRUCTION>Format agent messages as **From AgentName: message**</INSTRUCTION>
    ${
      thisAgent.type === AgentTypeEnum.MANAGER
        ? `
    <INSTRUCTION>Use agentChat to coordinate with other agents</INSTRUCTION>
    <INSTRUCTION>Maintain user conversation while coordinating agents</INSTRUCTION>`
        : ""
    }
    ${directives
      .map(
        (d) => `
<INSTRUCTION>${d}</INSTRUCTION>`
      )
      .join("\n")}
    ${
      _doesTeamHaveContextManager(peerAgents) &&
      thisAgent.type !== AgentTypeEnum.MANAGER
        ? `<INSTRUCTION>For context edits, refer to '${_getTeamContextManagerName(
            peerAgents
          )}'</INSTRUCTION>`
        : ""
    }
</INSTRUCTIONS>

${
  thisAgent.allowedContacts && thisAgent.allowedContacts.length > 0
    ? await _generateAllowedContactsDirective(
        thisAgent.allowedContacts,
        peerAgents
      )
    : ""
}  

<COMMUNICATION-RULES>
    <AGENT-COMMUNICATION>
        <RULE>Communicate only essential task information</RULE>
        <RULE>Avoid discussing internal processes</RULE>
        <RULE>No thinking out loud</RULE>
    </AGENT-COMMUNICATION>
    
    <TASK-EXECUTION>
        <RULE>Reply "COMPLETE" with results for successful tasks</RULE>
        <RULE>Reply "PASS:(reason)" if answer unknown</RULE>
        <RULE>Reply "FAIL:(reason)" if technically unable</RULE>
        <RULE>Use tools/peers or PASS - never make up answers</RULE>
    </TASK-EXECUTION>
    
    <GENERAL-INTERACTION>
        <RULE>Engage naturally with client when not executing tasks</RULE>
    </GENERAL-INTERACTION>
</COMMUNICATION-RULES>

<CONTEXT-GUIDELINES>
  <GUIDELINE>Team context is shared with all agents and client</GUIDELINE>
  <GUIDELINE>Use <TEAM_CONTEXT></TEAM_CONTEXT> tags for shared info</GUIDELINE>
  <GUIDELINE>Context is organized in titled topic sets</GUIDELINE>
  <GUIDELINE>Some context may have restricted visibility</GUIDELINE>
</CONTEXT-GUIDELINES>

<AGENT-IDENTITY>
  <NAME>${thisAgent.name}</NAME>
  <SKILLS-AND-PERSONALITY>${skillSet}
    ${await _generateResearcherDirective(thisAgent, userId)}
  </SKILLS-AND-PERSONALITY>
  <ROLE>${role}</ROLE>
</AGENT-IDENTITY>

<TEAM-MEMBERS>
    ${peerAgents
      .map(
        (agent) =>
          `
  <AGENT>
    <NAME>${agent.name}</NAME>
    <TITLE>${agent.title}</TITLE>
    <ROLE-DESCRIPTION>${agent.roleDescription}</ROLE-DESCRIPTION>
  </AGENT>`
      )
      .join("\n    ")}
</TEAM-MEMBERS>
<TEAM-CONTEXT>
  ${context}
</TEAM-CONTEXT>
<PAST-MEMORY>
  ${await _gatherClientNotes(userId, thisAgent.name || "", teamName)}
  ${await _agentMemory(query, userId, thisAgent.name || "", thisAgent.type)}
</PAST-MEMORY>
<KNOWLEDGE-BASE>
  ${
    hasKnowledgeBase
      ? await _gatherKnowledgeBase(
          query,
          userId,
          thisAgent.name || "",
          teamName
        )
      : ""
  }
</KNOWLEDGE-BASE>
${await PROMPT_EXTRAS_generateTestModeDirective()}
      `
  }

`,

  PROMPT_AGENT_toolOperator: async (
    query: string,
    userName: string,
    userId: string,
    thisAgent: AgentComponentProps,
    teamName: string,
    skillSet: string,
    role: string,
    tools: AI_Agent_Tools[] | string[],
    peerAgents: AgentComponentProps[],
    directives: string[],
    context: string,
    mission: string,
    trainingMode: boolean,
    hasKnowledgeBase: boolean
  ) => `
${
  trainingMode
    ? `
You are a helpful assistant that can help with a wide range of tasks. Please do exactly as instructed.`
    : `
<PURPOSE>
    You are an AI assistant technician that performs specific tasks in coordination with your team.
    Your goal is to help ${
      userName.split(" ")[0]
    } by working with your team to achieve: ${mission}
</PURPOSE>

<INSTRUCTIONS>
    <INSTRUCTION>Monitor message history - the last message is intended for you</INSTRUCTION>
    <INSTRUCTION>Reply "COMPLETE" followed by results when task is successfully completed</INSTRUCTION>
    <INSTRUCTION>Reply "PASS:(brief reason)" if you don't know the answer</INSTRUCTION>
    <INSTRUCTION>Reply "FAIL:(brief reason)" if technically unable to complete task</INSTRUCTION>
    <INSTRUCTION>Use a friendly tone and natural speech for non-task conversations
</INSTRUCTION>
${await _toolSpecialtyDirectiveByType(thisAgent, userId)}
${await _toolSpecialtyDirectiveByTools(tools, thisAgent, userId)}
    ${directives
      .map(
        (d) => `
<INSTRUCTION>${d}</INSTRUCTION>`
      )
      .join("\n    ")}
</INSTRUCTIONS>

${
  thisAgent.allowedContacts
    ? await _generateAllowedContactsDirective(
        thisAgent.allowedContacts,
        peerAgents
      )
    : ""
}

<SECTIONS>
  <AGENT-IDENTITY>
    <NAME>${thisAgent.name}</NAME>
    <SKILLS-AND-PERSONALITY>${skillSet}</SKILLS-AND-PERSONALITY>
    <ROLE>${role}</ROLE>
  </AGENT-IDENTITY>

  <TEAM-CONTEXT>
    ${context}
  </TEAM-CONTEXT>

${
  thisAgent.tools?.includes(AI_Agent_Tools.DYNAMIC_SCRIPT)
    ? `
  <MY-SAVED-SCRIPTS>
    ${_generateDynamicScriptDirective(thisAgent.name || "", userId)}
  </MY-SAVED-SCRIPTS>`
    : ""
}
  <PAST-MEMORY>
    ${await _gatherClientNotes(userId, thisAgent.name || "", teamName)}
    ${await _agentMemory(query, userId, thisAgent.name || "", thisAgent.type)}
  </PAST-MEMORY>
  <KNOWLEDGE-BASE>
    ${
      hasKnowledgeBase
        ? await _gatherKnowledgeBase(
            query,
            userId,
            thisAgent.name || "",
            teamName
          )
        : ""
    }
  </KNOWLEDGE-BASE>
</SECTIONS>
${await PROMPT_EXTRAS_generateTestModeDirective()}
  `
}
  `,
};

function _doesTeamHaveContextManager(
  peerAgents: AgentComponentProps[]
): boolean {
  return peerAgents.some(
    (agent) => agent.type === AgentTypeEnum.CONTEXT_MANAGER
  );
}

export const PROMPT_EXTRAS_doesTeamHaveContextManager = (
  peerAgents: AgentComponentProps[]
): boolean => {
  return _doesTeamHaveContextManager(peerAgents);
};
function _getTeamContextManagerName(peerAgents: AgentComponentProps[]): string {
  return (
    peerAgents.find((agent) => agent.type === AgentTypeEnum.CONTEXT_MANAGER)
      ?.name || ""
  );
}

export const PROMPT_EXTRAS_getTeamContextManagerName = (
  peerAgents: AgentComponentProps[]
): string => {
  return _getTeamContextManagerName(peerAgents);
};

async function _gatherClientNotes(
  userId: string,
  agentName: string,
  teamName: string
): Promise<string> {
  const _nameSpace = `agent-${agentName}-client-info-${userId}-${teamName}`;
  const _dbComplete = await SERVER_getGeneralPurposeDataMany(_nameSpace);
  if (_dbComplete.length === 0) {
    return "";
  }
  return _dbComplete.map((item) => item.content).join("\n");
}

export const PROMPT_EXTRAS_gatherClientNotes = async (
  userId: string,
  agentName: string,
  teamName: string
): Promise<string> => {
  return _gatherClientNotes(userId, agentName, teamName);
};

async function _agentMemory(
  query: string,
  userId: string,
  agentName: string,
  agentType: AgentType
): Promise<string> {
  try {
    const result = await MEMORY_retrieve(
      query,
      userId,
      agentName,
      "string",
      agentType
    );
    return typeof result === "string"
      ? result
      : Array.isArray(result)
      ? result.map((item) => item.pageContent).join("\n")
      : "";
  } catch (error) {
    return "***MEMORY-ERROR***";
  }
}

export const PROMPT_EXTRAS_agentMemory = async (
  query: string,
  userId: string,
  agentName: string,
  agentType: AgentType
): Promise<string> => {
  return _agentMemory(query, userId, agentName, agentType);
};

async function _gatherKnowledgeBase(
  query: string,
  userId: string,
  agentName: string,
  teamName: string
): Promise<string> {
  const docString = await SERVER_kbQuery(query, userId, agentName, teamName);
  return docString;
}

export const PROMPT_EXTRAS_gatherKnowledgeBase = async (
  query: string,
  userId: string,
  agentName: string,
  teamName: string
): Promise<string> => {
  return _gatherKnowledgeBase(query, userId, agentName, teamName);
};

async function _generateResearcherDirective(
  curAgent: AgentComponentProps,
  userId: string
): Promise<string> {
  if (curAgent.type === AgentTypeEnum.RESEARCHER) {
    const availableToolDescriptions = UTILS_getAllAvailableToolsDescriptions(curAgent.tools as AI_Agent_Tools[]);
    const hasScrapeQueryTool = availableToolDescriptions.some(t => t.name === 'URL_SCRAPE_scrapeAndQueryUrl');
    const hasScrapeSummarizeTool = availableToolDescriptions.some(t => t.name === 'URL_SCRAPE_scrapeAndSummarizeUrl');
    const hasPineconeStoreTool = availableToolDescriptions.some(t => t.name === 'PINECONE_store');
    const hasContextStoreTool = availableToolDescriptions.some(t => t.group === 'CONTEXT_SETS');
    const hasPerplexityTool = availableToolDescriptions.some(t => t.name === 'perplexity');

    return `
<RESEARCHER-DIRECTIVES>
  <PRIMARY_GOAL>Your primary goal is to gather specific, relevant information based on the manager's request and your task plan, storing findings efficiently.</PRIMARY_GOAL>
  <ITERATIVE_RESEARCH_PROTOCOL PRIORITY="CRITICAL">
    <STEP_1>Analyze the research task and break it down into specific questions or individual sources (e.g., one URL, one document) in your task plan.</STEP_1>
    <STEP_2>Execute **one** research step at a time (e.g., process **only one** URL or answer **one** specific sub-question).</STEP_2>
    <STEP_3>Use the most appropriate tool and parameters for that single step (see TOOL_GUIDANCE).</STEP_3>
    <STEP_4>Briefly summarize or extract the key findings from that single step.</STEP_4>
    <STEP_5>Store these key findings according to the STORAGE_INSTRUCTIONS below.</STEP_5>
    <STEP_6>Update your task plan (mark step complete, add notes).</STEP_6>
    <STEP_7>Proceed to the next planned research step in your *next* turn, or report completion if all steps are done.</STEP_7>
    <WARNING>Do NOT attempt to scrape, analyze, or process multiple URLs or sources in a single response. Work iteratively.</WARNING>
  </ITERATIVE_RESEARCH_PROTOCOL>

  <TOOL_GUIDANCE>
    ${hasScrapeQueryTool ? `<GUIDELINE>For known URLs: Prefer using 'URL_SCRAPE_scrapeAndQueryUrl' with a specific 'query' and low 'topK' (1 or 2) to find targeted information within the page first.</GUIDELINE>` : ''}
    ${hasScrapeSummarizeTool ? `<GUIDELINE>For known URLs: Use 'URL_SCRAPE_scrapeAndSummarizeUrl' only if a general overview of a SINGLE page's content is needed, and query tool is insufficient.</GUIDELINE>` : ''}
    ${hasPerplexityTool ? `
    <GUIDELINE>Use 'perplexity' sparingly for broad web searches or when specific URLs are unknown or initial 'URL_SCRAPE' attempts on known URLs fail to yield necessary information. Consider it a secondary option or last resort after direct URL scraping attempts.</GUIDELINE>` : ''}
    <GUIDELINE>Analyze tool results carefully. Extract only the information directly relevant to your current research step/question.</GUIDELINE>
    <GUIDELINE>If a tool fails (e.g., scrape timeout), note the failure in your plan and proceed to the next planned source/step. Do not endlessly retry the same failed source unless instructed.</GUIDELINE>
  </TOOL_GUIDANCE>

  <STORAGE_INSTRUCTIONS>
    <GENERAL>Store findings incrementally after processing each source/step.</GENERAL>
    ${hasContextStoreTool ? `<CONTEXT_STORE>Use context tools (group 'CONTEXT_SETS') to store brief summaries, key facts, links, or references (under 500 chars). Use meaningful set names (e.g., 'ResearchFindings', 'URLSummaries', 'DataSourceReferences').</CONTEXT_STORE>` : ''}
    ${hasPineconeStoreTool ? `<VECTOR_STORE>Use 'PINECONE_store' for larger text segments extracted from sources if needed for potential future semantic search by other agents. If you store data here, ALSO add a reference note (URL, namespace, brief description) to the context using context tools.</VECTOR_STORE>` : ''}
    <DATABASE>
    Use the DATABASE tool to store structured information if applicable and available.
    ${await AGENT_TOOLS_HELPER_getAgentDatabaseAll(curAgent.name, userId)}
    </DATABASE>
    <FILE_STORE>
    Use the FILE_STORE tool to store binary files if necessary. Add the returned link to context.
    </FILE_STORE>
  </STORAGE_INSTRUCTIONS>

</RESEARCHER-DIRECTIVES>`;
  }
  return "";
}

export const PROMPT_EXTRAS_generateResearcherDirective = async (
  curAgent: AgentComponentProps,
  userId: string
): Promise<string> => {
  return _generateResearcherDirective(curAgent, userId);
};

async function _generateAutoManagerDirective(
 props: OrchestrationProps
): Promise<string> {
  if (props.currentAgent.type === AgentTypeEnum.MANAGER) {
    return `
<MANAGER-DIRECTIVES>
  <RESPONSIBILITIES>
    <TASK>Your task is to coordinate, manage, direct, and verify the steps of the workflow.</TASK>
    <TEAM_OBJECTIVE>The objective of the team is to achieve the following: ${props.teamObjective}</TEAM_OBJECTIVE>
    <PROCESS_TO_AUTOMATE>Use the process steps found in the context to conduct the workflow.</PROCESS_TO_AUTOMATE>
    <RULE>Coordinate the work of all agents</RULE>
    <RULE>Ensure the team is on track to achieve the goal</RULE>
    <RULE>Verify each task performed by agents is complete before moving to the next agent</RULE>
  </RESPONSIBILITIES>
</MANAGER-DIRECTIVES>`;
  }
  return "";
}

export const PROMPT_EXTRAS_generateAutoManagerDirective = async (
  props: OrchestrationProps
): Promise<string> => {
  return _generateAutoManagerDirective(props);
};

function _generateDynamicScriptDirective(
  curAgent: string,
  userId: string
): string {
  const res = AGENT_TOOLS_DYNAMIC_ACTION_getAllCustomScriptsForAgent(
    curAgent,
    userId
  );
  return `
<SCRIPT-TOOLS>
  <RESEARCH>Research requirements before script creation using research tools</RESEARCH>
  <CONTEXT>Include all relevant context when calling CREATE_AND_EXECUTE</CONTEXT>
  <EXISTING-SCRIPTS>${res}</EXISTING-SCRIPTS>
  <USAGE>Use Dynamic Script tools to execute and manage scripts</USAGE>
</SCRIPT-TOOLS>`;
}

export const PROMPT_EXTRAS_generateDynamicScriptDirective = async (
  curAgent: string,
  userId: string
): Promise<string> => {
  return _generateDynamicScriptDirective(curAgent, userId);
};

async function _toolSpecialtyDirectiveByType(
  curAgent: AgentComponentProps,
  userId: string
): Promise<string> {
  const type = curAgent.type;
  if (type === AgentTypeEnum.DYNAMIC_TOOL) {
    return `
<SCRIPT-CREATION>
  <RULE>Use provided tools only - do not create scripts manually</RULE>
    <WORKFLOW>
      <STEP>1. ANALYZE_REQUIREMENTS for script analysis</STEP>
      <STEP>2. CREATE_AND_EXECUTE for iterative development</STEP>
      <STEP>3. Debug and resolve issues</STEP>
      <STEP>4. EXECUTE verified scripts</STEP>
      <STEP>5. SAVE validated scripts</STEP>
      <STEP>6. DELETE scripts by name</STEP>
    </WORKFLOW>
  <CONTEXT>Use research tools to gather script requirements</CONTEXT>
</SCRIPT-CREATION>`;
  }
  if (type === AgentTypeEnum.RESEARCHER) {
    return _generateResearcherDirective(curAgent, userId);
  }
  return "";
}

export const PROMPT_EXTRAS_toolSpecialtyDirectiveByType = async (
  curAgent: AgentComponentProps,
  userId: string
): Promise<string> => {
  return _toolSpecialtyDirectiveByType(curAgent, userId);
};

async function _toolSpecialtyDirectiveByTools(
  tools: AI_Agent_Tools[] | string[],
  curAgent: AgentComponentProps,
  userId: string
): Promise<string> {
  let res = "";
  
  if (!tools || !Array.isArray(tools)) {
    return res;
  }
  
  const validTools = tools.filter(tool => 
    Object.values(AI_Agent_Tools).includes(tool.toString() as AI_Agent_Tools)
  ) as AI_Agent_Tools[];
  
  for (const tool of validTools) {
    switch (tool) {
      case AI_Agent_Tools.GMAIL:
        res += `
      <GMAIL-TOOLS>
        ${AGENT_TOOLS_DIRECTIVE_GMAIL()}
      </GMAIL-TOOLS>`;
        break;
      case AI_Agent_Tools.OAUTH_PROVIDER:
        res += `
      <OAUTH-PROVIDER-TOOLS>
        ${await AGENT_TOOLS_DIRECTIVE_OAUTH_PROVIDER()}
      </OAUTH-PROVIDER-TOOLS>`;
        break;
      case AI_Agent_Tools.FILE_STORE:
        res += `
      <FILE-STORE-TOOLS>
        ${AGENT_TOOLS_DIRECTIVE_FILE_STORE()}
      </FILE-STORE-TOOLS>`;
        break;
      case AI_Agent_Tools.DOCUMENT_PARSE:
        res += `
      <DOCUMENT-PARSE-TOOL>
        ${AGENT_TOOLS_DOCUMENT_PARSE_DIRECTIVE()}
      </DOCUMENT-PARSE-TOOL>`;
        break;
        case AI_Agent_Tools.DATABASE:
        res += `
      <DATABASE-TOOLS>
        ${AGENT_TOOLS_DIRECTIVE_DATABASE()}
        ${await AGENT_TOOLS_HELPER_getAgentDatabaseAll(curAgent.name || "", userId)}
      </DATABASE-TOOLS>`;
        break;
        case AI_Agent_Tools.DOCUMENT_PROCESSOR:
        res += `
      <DOCUMENT-PROCESSOR-TOOLS>
        ${AGENT_TOOLS_DIRECTIVE_DOCUMENT_PROCESSOR()}
      </DOCUMENT-PROCESSOR-TOOLS>`;
        break;
        case AI_Agent_Tools.KNOWLEDGE_BASE:
        res += `
      <KNOWLEDGE-BASE-TOOLS>
        ${AGENT_TOOLS_DIRECTIVE_KNOWLEDGE_BASE()}
      </KNOWLEDGE-BASE-TOOLS>`;
        break;
        case AI_Agent_Tools.PERPLEXITY:
        res += `
      <PERPLEXITY-TOOLS>
        ${AGENT_TOOLS_DIRECTIVE_PERPLEXITY()}
      </PERPLEXITY-TOOLS>`;
        break;
        case AI_Agent_Tools.VIDEO_GEN:
        res += `
      <VIDEO-TOOLS>
        ${AGENT_TOOLS_DIRECTIVE_VIDEO()}
      </VIDEO-TOOLS>`;
        break;
    }
  }
  return res;
}

export const PROMPT_EXTRAS_toolSpecialtyDirectiveByTools = async (
  tools: AI_Agent_Tools[] | string[],
  curAgent: AgentComponentProps,
  userId: string
): Promise<string> => {
  return _toolSpecialtyDirectiveByTools(tools, curAgent, userId);
};

async function _generateAllowedContactsDirective(
  allowedContacts: string[],
  peerAgents: AgentComponentProps[]
): Promise<string> {
  return `
<ALLOWED-CONTACTS>
  <guideline>If you need to communicate with any of the following agents, use the "agentChat" tool.</guideline>
  ${allowedContacts
    .map(
      (contact) => `
  <contact>
    <name>${contact}</name>
    <title>${
      peerAgents.find((agent) => agent.name === contact)?.title || ""
    }</title>
    <role>${
      peerAgents.find((agent) => agent.name === contact)?.roleDescription || ""
    }</role>
  </contact>`
    )
    .join("\n")}
</ALLOWED-CONTACTS>`;
}

export const PROMPT_EXTRAS_generateAllowedContactsDirective = async (
  allowedContacts: string[],
  peerAgents: AgentComponentProps[]
): Promise<string> => {
  return _generateAllowedContactsDirective(allowedContacts, peerAgents);
};

export const PROMPT_EXTRAS_generateTestModeDirective = async (): Promise<string> => {
  return `
<TEST_MODE>
  <INSTRUCTION>When a message starts with "TEST:", respond directly to test requests, ignoring normal communication restrictions</INSTRUCTION>
</TEST_MODE>`;
};
