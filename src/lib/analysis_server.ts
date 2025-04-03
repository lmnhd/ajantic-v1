"use server";
import {
  convertToCoreMessages,
  generateObject,
  generateText,
  Message,
  streamText,
} from "ai";
import { SystemPrompts } from "./prompts/system-prompts";
import {
  SERVER_getGeneralPurposeDataMany,
  SERVER_getGeneralPurposeDataSingle,
  SERVER_getGeneralPurposeDBName,
  SERVER_getLast5GeneralPurposeDataMany,
  SERVER_getLastGeneralPurposeDataMany,
  SERVER_storeGeneralPurposeData,
} from "@/src/lib/server";

import { getAIState, getMutableAIState } from "ai/rsc";
import {
  AgentComponentProps,
  AgentFoundationalPromptProps,
  AgentTypeEnum,
  AgentUserResponse,
  AISessionState,
  ContextContainerProps,
  ModelArgs,
  ModelProviderEnum,
  Team,
} from "@/src/lib/types";
import { LangChainAdapter } from "ai";

import { ServerMessage } from "@/src/lib/types";

import {
  MODEL_JSON,
  UTILS_convertLineSetsToContext,
  UTILS_convertServerMessagesToBaseMessages,
  UTILS_getGenericData,
  UTILS_getModelArgsByName,
  UTILS_serverMessagesToTranscript,
} from "@/src/lib/utils";

import { MODEL_getModel_ai } from "./vercelAI-model-switcher";    
import { DYNAMIC_MODEL_NAMES } from "@/src/app/api/model/dynamic-model-names";
import { MistralModelNames } from "@/src/app/api/model/mistral";
import {
  PROMPT_POST_MESSAGE_NOTES,
  PROMPT_POST_MESSAGE_ANALYSIS_WITH_CONTEXT,
} from "./prompts/post-message-analysis";
import { clientInfo } from "./agent-tools/agent-diary";
import {
  PINECONE_deleteVectorsById,
  PINECONE_fetchData,
  PINECONE_listVectors,
} from "@/src/app/api/pinecone";
import { db } from "@/src/lib/db";
import { GeneralPurpose } from "@prisma/client";

import { z } from "zod";

import {
  PROMPT_POST_MESSAGE_RETRY_MAIN,
  PROMPT_POST_MESSAGE_RETRY_SYSTEM,
} from "./prompts/post-message-retry";
import {
  PROMPT_MODIFY_AGENT_BASE_PROMPT,
  PROMPT_MODIFY_AGENT_PROMPT_SYSTEM,
} from "./prompts/post-message-modify-base-prompt";
import { TextChatLogProps } from "./text-chat-log";
import { messageRouter } from "./message-router";
import { MEMORY_store } from "./agent-memory/store-retrieve";
import { logger } from "@/src/lib/logger";
import { GmailService } from "./agent-tools/gmail.server";
import {
  AGENT_FORM_creator,
  AGENT_FORM_reWriteRequestMessage,
} from "./post-message-analysis/agent-request-form-creator";
import { DynamicFormSchema } from "./post-message-analysis/form-creator-core";
import { UTILS_TEAMS_infoRequestContextFormSet } from "./teams/lib/teams-utils";

export async function ANALYSIS_TOOLS_generatePrompt({
  messages,
  toConvert,
  songTitle,
  blockTypeName1,
  numLines1,
  blockTypeName2,
  numLines2,
}: //system,
{
  messages: any;
  toConvert: string;
  songTitle: string;
  numLines1: number;
  blockTypeName1: string;
  numLines2?: number;
  blockTypeName2?: string;
  //system: string;
}) {
  const system = SystemPrompts.songwriterGeniusPrompt2(
    [
      `Your task is to generate a prompt that will help an AI song writer write a ${numLines1} line ${blockTypeName1} ${
        numLines2 && blockTypeName2
          ? `and a ${numLines2} line ${blockTypeName2}`
          : ``
      } about ${songTitle}, and incorporate these qualities:\n ... - "` +
        toConvert +
        `" - ...`,
    ],
    true
  );

  console.log("messages", system);
  //return "hello";
  const result = await generateText({
    model: await MODEL_getModel_ai(UTILS_getModelArgsByName(MODEL_JSON().Anthropic["claude-3-5-sonnet-20240620"].name, 0.5)),
    system: system,
    messages: convertToCoreMessages(messages),
    //prompt: "Analyze the following lyrics",
  });
  console.log("result", result);

  return result.text;
}

