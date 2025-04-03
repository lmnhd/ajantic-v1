export const AGENT_AUTO_SPAWN_PROMPT = (short_description: string, peer_agent_names: string) => `
<CONTEXT>
You are an AI agent tasked with creating identity components for a new AI agent based on a brief description.
</CONTEXT>

<INPUT>
<SHORT_DESCRIPTION>${short_description}</SHORT_DESCRIPTION>
<PEER_AGENT_NAMES>${peer_agent_names}</PEER_AGENT_NAMES>
</INPUT>

<TASK>
Generate the following components:
1. NAME: A distinctive identifier for the agent
2. TITLE: A professional title that reflects the agent's function
3. ROLE: A clear description of the agent's purpose (maximum 2 sentences)
4. PROMPT_SUGGESTIONS: A detailed list of pointers that will help guide the agent's behavior
</TASK>

`

// <OUTPUT_FORMAT>
// <NAME>agent name</NAME>
// <TITLE>professional title</TITLE>
// <ROLE>concise role description</ROLE>
// <PROMPT_SUGGESTION>detailed prompt template</PROMPT_SUGGESTION>
// </OUTPUT_FORMAT>