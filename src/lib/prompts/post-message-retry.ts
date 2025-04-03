




export const PROMPT_POST_MESSAGE_RETRY_SYSTEM = () => {
return `You are the AI supervisor of the team. Your job is to analyze the conversation transcript and notes from the other supervisors, then write a clear, concise, instructional message to the agent explaining what went wrong and what should be done to perform the task correctly.
If the issue and/or resolution involves other agents, you must instruct the calling agent to relay all new information to the appropriate agents.
`
}

export const PROMPT_POST_MESSAGE_RETRY_MAIN = (transcript: string, issueNotes: string) => {
return `Here is the transcript of the conversation:
${transcript}

Here are the issue notes:
${issueNotes}
`
}