export async function ANALYSIS_TOOLS_quickSaveAnalysisPrompt({
  prompt,
  userId,
}: {
  prompt: string;
  userId: string;
}) {
  console.log("quickSaveAnalysisPrompt", prompt, userId);

  const gpName = `AnalysisPrompt-${userId}`;
  const stored = await SERVER_storeGeneralPurposeData(
    prompt,
    userId,
    Date.now().toString(),
    "",
    gpName,
    true
  );
}

export async function ANALYSIS_TOOLS_getAnalysisPrompts({
  userId,
}: {
  userId: string;
}) {
  if (!userId) return [];
  console.log("getAnalysisPrompts", userId);
  const gpName = `AnalysisPrompt-${userId}`;
  return await SERVER_getGeneralPurposeDataMany(gpName);
}

export async function ANALYSIS_TOOLS_saveAIGeneratedPrompt({
  prompt,
  userId,
}: {
  userId: string;
  prompt: string;
}) {
  const gpName = `AIGeneratedPrompt-${userId}`;
  const stored = await SERVER_storeGeneralPurposeData(
    prompt,
    userId,
    Date.now().toString(),
    "",
    gpName,
    true
  );
}

export async function ANALYSIS_TOOLS_getAIGeneratedPrompts({
  userId,
}: {
  userId: string;
}) {
  const gpName = `AIGeneratedPrompt-${userId}`;
  return await SERVER_getGeneralPurposeDataMany(gpName);
}

export async function ANALYSIS_TOOLS_saveAnalysisMessages({
  messages,
  userId,
  index,
}: {
  userId: string;
  messages: any;
  index: number;
}) {
  const gpName = `AnalysisMessages-${userId}-${index}`;
  const stored = await SERVER_storeGeneralPurposeData(
    JSON.stringify(messages),
    userId,
    Date.now().toString(),
    "",
    gpName,
    true
  );
}

export async function ANALYSIS_TOOLS_getAnalysisMessages({
  userId,
  index,
}: {
  userId: string;
  index: number;
}) {
  const gpName = `AnalysisMessages-${userId}-${index}`;
  return await SERVER_getGeneralPurposeDataMany(gpName);
}

// Get last nth stored analysis messages
export async function ANALYSIS_TOOLS_getLastAnalysisMessages({
  userId,
  n,
  index,
}: {
  userId: string;
  n: number;
  index: number;
}) {
  const gpName = `AnalysisMessages-${userId}-${index}`;
  return await SERVER_getLastGeneralPurposeDataMany(gpName, n);
}

export async function ANALYSIS_TOOLS_getLast5AnalysisMessages({
  userId,
  index,
}: {
  userId: string;
  index: number;
}) {
  const gpName = `AnalysisMessages-${userId}-${index}`;
  return await SERVER_getLast5GeneralPurposeDataMany(gpName);
}

export async function ANALYSIS_TOOLS_storeLastAnalysisModelName({
  userId,
  jsonValues,
  chatIndex,
}: {
  userId: string;
  chatIndex: number;
  jsonValues: any;
}) {
  const gpName = `AnalysisModelName-${userId}-${chatIndex}`;
  const stored = await SERVER_storeGeneralPurposeData(
    jsonValues,
    userId,
    Date.now().toString(),
    "",
    gpName,
    false
  );
}

export async function ANALYSIS_TOOLS_getLastAnalysisModelName({
  userId,
  chatIndex,
}: {
  userId: string;
  chatIndex: number;
}) {
  const gpName = `AnalysisModelName-${userId}-${chatIndex}`;
  return await SERVER_getGeneralPurposeDataSingle(gpName);
}

// export async function ANALYSIS_TOOLS_agentTester({
//   message,
//   index,
//   agentName,
//   serializedState,
// }: {
//   message: string;
//   index: number;
//   agentName: string;
//   serializedState: string;
// }) {

//   // const testState = getAIState();
//   // console.log(
//   //   "testState",
//   //   testState[0].currentState.currentAgents[index].systemPrompt
//   // );
//   // console.log(message, index, serializedState)
//   //return;

//   const currentState = JSON.parse(serializedState);
//   const {
//     contextSets,
//     currentAgents,
//     systemPrompt,
//   }: { contextSets: ContextContainerProps[]; currentAgents: any[]; systemPrompt: string } =
//     currentState;

