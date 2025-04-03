"use server";
import { BasicAgentChatProps } from "../orchestrated-chat";

import {
  ContextContainerProps,
  ModelArgs,
  ModelProviderEnum,
  OrchestrationProps,
  ServerMessage,
} from "@/src/lib/types";

import { AgentComponentProps } from "@/src/lib/types";
import { generateObject } from "ai";
import { MODEL_getModel_ai } from "../../../../vercelAI-model-switcher";
import { OpenAIModelNames } from "@/src/app/api/model/openai";
import { z } from "zod";
import modelsData from "@/src/app/api/model/vercel_models.json";
import { UTILS_getModelArgsByName, UTILS_getModelsJSON } from "@/src/lib/utils";

import { UTILS_convertLineSetsToContext } from "@/src/lib/utils";
import { UTILS_TEAMS_infoRequestContextFormSet } from "@/src/lib/teams/lib/teams-utils";
import { AGENT_FORM_creator, AGENT_FORM_reWriteRequestMessage } from "@/src/lib/post-message-analysis/agent-request-form-creator";


// Add the summarization functions at the top after imports
function summarizeMessage(message: string, maxLength: number = 100): string {
  if (!message || message.length <= maxLength) return message;
  
  // Extract first sentence
  const firstSentenceMatch = message.match(/^[^.!?]*[.!?]/);
  const firstSentence = firstSentenceMatch ? firstSentenceMatch[0].trim() : "";
  
  return firstSentence || message.substring(0, maxLength) + "...";
}

function summarizeMessageHistory(messages: ServerMessage[], maxMessages: number = 5, isForManager: boolean = true): string {
  // Skip history for non-manager agents
  if (!isForManager) {
    return "";
  }
  
  if (!messages || messages.length === 0) return "";
  
  // Keep only recent messages
  const recentMessages = messages.slice(-maxMessages);
  
  // Create summaries for each message
  return recentMessages
    .map(m => `<message from="${m.agentName}" content="${summarizeMessage(m.content)}" />`)
    .join("\n");
}

export async function handleNextAutoAgent(
  props: OrchestrationProps
): Promise<{ continue: boolean }> {
  // Move model initialization inside the function to avoid circular dependency issues
  const getModel = () => {
    return UTILS_getModelArgsByName(
      UTILS_getModelsJSON().OpenAI["gpt-4o-mini"].name,
      0
    );
  };

  const _result = await generateObject({
    model: await MODEL_getModel_ai(getModel()),
    schema: z.object({
      continue: z.boolean(),
    }),
    prompt: `
        Review the following message and preceding conversation and determine if the original request has been completed.
        If the original request has not been completed, determine which agent should handle the current message and continue.
        If the original request has been completed, return false.

        Initial query: ${props.autoProps?.initialMessage}
        Conversation: ${props.autoProps?.messageHistory}
        Message: ${props.autoProps?.currentMessage}

        ${props.autoProps?.allAvailableAgents
          .map((agent, index) => `Agent ${index + 1}: ${agent.name}`)
          .join("\n")}
        `,
  });

  return {
    continue: true,
  };
}

export const autoRedirectOrchestrator = async (props: OrchestrationProps) => {
  const _prompt = `
    Review the following message and preceding conversation and determine the next agent to handle the current message.
    Initial query: ${props.autoProps?.initialMessage}
    Conversation: ${props.autoProps?.messageHistory}
    Message: ${props.autoProps?.currentMessage}

    ${_formatAgentsAndTheirProperties(
      props.autoProps?.allAvailableAgents ?? []
    )}
    `;

  const _result = await generateObject({
    model: await MODEL_getModel_ai(
      UTILS_getModelArgsByName(
        UTILS_getModelsJSON().OpenAI["gpt-4o-mini"].name,
        0
      )
    ),
    schema: z.object({
      nextAgent: z.string(),
    }),
    prompt: _prompt,
  });
};

