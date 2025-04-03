// Is this something that should always be remembered?

import { SERVER_getGeneralPurposeDataMany } from "@/src/lib/server";
import { DYNAMIC_NAMES } from "@/src/lib/dynamic-names";
import { UTILS_convertLineSetsToContext } from "@/src/lib/utils";
import { AISessionState, Team } from "@/src/lib/types";
import { PostMessageAnalysisProps } from "../analysis_server";

export const PROMPT_POST_MESSAGE_NOTES = async (
  agentNames: string[],
  taskContext: string,
  userId: string,
  teamName: string
) => {
  return `Here are some basic guidelines to follow during analysis:
    
  - Is there something in this conversation, relevant to the task context, that should always be remembered?  
  - If the conversation is relevant and contributes to the team's knowledge base, make notes of the important points. Use your best judgement as to what is important and what is not. We trust you!
  - Only return the notes and no other conversation!

  Things that should always be remembered: 
    - When problems are encountered | note the problem (PROBLEM: <name of problem> - <problem>)
    - When solutions are found | note the solution (SOLUTION: <name of problem> - <solution>)
    - When important information is discovered | note the information (INFORMATION: <name of information> - <information>)
    - Any important lessons to be learned? Like things NOT to do or HOW to do something BETTER? etc. | note the lesson (LESSON: <name of lesson> - <lesson>)

    All notes should be written in a compressed markdown format. Use as few tokens as possible while remaining concise.

    ***IMPORTANT: Many times the conversation will not make sense because of small talk and/or troubleshooting. You must use best judgement when deciding whether or not something should be noted. Take notes ONLY when there is a clear issue within a cohesive discussion! You will respond with "NO NOTES" more often than not. ***

    ***IMPORTANT: Always remember that the conversation is NOT TO YOU! You are simply eavesdropping on a conversation and determining whether or not the Client will want notes taken and then taking the notes if you decide "yes, this is something that the Client will want everybody to remember!". Otherwise... "NO NOTES"***


    <EXAMPLE_1>
    MESSAGES:
    "user": "Hello there!"
    "Candy": "Hello! How can I assist you today?"
    "user": "I need to know the score from last night's game."
     - "Candy": "to Earl Scraper: can you find the score to last nights Monday night football game?"
     - "Earl Scraper": "I'm trying to scrape data from https://example.com/products but getting a 403 error"
    "Candy": "I was unable to find the score to last nights game due to a technical issue."

    RESPONSE:
    PROBLEM: Web Scraping 403 Error - Unable to scrape website due to rate limiting/bot detection

    </EXAMPLE_1>
    
    <EXAMPLE_2>
    MESSAGES:
    "user": "Hello there!"
    "Candy": "Hello! How can I assist you today?"
    "user": "I need to know the score from last night's game."
     - "Candy": "to Earl Scraper: can you find the score to last nights Monday night football game using the new proxy?"
     - "Earl Scraper": "COMPLETE: <score from last night's game in raw data>"
    "Candy": "The score from last night's game is 10-5. Is there anything else you need?"

    RESPONSE:
    SOLUTION: Web Scraping 403 Error - Use new proxy for web scrape; See raw data from problem.
    </EXAMPLE_2>

    <TASK_CONTEXT>
    ${taskContext}
    </TASK_CONTEXT>

    You only need to take notes if there is one or more agents that don't already have those particular notes or similar notes: 
    <EXISTING_NOTES>
    ${await getAllNotesForAgents(agentNames, userId, teamName)}
    </EXISTING_NOTES>
    If there are the same notes for some of the current agents but not all, continue as if no agent has the notes.
  `;
};
export const PROMPT_POST_MESSAGE_ANALYSIS_WITH_CONTEXT = async (
  props: PostMessageAnalysisProps,
  useContext: boolean
): Promise<string> => {
  return `Your are the AI supervisor of the team. Your job is to analyze the conversation as it continues between the worker agents and Client, and deciding what action should be taken next. 'Pass' will continue the conversation without action, 'Complete', 'Notes', 'Retry', and 'Fail' are the other options.
    Here are the conditions for each option:

    - No response from the agent (last message is from agent and is empty) - RETRY
    - The task was completed with deviations from the original request - RETRY
    - The task was re-tried and failed less than 3 times - RETRY
    - The task was completed but not as requested - RETRY
    - The message returned from an agent is empty - RETRY
    - ${
      useContext
        ? "The task has been completed, but the PROJECT_CONTEXT does not reflect the correct changes - RETRY"
        : "The results of a task do not correlate with the message results - RETRY"
    }
    
    - The task has been completed, but with issues that were addressed - NOTES 
    - The task was repeated multiple times before COMPLETE - NOTES
    - The Client requests a task modification and the agent has completed it - NOTES
    - Important task related information is discovered - NOTES
    - The Client asks for something to be remembered - NOTES
    
    - There appears to be a mis-communication between agents - FAIL
    - The task has completed incorrectly more than twice - FAIL
    
    - The conversation is small talk and no action is needed - PASS
    - The conversation is currently in between discussing actions or decisions (last message is client) - PASS
    
    - The task has been completed as requested without issues the first time - COMPLETE


    1. Carefully review the transcript as it is so far. (May likely be mid-conversation which is passable)
    2. For complete conversations, determine the initial request if applicable, study the back and forth between the requestor/client, and agents, and review the outcome (check the context as well as the transcript to verify completion).
    3. Choose the most appropriate result.
    4. For any option other than 'PASS' or 'COMPLETE', Provide a detailed explanation for your choice.

    ***IMPORTANT: If the last message is from an agent but its content is empty, this is likely a retry. All agents MUST return a response. No empty messages are allowed.
    **NOTE: The team objective is mainly for extra context which may or may not be useful. Some conversations may not have a direct relation to the team objective. This is ok.

    Here is the teams objective:
    <TEAM_OBJECTIVE>
    ${props.team.objectives}
    </TEAM_OBJECTIVE>
    
    ${useContext ? contextExample1 + "\n\n" + contextExample2 + "\n\n" + contextExample3 : noContextExample1}
    `;
};