//   console.log("serializedState", serializedState);
//   console.log("contextSets", contextSets);

//   console.log("currentAgents", currentAgents);
//   console.log("systemPrompt", systemPrompt);

//   // return "done";

//   // const USE_THIS_UNTIL_GETSTATE_FIXED: AISessionState =
//   //   JSON.parse(serializedState);

//   console.log("message", message);

//   console.log("index", index);

//   const serverMessageHistory = getMutableAIState();

//   console.log("serverMessageHistory", serverMessageHistory.get());

//   // get current state from aistate
//   // const currentState: AISessionState = USE_THIS_UNTIL_GETSTATE_FIXED;
//   // const currentState: AISessionState =
//   //   serverMessageHistory.get()[serverMessageHistory.get().length - 1]
//   //     .currentState;

//   //return;

//   const messages = [
//     ...serverMessageHistory.get(),
//     {
//       role: "user",
//       content: message,
//       currentState: {
//         ...currentState,
//         currentAgents: [
//           ...currentState.currentAgents,
//           { systemPrompt: "test2" },
//         ],
//       },
//     },
//   ];
//   console.log("messages", messages);
//   // Update the AI state with the new user message.
//   serverMessageHistory.done(messages);

//   // get current agent

//   const currentAgent = currentState.currentAgents[index];
//   //let contextSets = currentState.contextSets;
//   const model = currentAgent.modelArgs;
//   const system = currentAgent.systemPrompt || "";

//   // console.log("currentAgent", currentAgent);
//   // console.log("model", model);
//   console.log("system", system);
//   //console.log("LINESETS PRECHECK...", contextSets);
//   let agent: any;

//   try {
//     agent = await generateLCAgentBasic(
//       system,
//       [model],
//       contextSets,
//       false,
//       messages,
//       agentName
//     );
//   } catch (e) {
//     console.log("error", e);
//     serverMessageHistory.done([
//       ...serverMessageHistory.get(),

//       { role: "assistant", content: "error", currentState, agentName },
//     ]);
//     return {
//       options: {
//         message: "error",
//         index: index,
//         agentName: agentName,
//         serializedState: JSON.stringify({
//           contextSets: contextSets,
//           currentAgents: currentState.currentAgents,
//         }),
//       },
//     };
//   }

//   //console.log("LINESETS CHECK...", contextSets);

//   // return "test";

//   // FOR TESTING

//   // contextSets[0].text = "testing 1 2 3";
//   // contextSets[1].text = "testing 4 5 6";

//   const response = await agent.invoke(
//     {
//       input: message,
//     },
//     {
//       recursionLimit: 10,
//     }
//   );
//   //const response = { output: "testing 1 2 3" };
//   // Update the AI state again with the response from the model.
//   serverMessageHistory.done([
//     ...serverMessageHistory.get(),
//     { role: "assistant", content: response.output, currentState, agentName },
//   ]);

//   const returnObj = {
//     options: {
//       message: response.output,
//       index: index,
//       agentName: agentName,
//       serializedState: JSON.stringify({
//         contextSets: contextSets,
//         currentAgents: currentState.currentAgents,
//         systemPrompt: currentState.currentAgents[index].systemPrompt,
//       }),
//     },
//   } as {
//     options: {
//       message: string;
//       index: number;
//       agentName: string;
//       serializedState: string;
//     };
//   };
//   return returnObj;
// }