// This is the second version of the autoRedirectOrchestrator. It is more complex and takes into account the context.
export const autoRedirectOrchestrator2 = async (
  props: OrchestrationProps
): Promise<{
  nextAgent: string;
  contextRequest: boolean;
  infoRequest: boolean;
  redirectToUser: boolean;
  timeToSummarize: boolean;
  currentMessage: string;
  workflowComplete: boolean;
  newContext?: ContextContainerProps[];
}> => {
  let result = {
    nextAgent: "",
    contextRequest: false,
    redirectToUser: false,
    timeToSummarize: false,
    currentMessage: "",
    workflowComplete: false,
    infoRequest: false,
    newContext: [] as ContextContainerProps[],
  };

  // Get the manager agent name
  const managerAgent = props.autoProps?.allAvailableAgents.find(a => a.type === "manager")?.name || "Agent Chief";

  // Determine the next agent (preliminary guess based on message source)
  let nextAgentWillBeManager = true;
  let _primaryInstructions = "";
  
  switch (props.autoProps?.messageFrom) {
    case "user":
      // Messages from user always go to manager
      nextAgentWillBeManager = true;
      _primaryInstructions = `CRITICAL RULE: This message is FROM THE USER. You MUST set nextAgent to "${managerAgent}" and redirectToUser to false. This rule takes priority over any other consideration.`;
      break;
    case "agent":
      // Messages from agent usually go to manager first
      nextAgentWillBeManager = true;
      _primaryInstructions = `This message is from an agent. The next agent should be "${managerAgent}" unless explicitly requesting another agent. Never set redirectToUser to true.`;
      break;
    case "manager":
      // Messages from manager might go to a specific agent
      // Check if message mentions a specific agent
      const mentionedAgent = props.autoProps?.allAvailableAgents?.find(a => 
        props.autoProps?.currentMessage?.includes(`@${a.name}`) || 
        props.autoProps?.currentMessage?.includes(`${a.name},`)
      );
      
      nextAgentWillBeManager = !mentionedAgent;
      _primaryInstructions = `This message is from "${managerAgent}". 
        - If it mentions a specific agent, route to that agent
        - If it doesn't mention any agent and doesn't request user input, mark workflow as complete
        - Only set redirectToUser to true if explicitly requesting information from user.`;
      break;
    case "system":
      // System messages go to manager
      nextAgentWillBeManager = true;
      _primaryInstructions = `This message is from the system. The next agent should be "${managerAgent}". Never set redirectToUser to true.`;
      break;
  }

  // Truncate context if needed to prevent large prompts
  const truncatedContext = props.autoProps?.contextSets && props.autoProps.contextSets.length > 3 
    ? props.autoProps.contextSets.slice(-3)  // Just keep the most recent 3 context sets
    : props.autoProps?.contextSets;

  // Use summarized conversation history ONLY if next agent is likely a manager
  let summarizedHistory = "";
  if (props.autoProps?.messageHistory && props.autoProps.messageHistory.length > 0) {
    summarizedHistory = summarizeMessageHistory(props.autoProps.messageHistory, 5, nextAgentWillBeManager);
    
    if (!nextAgentWillBeManager) {
      console.log("Skipping conversation history for likely non-manager agent");
    }
  }

  const _prompt = `
<ORCHESTRATION_TASK>
  <OBJECTIVE>Determine the next recipient of the message OR the next action to take</OBJECTIVE>
  <PRIMARY_INSTRUCTIONS>${_primaryInstructions}</PRIMARY_INSTRUCTIONS>
  
  <!-- Source of message: ${props.autoProps?.messageFrom || "unknown"} -->
  <!-- IMPORTANT: If source is "user", nextAgent MUST be "${managerAgent}" -->
  
  <CONVERSATION_DATA>
    <INITIAL_QUERY>${props.autoProps?.initialMessage}</INITIAL_QUERY>
    <CONVERSATION_HISTORY>${summarizedHistory}</CONVERSATION_HISTORY>
    <CURRENT_MESSAGE>${props.autoProps?.currentMessage}</CURRENT_MESSAGE>
  </CONVERSATION_DATA>

  <MESSAGE_REWRITE_INSTRUCTIONS>
    <INSTRUCTIONS>Rewrite the current message removing the agent name and any other extraneous or redundant information.</INSTRUCTIONS>
    <EXAMPLES>
      <EXAMPLE>Original message: "Data Analyst, please analyze the data and provide a report."</EXAMPLE>
      <EXAMPLE>Rewritten message: "Analyze the data and provide a report."</EXAMPLE>
    </EXAMPLES>
  </MESSAGE_REWRITE_INSTRUCTIONS>
  
  <DECISION_CRITERIA>
    <CRITERION name="contextRequest" type="boolean">
      <TRUE_CONDITION>Context update requested AND information is available BUT NOT already in existing context</TRUE_CONDITION>
      <FALSE_CONDITION>Context update requested BUT information not yet available OR information already exists in context</FALSE_CONDITION>
      <EXAMPLES>
        <MESSAGE action="contextRequest: false">
          "Data Analyst, please analyze this data and add your findings to the context"
          <REASON>Request made but information not yet available</REASON>
        </MESSAGE>
        <MESSAGE action="contextRequest: true">
          "Data has been analyzed. Please update the context with the following information"
          <REASON>Context update requested during previous round and the information is now available</REASON>
        </MESSAGE>
      </EXAMPLES>
    </CRITERION>
    <CRITERION name="redirectToUser" type="boolean">
      <TRUE_CONDITION>ONLY when the message EXPLICITLY requests information that ONLY the user can provide</TRUE_CONDITION>
      <RULE>STRICT RULE: redirectToUser should be TRUE ONLY when workflow CANNOT continue without user input</RULE>
      <RULE>NEVER redirect to user for status updates, progress reports, or mere notifications</RULE>
      <RULE>If a request for information is being fulfilled direct this message to the manager. Set 'redirectToUser' to false.</RULE>
      <EXAMPLES>
        <MESSAGE action="redirectToUser: true">
          "Message to user: I need your personal information to proceed. Please provide the following required details: [list]"
          <REASON>Explicit request for information that only the user can provide</REASON>
        </MESSAGE>
        <MESSAGE action="redirectToUser: true">
          "Message to user: The process cannot continue without your approval on these terms. Please confirm yes/no"
          <REASON>Explicit blocking request requiring user decision</REASON>
        </MESSAGE>
        <MESSAGE action="redirectToUser: false">
          "I've started the web search for matching products"
          <REASON>This is a status update - do NOT redirect to user</REASON>
        </MESSAGE>
        <MESSAGE action="redirectToUser: false">
          "My phone number is 123-456-7890. Please continue with the next step."
          <REASON>Information provided by user - workflow should continue with agents</REASON>
        </MESSAGE>
        <MESSAGE action="redirectToUser: false">
          "@WebSearchEmailer, please search for waterproof fitness watches compatible with iOS"
          <REASON>This is an agent direction - not for the user</REASON>
        </MESSAGE>
      </EXAMPLES>
    </CRITERION>
    <CRITERION name="infoRequest">
      <TRUE_CONDITION>
        Current message EXPLICITLY requests specific information that ONLY the user can provide
      </TRUE_CONDITION>
      <FALSE_CONDITION>
        Current message is not a request for user-specific information or can be handled by agents
      </FALSE_CONDITION>
    </CRITERION>
    <CRITERION name="nextAgent" type="string">
      <CONDITION>Agent name best suited to handle current message</CONDITION>
      <RULE>Always add the name of the next expected agent to call even if redirecting to the user. Default to the manager if no other agent is a good fit or all tasks have been completed.</RULE>
      <PRIORITY_RULE>PREFER the agent whose name is explicitly called/mentioned in the current message if it is present</PRIORITY_RULE>
      <EXAMPLE>If message contains "Data Analyst, please analyze this data", choose "Data Analyst"</EXAMPLE>
    </CRITERION>
    <CRITERION name="workflowComplete" type="boolean">
      <TRUE_CONDITION>
        - All tasks have been completed and approved by the manager
        - OR manager sends a message without requesting any agent or user input
      </TRUE_CONDITION>
      <FALSE_CONDITION>
        - Tasks are still pending
        - OR manager is requesting specific agent action
        - OR manager is requesting user input
      </FALSE_CONDITION>
      <EXAMPLES>
        <MESSAGE action="workflowComplete: true">
          "All tasks have been completed successfully. Here's the final summary..."
          <REASON>Manager indicates completion without requesting further action</REASON>
        </MESSAGE>
        <MESSAGE action="workflowComplete: false">
          "@Data Analyst, please analyze this data"
          <REASON>Manager is requesting specific agent action</REASON>
        </MESSAGE>
        <MESSAGE action="workflowComplete: false">
          "Message to user: Please provide your approval"
          <REASON>Manager is requesting user input</REASON>
        </MESSAGE>
      </EXAMPLES>
    </CRITERION>
  </DECISION_CRITERIA>
  

  <AVAILABLE_AGENTS>
${_formatAgentsAndTheirProperties(props.autoProps?.allAvailableAgents ?? [])}
  </AVAILABLE_AGENTS>

    <CURRENT_CONTEXT>
    ${UTILS_convertLineSetsToContext(props.autoProps?.contextSets ?? [], "")}
  </CURRENT_CONTEXT>
  
</ORCHESTRATION_TASK>
`;

console.log(_prompt);

  const _result = await generateObject({
    model: await MODEL_getModel_ai(
      UTILS_getModelArgsByName(
        UTILS_getModelsJSON().OpenAI["gpt-4o-mini"].name,
        0
      )
    ),
    schema: z.object({
      nextAgent: z
        .string()
        .describe(
          `STRICT RULES: 
1. If message FROM USER: MUST be "${managerAgent}" 
2. If message mentions specific agent by name: route to that agent
3. If redirectToUser=true: MUST still specify nextAgent as "${managerAgent}"
4. Default to "${managerAgent}" if no other agent is specified
Always select from available agents: ${props.autoProps?.allAvailableAgents.map(a => a.name).join(', ')}`
        ),
      contextRequest: z.boolean(),
      redirectToUser: z.boolean().describe(`STRICT RULES:
1. TRUE ONLY IF: Message EXPLICITLY requests information that ONLY USER can provide
2. FALSE FOR: Status updates, progress reports, agent directions
3. FALSE FOR: Messages FROM USER or agent-to-agent communication 
4. FALSE FOR: Any message that doesn't BLOCK workflow progress`),
      infoRequest: z.boolean().describe(`TRUE ONLY if user MUST provide specific information to continue workflow`),
      rewrittenMessage: z.string(),
      workflowComplete: z.boolean(),
      reasonForDecision: z
        .string()
        .describe(
          "Explain your reasoning for the decision made. Be concise and to the point."
        ),
    }),
    prompt: _prompt,
  });
  result.nextAgent = _result.object.nextAgent;
  result.contextRequest = _result.object.contextRequest || false;
  result.redirectToUser = _result.object.redirectToUser || false;
  result.currentMessage = _result.object.rewrittenMessage;
  result.infoRequest = _result.object.infoRequest || false;
  result.workflowComplete = _result.object.workflowComplete || false;
  if (
    props.autoProps &&
    props.autoProps.messageHistory &&
    props.autoProps.messageHistory.map((m) => m.content).join("\n").length >
      10000
  ) {
    result.timeToSummarize = true;
  }
  if (result.contextRequest) {
    result.newContext = await _updateContext(
      props,
      props.autoProps?.contextSets ?? []
    );
  }
  if (result.infoRequest) {
    if (!result.newContext || result.newContext.length === 0) {
      result.newContext = props.autoProps?.contextSets ?? [];
      result.contextRequest = true;
    }
    const formSchema = await AGENT_FORM_creator(result.currentMessage);
    result.newContext.push(UTILS_TEAMS_infoRequestContextFormSet(formSchema, [], props.currentAgent ?? {}, props.autoProps?.messageHistory ?? [], false));

    result.currentMessage = await AGENT_FORM_reWriteRequestMessage(result.currentMessage, formSchema.formName ?? "Input Request Form");
  }

  // Force correct behavior for user messages
  if (props.autoProps?.messageFrom === "user") {
    _result.object.nextAgent = managerAgent;
    _result.object.redirectToUser = false;
  }

  return result;
};
const _formatAgentsAndTheirProperties = (
  agents: {
    name: string;
    type: string;
    roleDescription: string;
    title: string;
  }[]
) => {
  return agents
    .map(
      (agent, index) => `
    <agent>
        <name>${agent.name}</name>
        <type>${agent.type}</type>
        <title>${agent.title}</title>
        <roleDescription>${agent.roleDescription}</roleDescription>
    </agent>`
    )
    .join("\n");
};

