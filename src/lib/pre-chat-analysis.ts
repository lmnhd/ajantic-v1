import {
  AISessionState,
  ModelArgs,
  AgentFoundationalPromptProps,

  Team,
  ContextContainerProps,
} from "@/src/lib/types";
import { callMistral } from "@/src/lib/agent-memory/store-retrieve";
import { logger } from "@/src/lib/logger";

export type PreChatAnalysisProps = {
  nextFlag: string;
  originalMessage?: string;
  updatedMessage?: string;
  modelArgs?: ModelArgs;
  preStartNotes?: PreStartNote[]
};

export type PreStartNote = {
  message: string;
  processName: string;
  onGoing: boolean;
  nextActions: string[];
};

export async function ANALYSIS_TOOLS_preChatAnalysis(
  message: string,
  agentName: string,
  myTeam: Team,
  contextSets: ContextContainerProps[],
  agentFoundationalPromptProps: AgentFoundationalPromptProps,
  state: AISessionState,
  userId: string,
  teamName: string
): Promise<PreChatAnalysisProps> {
  try {
    const [name, thisMessage] = message.split(":::");
    // Extract visible line sets for this agent
    const visibleLineSets = contextSets.filter(set => !set.isDisabled && !set.hiddenFromAgents?.includes(agentName)).map(set => ({
      name: set.setName,
      content: set.text,
      lines: set.lines
    }));

    // Create context string from line sets
    const lineSetContext = visibleLineSets.map(set => 
      `${set.name}:\n${set.content}`
    ).join('\n\n');

    // Analyze message and context using Mistral
    const analysisPrompt = `<analysis_request>
  <message>${thisMessage}</message>
  <context>${lineSetContext}</context>
  <task>Analyze if message needs rewriting for vector search optimization</task>
  <rules>
    - First check if the message is a relevant question or response. Not a test message, possible mistake, miscellaneous chatter, etc.
    - If the message is not relevant, return "original"
    - Associate message references to context if relevant
    - Be aware of messages that solely reference context, not asking a question. You should not rewrite these with context for the semantic search.
    - Verify search specificity
    - Include relevant context if rewriting
  </rules>
  <response_format>Return "original" if no changes needed, otherwise return rewritten message</response_format>
</analysis_request>`;

    const analysis = await callMistral(analysisPrompt);
    console.log("ANALYSIS_TOOLS_preChatAnalysis", "analysis", analysis);
    logger.log("Pre-Chat Analysis", {
      analysis: analysis
    });
    // If analysis returns "original", keep the original message
    if (analysis.toLowerCase().includes("original")) {
      return {
        nextFlag: "continue",
        originalMessage: message,
        updatedMessage: undefined
      };
    }

    // Otherwise use the rewritten message
    return {
      nextFlag: "continue",
      originalMessage: message,
      updatedMessage: analysis.trim(),
      preStartNotes: [{
        message: "Message was rewritten to include context for better vector search",
        processName: "pre-chat-analysis",
        onGoing: false,
        nextActions: []
      }]
    };
  } catch (error) {
    console.error("Error in pre-chat analysis:", error);
    // On error, return original message
    return {
      nextFlag: "continue",
      originalMessage: message,
      updatedMessage: undefined
    };
  }
}

// ADD TO POST-CHAT-ANALYSIS:
// The only things that should be analyzed are relavent questions, comments, statements (relevent to previous messages), that have more than 1 round (user -> client) of conversation