export async function ANALYSIS_TOOLS_agentTester2({
  message,

  chatHistory,

  index,

  serializedState,
  userName,
  mission,
}: {
  message: string;

  chatHistory: ServerMessage[];

  index: number;

  serializedState: string;

  userName: string;

  mission: string;
}) {
  // : Promise<{
  //   message: string;

  //   chatHistory: BaseMessage[];

  //   index: number;
  //   serializedState: string;
  //   userName: string;
  //   mission: string;
  // }>
  if (chatHistory.length > 0) {
    // console.log("message", message);
    // console.log("chatHistory", chatHistory);
    // console.log("index", index);
    // console.log("serializedState", serializedState);
    let _aiStateExperiment = getAIState();

    let _exp: {
      contextSets: ContextContainerProps[];
      currentAgents: Team;
      systemPrompt: string;
    } = {
      contextSets: [],
      currentAgents: { agents: [], name: "", objectives: "" },
      systemPrompt: "",
    };

    // console.log("_aiStateExperiment", _aiStateExperiment);

    if (_aiStateExperiment.length > 0) {
      _exp = JSON.parse(
        _aiStateExperiment[_aiStateExperiment.length - 1].currentState
      );
      console.log("***getAIState() STATE FOUND!!!: ");
      const _lineSets = _exp.contextSets;
      const _currentAgents = _exp.currentAgents;
      const _systemPrompt = _exp.systemPrompt;
      console.log("_systemPrompt", _systemPrompt);
      const systemPrompt = _currentAgents.agents[index].systemPrompt;
      //console.log("_currentAgents", _currentAgents);
      console.log("systemPrompt", systemPrompt);
    } else {
      console.log("getAIState() -NO STATE FOUND", _aiStateExperiment);
      //console.log("serializedState", serializedState);
    }
  }

  // console.log("_aiStateExperiment", _aiStateExperiment[_aiStateExperiment.length - 1].currentState.currentAgents[index].systemPrompt);

  const _state: {
    contextSets: ContextContainerProps[];
    currentAgents: Team;
    genericData: any;
  } = JSON.parse(serializedState);
  let userId = _state.genericData.userId;
  let { contextSets, currentAgents } = _state;
  let agentName = currentAgents.agents[index].name;
  let modelNames = currentAgents.agents[index].modelArgs;
  let agentType = currentAgents.agents[index].type;
  let systemPrompt = currentAgents.agents[index].systemPrompt;
  let teamName = currentAgents.name;
  let role = currentAgents.agents[index].roleDescription;
  // let userName = UTILS_getGenericData("userName", {
  //   history: [],
  //   currentState: globalMessages.currentState,
  // });

  // const agent = await langChainBasicAgent(
  //   contextSets,
  //   [modelNames],
  //   false,
  //   {
  //     userName: "test",
  //     skillSet: "test",
  //     role: "test",
  //     tools: ["test"],
  //     peerAgents: ["test"],
  //     context: "test",
  //   }
  // );

  // console.log("chatHistory", chatHistory)
  // return { chatHistory, index, message, serializedState };

  //const response = { output: "testing 1 2 3" };
  // contextSets = [{ text: "This is a test...", setName: "test", lines: [], isDisabled: false}, { text: "This is test 2...", setName: "test", lines: [{type:"line", text: "Test 3", blockNum: 0, blockLength: 0, lineNum: 0}], isDisabled: false}]

  //aiManipulateSetsTest("disabled", "Set 1", contextSets, true);
  // console.log("contextSets after 'manipulate' called...", contextSets);

  // aiManipulateLinesTest("update", "Set 1", "manipulate-test-1", contextSets);
  // const response = await agent.invoke({
  //   input: message,
  //   chat_history: await convertServerMessagesToBaseMessages(chatHistory),
  // });

  const response = await messageRouter(
    message,
    chatHistory,
    currentAgents,
    contextSets,
    [modelNames],

    true,
    userId,
    {
      userName: userName,
      thisAgentName: agentName,
      agentType: agentType,
      userId: userId,
      teamName: teamName,
      directives: [],
      skillSet: systemPrompt,
      context: UTILS_convertLineSetsToContext(contextSets, agentName),
      role: role,
      tools: [],
      peerAgents: currentAgents.agents.filter(
        (agent) => agent.name !== agentName
      ),
      mission: "",
      trainingMode: false,
    } as AgentFoundationalPromptProps,
    false
  );

  console.log("response", response);
  // return {
  //   message: response?.response ?? "",
  //   chatHistory: await UTILS_convertServerMessagesToBaseMessages([
  //     ...chatHistory,
  //     { role: "assistant", content: response?.response ?? "" },
  //   ]),
  //   index: index,
  //   serializedState: JSON.stringify({
  //     ..._state,
  //     contextSets: contextSets,
  //   }),
  //   userName: userName,
  //   mission: mission,
  // };
}