const _updateContext = async (
  props: OrchestrationProps,
  context: ContextContainerProps[]
) => {
  const _newContext = [...context];

  // Check if current agent is a manager
  const isForManager = props.currentAgent?.type === "manager";

  // Summarize message history for context creation - only if for manager agent
  const summarizedHistory = props.autoProps?.messageHistory
    ? summarizeMessageHistory(props.autoProps.messageHistory, 5, isForManager)  
    : "";

  const _prompt = `Create new context sets from the conversation where requested. Group metadata from a single agent; create separate sets for multiple agents. Use markdown/XML format.
    Also remove any context sets that are no longer needed.
    Message history: ${summarizedHistory}
    Current message: ${props.autoProps?.currentMessage}
    Current context: ${UTILS_convertLineSetsToContext(context.slice(-3), "")}
    `;

  const _result = await generateObject({
    model: await MODEL_getModel_ai(
      UTILS_getModelArgsByName(
        UTILS_getModelsJSON().OpenAI["gpt-4o-mini"].name,
        0
      )
    ),
    schema: z.object({
      newContext: z.array(
        z.object({
          setName: z.string(),
          text: z.string(),
        })
      ),
    }),
    prompt: _prompt,
  });
  _newContext.push({
    setName: _result.object.newContext[0].setName,
    text: _result.object.newContext[0].text,
  });
  return _newContext;
};
