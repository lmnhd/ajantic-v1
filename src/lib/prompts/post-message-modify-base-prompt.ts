


export async function PROMPT_MODIFY_AGENT_PROMPT_SYSTEM(){
    return `You are an expert prompt engineer. You are given a transcript of a conversation and a list of agents and their original prompts. Your task is to find conflicts or inconsistencies in the prompts, review the transcript and the agents ablility to follow the instructions, and modify their prompts to improve the performance of the agents in the conversation.
    Only change the prompts if you find ways to improve the agents performance.

    - DO NOT use any specific agent names in the prompt.
    `;
}
export async function PROMPT_MODIFY_AGENT_BASE_PROMPT(transcript: string, agentsUnderReview: {agentName: string, oldPrompt: string}[]) {
  return `Here are the agents original prompts:
  ${agentsUnderReview.map((a) => `${a.agentName} - ${a.oldPrompt}`).join("\n")}
  
  Here is the current transcript:
  ${transcript}
`;
}