export async function ANALYSIS_TOOLS_autoPrompt({
  userId,
  systemPrompt,
  characterRole,
  characterTitle,
  characterName,
  autoPromptMessages,
  previousPrompts,
  modelArgs,
  extraInfo,
  addExamples,
}: {
  userId: string;
  systemPrompt: string;
  characterRole: string;
  characterTitle: string;
  characterName: string;
  autoPromptMessages: Message[];
  previousPrompts: string[];
  extraInfo?: string;
  modelArgs?: ModelArgs;
  addExamples?: number;
}) {
  try {
    const response = await generateText({
      model: await MODEL_getModel_ai(modelArgs!),
      system: systemPrompt,
      temperature: modelArgs!.temperature,
      messages: convertToCoreMessages([
        ...autoPromptMessages,
        {
          role: "user",
          content: `please create a prompt for this character\n\n
      name: ${characterName}\n
      role: ${characterRole}\n
      title: ${characterTitle}\n
      `,
        },
      ]),
    });
    const dbName = `autoPrompt-${characterName}-${characterTitle}`;
    await SERVER_storeGeneralPurposeData(
      response.text,
      characterName,
      characterRole,
      characterTitle,
      dbName,
      true
    );
    return response.text;
  } catch (e) {
    console.log("error", e);
    return "error";
  }
}