const getAllNotesForAgent = async (
  agentName: string,
  userId: string,
  teamName: string
) => {
  const list = await SERVER_getGeneralPurposeDataMany(
    DYNAMIC_NAMES.db_client_info(agentName, userId)
  );

  const notes = list
    .map((note) => `${note.meta1} - ${note.content}`)
    .join("\n");

  return notes;
};

const getAllNotesForAgents = async (
  agentNames: string[],
  userId: string,
  teamName: string
) => {
  const notes = await Promise.all(
    agentNames.map((agentName) =>
      getAllNotesForAgent(agentName, userId, teamName)
    )
  );
  return notes.join("\n");
};

const contextExample1 = `
<EXAMPLE1-CONTEXT & TRANSCRIPT>

    

    Here is a transcript to analyze:

CLIENT:  hi there Line Master!

ASSISTANT-LINE MASTER: Hello! How can I assist you today?

CLIENT:  lets add a test set to the context.

<PROJECT_CONTEXT>

</PROJECT_CONTEXT>

ASSISTANT-LINE MASTER: COMPLETE: A new set titled "test" with the text "hello there" has been added to the context.

<PROJECT_CONTEXT>

    <test>
      hello there 
    </test>

    </PROJECT_CONTEXT>

</EXAMPLE1-CONTEXT & TRANSCRIPT>

<EXAMPLE1-RESPONSE>
{result: 'COMPLETE'}
</EXAMPLE1-RESPONSE>
`;
const contextExample2 = ` 
<EXAMPLE2-CONTEXT & TRANSCRIPT>
    Here is a transcript to analyze:

CLIENT: hello

ASSISTANT-LINE MASTER: Hello! How can I assist you today?

CLIENT: get a random line and add it to the context under the title "Random Line 1"

<PROJECT_CONTEXT>
    <test>
        hello there
    </test>
</PROJECT_CONTEXT>

ASSISTANT-LINE MASTER: COMPLETE

<PROJECT_CONTEXT>
    <test>
        hello there
    </test>

    <New Set 1>
        this is a random line!
    </New Set 1>
</PROJECT_CONTEXT>

</EXAMPLE2-CONTEXT & TRANSCRIPT>

<EXAMPLE2-RESPONSE>
{result: "RETRY", reason: "The title of the added set does not match the request. Context set title should be 'Random Line 1' instead of 'New Set 1'"}
</EXAMPLE2-RESPONSE>
`;
const contextExample3 = `
<EXAMPLE3-CONTEXT & TRANSCRIPT>
    Here is a transcript to analyze:

CLIENT: hello

ASSISTANT-LINE MASTER: Hello! How can I assist you today?

CLIENT: add a random quote to the context under "Quote 1"

<PROJECT_CONTEXT>
    <test>
        hello world
    </test>
</PROJECT_CONTEXT>

ASSISTANT-LINE MASTER: I've added the quote "To be or not to be, that is the question" to the context under "Quote 1".

<PROJECT_CONTEXT>
    <test>
        hello world
    </test>
</PROJECT_CONTEXT>

</EXAMPLE3-CONTEXT & TRANSCRIPT>

<EXAMPLE3-RESPONSE>
{result: "RETRY", reason: "Assistant claimed to add content to context but did not actually modify the context. The quote should have been added under 'Quote 1' but was only mentioned in the response."}
</EXAMPLE3-RESPONSE>
`;
const noContextExample1 = `
<EXAMPLE1-TRANSCRIPT>

CLIENT:  hello

ASSISTANT-HOOK HARBINGER: Hello! Are there any hooks you would like me to work on?

CLIENT: No, I need you to generate a list of 5 musical band names

ASSISTANT-HOOK HARBINGER: COMPLETE: Here are 5 musical band names:
  1. The Beatles
  2. Queen
  3. Nirvana
  4. The Rolling Stones
  5. AC/DC

</EXAMPLE1-TRANSCRIPT>

<EXAMPLE1-RESPONSE>
{result: 'COMPLETE'}
</EXAMPLE1-RESPONSE>
`;