export async function ANALYSIS_TOOLS_getMessageHistoryDailyNames(
  userId: string
) {
  try {
    const response = await db.generalPurpose.findMany({
      where: {
        meta1: userId,
        meta3: "AGENT_CHAT_MESSAGE_HISTORY",
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    if (response.length > 0) {
      // filter duplicates
      const uniqueMessages = new Set(response.map((r: any) => r.meta2));
      return Array.from(uniqueMessages).filter((m: any) => m !== undefined);
    }
    return [];
  } catch (error) {
    console.error("Error getting message history daily names:", error);
    return [];
  }
}

export async function ANALYSIS_TOOLS_retrieveLatestMessageHistoryFromDB(
  userId: string
): Promise<GeneralPurpose[]> {
  try {
    console.log("retrieveMessageHistoryFromDB called from server...");
    const _dbName = await SERVER_getGeneralPurposeDBName(
      "AGENT_CHAT_MESSAGE_HISTORY",
      userId,
      true,
      false
    );
    const history = await SERVER_getGeneralPurposeDataMany(_dbName);
    console.log(
      "retrieveMessageHistoryFromDB history",
      history.length + " messages."
    );
    return history;
  } catch (error) {
    console.error("Error retrieving latest message history:", error);
    return [];
  }
}

export async function ANALYSIS_TOOLS_retrieveMessageHistoryFromDBByName(
  userId: string,
  name: string
): Promise<GeneralPurpose[]> {
  try {
    const history = await db.generalPurpose.findMany({
      where: {
        meta1: userId,
        meta2: name,
      },
    });
    return history;
  } catch (error) {
    console.error("Error retrieving message history:", error);
    return [];
  }
}

// AFTER EACH MESSAGE ROUND: (generateObject({model, system, prompt})):
//1. Verify task completed as requested
//2. If yes - return to client (END)
//3. If no - create new user message OBJECT with suggestions on what was wrong and how to correct
//4. Also, decide if notes should be taken and if so - run post analysis

// The idea is to auto catch issues and correct them via LLM

// auto-modify prompt when troubleshooting tips discovered - evolving the prompt over time

export type PostMessageAnalysisProps = {
  nextFlag:
    | "ANALYSIS"
    | "NOTES"
    | "RETRY"
    | "PASS"
    | "COMPLETE"
    | "FAIL"
    | "INFO_REQUEST"
    | "AUTH_URL"
    | "CONTINUE";
  message: string;
  chatHistory: ServerMessage[];
  userId: string;
  team: Team;
  namesOfAgentsInConvo: string[];
  currentAgentIndex: number;
  state: string;
  iteration: number;
  memoryWorthy: boolean;
  newContext?: ContextContainerProps[];
  requestFormSchema?: {
    schema: DynamicFormSchema;
    formName: string;
    requestingAgentName: string;
    requestMessage: string;
    historyUpToThisPoint: ServerMessage[];
  };
  metaData?: { authUrl?: string; auth?: string; platform?: string };
  forTestingData?: { mockTranscript: string };
};

export async function ANALYSIS_TOOLS_handlePostMessageRoutine(
  props: PostMessageAnalysisProps
): Promise<PostMessageAnalysisProps> {
  // Increase timeout to 60 seconds
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("Post message analysis timeout")), 60000);
  });

  try {
    const result = (await Promise.race([
      ANALYSIS_TOOLS_postMessageAnalysis(props),
      timeoutPromise,
    ])) as PostMessageAnalysisProps;

    // Create a new object to avoid modifying the original props
    let updatedProps = { ...props };

    // if info request - send to FormCreator
    if (result.nextFlag === "INFO_REQUEST") {
      logger.log("INFO_REQUEST received. Creating form schema...");

      // Create form schema using AGENT_FORM_creator
      if (updatedProps.requestFormSchema === undefined) {
        try {
          const formSchema = await AGENT_FORM_creator(updatedProps.message);

          // Update props with form schema
          updatedProps.requestFormSchema = {
            schema: formSchema.schema,
            formName: formSchema.formName,
            requestingAgentName: updatedProps.team.agents[updatedProps.currentAgentIndex].name,
            requestMessage: updatedProps.message,
            historyUpToThisPoint: updatedProps.chatHistory,
          } as PostMessageAnalysisProps["requestFormSchema"];

          // Rewrite the request message
          const rewrittenMessage = await AGENT_FORM_reWriteRequestMessage(
            updatedProps.message,
            formSchema.formName
          );

          updatedProps.newContext = [UTILS_TEAMS_infoRequestContextFormSet(formSchema, [], updatedProps.team.agents[updatedProps.currentAgentIndex] ?? {}, updatedProps.chatHistory ?? [], false)];

          // Update the message in props and add to chat history
          updatedProps.message = rewrittenMessage;
          
          // Create new chat history with the rewritten message
          updatedProps.chatHistory = [
            ...updatedProps.chatHistory.slice(0, -1), // Keep all messages except the last one
            {
              role: "assistant",
              content: rewrittenMessage,
              agentName: updatedProps.team.agents[updatedProps.currentAgentIndex].name,
            } as ServerMessage,
          ];

          logger.log("INFO_REQUEST form schema created. Sending to client...");
        } catch (error) {
          logger.error("Error creating form schema:", error as Record<string, any>);
          // If form creation fails, return PASS to prevent infinite loop
          updatedProps.nextFlag = "PASS";
          return updatedProps;
        }
      }

      // Set the nextFlag to PASS to break the loop
      updatedProps.nextFlag = "PASS";
      return updatedProps;
    }

    if (result.nextFlag === "AUTH_URL") {
      logger.log("AUTH_URL received. Handling authentication...");
      updatedProps.metaData = { authUrl: result.metaData?.authUrl };
      updatedProps.nextFlag = "AUTH_URL";
      return updatedProps;
    }

    // Store memory if analysis is complete or passed
    if (result.nextFlag === "COMPLETE" || result.nextFlag === "PASS") {
      try {
        const state = JSON.parse(updatedProps.state) as AISessionState;
        const agents: {
          name: string;
          roleDescription: string;
          title: string;
        }[] = updatedProps.namesOfAgentsInConvo.map(
          (name) =>
            state.currentAgents.agents.find((a) => a.name === name) as {
              name: string;
              roleDescription: string;
              title: string;
            }
        );
        if (result.memoryWorthy) {
          await MEMORY_store(updatedProps.chatHistory, agents, updatedProps.userId);
        }
      } catch (error) {
        console.error("Error storing memory:", error);
      }
    }

    return {
      ...updatedProps,
      nextFlag: result.nextFlag,
      message: result.message,
      memoryWorthy: result.memoryWorthy,
      metaData: result.metaData,
    };
  } catch (error) {
    console.error("Post message analysis error or timeout:", error);
    
    // Handle overloaded state specifically
    if (error instanceof Error && error.message.includes("Overloaded")) {
      logger.error("Service overloaded, returning PASS to prevent infinite loop");
      return {
        ...props,
        nextFlag: "PASS",
        message: "Service temporarily overloaded, please try again",
      };
    }

    return {
      ...props,
      nextFlag: "FAIL",
      message:
        "Analysis timed out or failed: " +
        (error instanceof Error ? error.message : String(error)),
    };
  }
}

// post message analysis
async function ANALYSIS_TOOLS_postMessageAnalysis(
  props: PostMessageAnalysisProps,
  textChatLogs?: TextChatLogProps[]
): Promise<PostMessageAnalysisProps> {
  // if props.requestFormSchema is defined, return props
  // if (props.requestFormSchema !== undefined) {
  //   return props;
  // }
  try {
    const response = await generateObject({
      model: await MODEL_getModel_ai({
        modelName: "gpt-4o-mini",
        provider: ModelProviderEnum.OPENAI,
        temperature: 0,
      }),
      messages: [
        {
          role: "system",
          content: `
<purpose>
You are a message analyzer determining if messages require further action.
</purpose>

<instructions>
    <instruction>Return PASS for irrelevant messages, chatter, or conversations under 2 rounds.</instruction>
    <instruction>Associate message references to context if relevant.</instruction>
    <instruction>For FAIL, include brief reason.</instruction>
    <instruction>For INFO_REQUEST, return when an agent needs specific data to proceed (like URLs, credentials, or other structured information).</instruction>
</instructions>

<output-values>
    <value name="PASS">Default response - pass message back to client.</value>
    <value name="FAIL">Message indicates error (include reason).</value>
    <value name="COMPLETE">Task is complete.</value>
    <value name="ANALYSIS">Message needs further analysis.</value>
    <value name="INFO_REQUEST">Return when:
        1. Agent needs specific data to proceed (URLs, credentials, etc.)
        2. Agent is requesting structured information
        3. Agent needs user input to continue their task
        Examples:
        - "Please provide the YouTube video URL"
        - "I need your email address"
        - "Could you share the document link?"
    </value>
    <value name="AUTH_URL">STRICT: ONLY if message contains BOTH:
        1. Explicit URL
        2. Request for authentication
        Otherwise return PASS.
        <example>
          <invalid>"Please authorize your Google account to continue."</invalid>
          <valid>"Click here to authorize: https://oauth.example.com/auth"</valid>
        </example>
    </value>
</output-values>
          `,
        },

        {
          role: "user",
          content: props.message,
        },
      ],
      schema: z.object({
        result: z.enum([
          "PASS",
          "FAIL",
          "COMPLETE",
          "ANALYSIS",
          "AUTH_URL",
          "INFO_REQUEST",
        ]),
        memoryWorthy: z
          .boolean()
          .describe(
            "Whether the message is worth remembering later. If true, the message will be stored in the memory database."
          ),
        reason: z.string().describe("Brief explanation for the decision"),
        metaData: z
          .object({
            authUrl: z
              .string()
              .optional()
              .describe("The URL for authentication"),
            platform: z
              .string()
              .optional()
              .describe(
                "The platform for authentication (gmail, facebook, etc.)"
              ),
          })
          .optional(),
      }),
    });

    console.log("response", response.object);
    try {
      const state = JSON.parse(props.state) as AISessionState;
      console.log(
        "Model used for task: ",
        state.currentAgents.agents[props.currentAgentIndex].modelArgs.modelName
      );
    } catch (e) {
      console.log("No model used for task");
    }

    return {
      ...props,
      nextFlag: response.object.result,
      message: response.object.reason,
      memoryWorthy: response.object.memoryWorthy,
      metaData: response.object.metaData,
    };
  } catch (error) {
    console.error("Error in post message analysis:", error);
    return {
      ...props,
      nextFlag: "FAIL",
      message:
        "Analysis failed: " +
        (error instanceof Error ? error.message : String(error)),
    };
  }
}

// post message retry prompt generation
async function ANALYSIS_TOOLS_postTaskRetryMessage(
  props: PostMessageAnalysisProps,
  promptProps: AgentFoundationalPromptProps,
  modelNames: ModelArgs
): Promise<PostMessageAnalysisProps> {
  return { ...props, nextFlag: "COMPLETE" };
  // get transcript
  const transcript = UTILS_serverMessagesToTranscript(props.chatHistory);
  const message = props.message;
  const _state = JSON.parse(props.state) as AISessionState;
  const systemPrompt = await PROMPT_POST_MESSAGE_RETRY_SYSTEM();
  const mainPrompt = await PROMPT_POST_MESSAGE_RETRY_MAIN(transcript, message);
  const response = await generateObject({
    model: await MODEL_getModel_ai({
      modelName: "gpt-4o-mini",
      provider: ModelProviderEnum.OPENAI,
      temperature: 0.5,
    }),
    system: systemPrompt,
    prompt: mainPrompt,
    schema: z.object({
      message: z.string(),
    }),
  });
  const _response: AgentUserResponse = (await messageRouter(
    response.object.message,
    props.chatHistory,
    props.team,
    _state.contextSet.sets,
    [modelNames],
    true,
    props.userId,
    promptProps,
    false,
    false
  )) as AgentUserResponse;
  return {
    ...props,
    message: _response?.response as string,
    chatHistory: _response?.history ?? [],
    state: JSON.stringify(_state),
  };
}

// post message notes
async function ANALYSIS_TOOLS_postMessageNotes(
  props: PostMessageAnalysisProps
): Promise<PostMessageAnalysisProps> {
  const agentNames = Array.from(
    new Set(
      props.chatHistory.map((m) => m.agentName).filter((n) => n !== undefined)
    )
  );
  const _state = JSON.parse(props.state) as AISessionState;
  const tranScriptWithNames = UTILS_serverMessagesToTranscript(
    props.chatHistory
  );
  const taskContext = UTILS_convertLineSetsToContext(
    _state.contextSet.sets,
    _state.currentAgents.agents[props.currentAgentIndex].name
  );
  const teamName = props.team.name;
  let responseText = "";
  //return "test complete"
  try {
    const response = await generateText({
      model: await MODEL_getModel_ai({
        modelName: MistralModelNames["open-mixtral-8x7b"],
        provider: ModelProviderEnum.MISTRAL,
        temperature: 0.5,
      }),
      system: `Your are a uniquely designed AI Assistant who's sole purpose is to take notes based on a post task conversation.
      ${await PROMPT_POST_MESSAGE_NOTES(
        agentNames,
        taskContext,
        props.userId,
        props.team.name
      )}
      
      `,
      prompt: `Here is the current transcript: 
      ${tranScriptWithNames}`,
    });
    responseText = response.text;
    if (!responseText.includes("NO NOTES")) {
      for (const agentName of agentNames) {
        await clientInfo({
          agentName,
          notes: responseText,
          teamName: props.team.name,
          userId: props.userId,
        });
      }
    }
  } catch (error) {
    console.error("Error in post message analysis:", error);
    return props;
  }
  props = await ANALYSIS_TOOLS_modifyAgentBasePrompt(props, agentNames);
  return {
    ...props,
    nextFlag: "NOTES",
    message: `POST_MESSAGE_NOTES. ${responseText}`,
  };
}

async function ANALYSIS_TOOLS_postTaskFAILED(
  props: PostMessageAnalysisProps
): Promise<PostMessageAnalysisProps> {
  return props;
}

// modify agent base prompt if something was learned to better guide the agent next time
async function ANALYSIS_TOOLS_modifyAgentBasePrompt(
  props: PostMessageAnalysisProps,
  agentsUnderReview: string[]
) {
  const _state = JSON.parse(props.state) as AISessionState;
  const _team = _state.currentAgents;
  const _agentsUnderReveiw = _team.agents.filter((a) =>
    agentsUnderReview.includes(a.name)
  );
  const result = await generateObject({
    model: await MODEL_getModel_ai({
      modelName: "gpt-4o-mini",
      provider: ModelProviderEnum.OPENAI,
      temperature: 0.5,
    }),
    system: await PROMPT_MODIFY_AGENT_PROMPT_SYSTEM(),
    prompt: await PROMPT_MODIFY_AGENT_BASE_PROMPT(
      UTILS_serverMessagesToTranscript(props.chatHistory),
      _agentsUnderReveiw.map((a) => ({
        agentName: a.name,
        oldPrompt: a.systemPrompt ?? "",
      }))
    ),
    schema: z.array(
      z.object({
        agentName: z.string(),
        newPrompt: z.string(),
      })
    ),
  });
  let _message = "The following agent prompts were modified...\n";
  if (result.object.length > 0) {
    for (const agent of result.object) {
      const _agent = _team.agents?.find((a) => a.name === agent.agentName);
      if (_agent) {
        _message += `${agent.agentName}\n - original: ${_agent.systemPrompt} \n - new: ${agent.newPrompt}\n`;

        _agent.systemPrompt = agent.newPrompt;
      }
    }
  }
  _state.currentAgents = _team;
  props.state = JSON.stringify(_state);
  props.message = _message;

  return props;
}

export const ANALYSIS_TOOLS_deleteKnowledgeBaseItem = async (
  ids: string[],
  namespace: string
) => {
  const response = await PINECONE_deleteVectorsById(ids, namespace);
  console.log("response", response);
  return response;
};

export const ANALYSIS_TOOLS_listPineconeVectors = async (namespace: string) => {
  const response = await PINECONE_listVectors(namespace);
  console.log("response", response);
  return response;
};

export const ANALYSIS_TOOLS_fetchAllDataInNameSpace = async (
  namespace: string
) => {
  console.log("namespace", namespace);
  const response = await PINECONE_fetchData(namespace);
  console.log("response", response);
  return response;
};
