"use server";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { createToolCallingAgent } from "langchain/agents";
import { AgentExecutor } from "langchain/agents";
import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import {
  AgentComponentProps,
  AgentTypeEnum,
  AI_Agent_Tools,
  AISessionState,
  AppFrozenState,
  GlobalMessages,
  ModelArgs,
  ModelProviderEnum,
  Team,
} from "@/src/lib/types";
import { generateText } from "ai";

import {
  _testAgentTool,
  LOAD_AGENT_TOOLS
} from "@/src/lib/agent-tools/load-agent-tools";

import { LC_PLAYWRIGHT_loadPage } from "@/src/lib/agent-tools/lc-playwright";
import { AGENT_TOOLS_puppeteer } from "@/src/lib/agent-tools/puppeteer-tool/puppeteer";
import {
  TOOLFUNCTION_htmlToVectorStore,
  TOOLFUNCTION_queryHTML,
} from "@/src/lib/agent-tools/parsers/html-vectorstore";
import { GLOBAL_getPuppeteerClient } from "@/src/lib/puppeteer_client";

import { Browser } from "puppeteer-core";
import { MODEL_getModel_ai } from "@/src/lib/vercelAI-model-switcher";
//import { getOpenAIModelNamesOnline, "gpt-4o-mini" } from "../model/openai";

import {
  SERVER_getGeneralPurposeDataMany,
  SERVER_getGeneralPurposeDataSingle,
  SERVER_getRandomLines,
  SERVER_saveCommonAgentState,
  SERVER_storeGeneralPurposeData,
} from "@/src/lib/server";

import { MemoryVectorStore } from "langchain/vectorstores/memory";
import {
  PINECONE_deleteVectorsById,
  PINECONE_fetchData,
  PINECONE_listVectors,
  PINECONE_search,
  PINECONE_upsertAsVector,
} from "../pinecone";
import { Document } from "langchain/document";
import {
  ANALYSIS_TOOLS_handlePostMessageRoutine,
  PostMessageAnalysisProps,
} from "@/src/lib/analysis_server";
import { ServerMessage } from "@/src/lib/types";
import { agentChannelMessageRouter } from "@/src/lib/agent-channels";
import { DYNAMIC_NAMES } from "@/src/lib/dynamic-names";

import { __initAIState } from "@/src/lib/lyric-helpers";
import { useGlobalStore } from "@/src/lib/store/GloabalStoreState";
import { _randomBlock, _similaritySearchLine } from "../tools";
import { AGENT_AUTO_SPAWN } from "@/src/lib/agent-auto-spawn";
import { revalidatePath } from "next/cache";
//import {  } from "@langchain/community/document_transformers";
//import { CHROMIUM_loadPage } from "@/app/(main)/research/analysis/lib/agent-tools/chromium";

import { headers } from "next/headers";
import {
  MEMORY_retrieve,
  MEMORY_store,
} from "@/src/lib/agent-memory/store-retrieve";

import {
  UTILS_convertLineSetsToContext,
  UTILS_loadAgentGlobalPrompt,
} from "@/src/lib/utils";
import { db } from "@/src/lib/db";
import { APP_FROZEN_store } from "@/src/lib/app-frozen";
import { ContextContainerProps, GeneralPurpose } from "@prisma/client";
import {
  CONVERSATION_store,
  formatDayName,
} from "@/src/lib/conversation";
import { kbSiteMethodChooser } from "../kb-site/kb-site-method-chooser";
import { TOOLSACTION_DYNAMIC_SCRIPT_EVALUATEANDCREATE } from "@/src/lib/agent-tools/dynamic-tool/dynamic-action-core";

export const PLAYGROUND_langChainBasicAgent = async (
  chatHistory: (AIMessage | HumanMessage)[],
  contextSets: ContextContainerProps[]
) => {
  const llm = new ChatOpenAI({
    model: "gpt-4o-mini",
  });

  const magicTool = tool(
    async ({ input }: { input: number }) => {
      return `${input + 2}`;
    },
    {
      name: "magic_function",
      description: "Applies a magic function to an input.",
      schema: z.object({
        input: z.number(),
      }),
    }
  );

  const tools = [magicTool];

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are a helpful assistant"],
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
    ["placeholder", "{agent_scratchpad}"],
  ]);

  const agent = createToolCallingAgent({
    llm,
    tools,
    prompt,
  });
  const agentExecutor = new AgentExecutor({
    agent,
    tools,
  });

  return agentExecutor;
};

export const PLAYGROUND_testAgentic = async () => {
  //const weather = new WeatherClient();
  // const result = await generateText({
  //   model: openai('gpt-4o-mini') as any,
  //   tools: createAISDKTools(weather),
  //   toolChoice: 'required',
  //   temperature: 0,
  //   system: 'You are a helpful assistant. Be as concise as possible.',
  //   prompt: 'What is the weather in San Francisco?'
  // })
  // console.log(result.toolResults[0])
};
export const PLAYGROUND_testRandomLineTool = async () => {
  const response = await _testAgentTool();
  console.log("response", response);
  return response;
};

export const PLAYGROUND_testScrapeUrlTool = async () => {
  // const response = await TOOLFUNCTION_crawlUrl("https://www.stationx.net/");
  // const response = await TOOLFUNCTION_scrapeUrl("https://www.stationx.net");
  // const response = await AGENT_PROCESS_documentInfo("research and write a 1 page cheat sheet for an AI agent creating a new gmail account.", "AI_Create_GMAIL_cheatsheet");
  // const response = await TEST_PUPPETER_BROWSER();
  // console.log("response", response);
  const response = "";
  return response;
};
// export const PLAYGROUND_testToolFunctionContextSets = async (
//   sets: ContextContainerProps[],
//   instructions: string
// ) => {
//   sets = await _testToolFunctionContextSets(sets, instructions, []);
//   //console.log("sets", sets);
//   return sets;
// };
export const PLAYGROUND_testLC_PLAYWRIGHT_loadPage = async (url: string) => {
  const response = await LC_PLAYWRIGHT_loadPage(url);
  console.log("response", response);
  return response;
};
// export const PLAYGROUND_testCHROMIUM_loadPage = async () => {
//   const response = await CHROMIUM_loadPage();
//   console.log("response", response);
//   return response;
// };
//https://www.stationx.net/
export const PLAYGROUND_testTOOLFUNCTION_puppeteer = async () => {
  // const response = await TOOLFUNCTION_puppeteer(
  //   {
  //     url: "https://www.google.com/",
  //     action: "page.content",
  //     mode: "html",
  //   },
  //   "local"
  // );
  // console.log("response", response);
  // const response2 = await TOOLFUNCTION_puppeteer({
  //   url: "https://www.google.com/",
  //   action: "page.content",
  // }, "local");
  // console.log("response2", response2);
  // return response2;
  // const response2 = await TOOLFUNCTION_puppeteer({
  //   url: "https://www.google.com/",
  //   action: "page.content",
  // }, "local");
  // console.log("response2", response2);
  // return response2;
};

// test htmlQuery
export const PLAYGROUND_testTOOLFUNCTION_htmlQuery = async () => {
  console.log("PLAYGROUND_testTOOLFUNCTION_htmlQuery");

  const browser: Browser = await GLOBAL_getPuppeteerClient("local");

  const _numPages = (await browser.browserContexts()[0].pages()).length;
  const page =
    (await browser.browserContexts()[0].pages())[_numPages - 1] ||
    (await browser.newPage());

  // await page.setDefaultNavigationTimeout(0);

  await page.goto("www.yahoo.com", { timeout: 0, waitUntil: "networkidle0" });
  // await new Promise((resolve) => setTimeout(resolve, 20000));
  const testHTML = await page.content();
  const metadata = {
    url: page.url(),
    title: await page.title(),
  };
  //await page.close();

  console.log("waiting 10 seconds");

  await new Promise((resolve) => setTimeout(resolve, 1000));

  //console.log("PLAYGROUND_testTOOLFUNCTION_HTML", testHTML);

  // const _store = await TOOLFUNCTION_htmlToVectorStore({
  //   html: testHTML,
  //   metaData: metadata,
  // }, new VectorStoreRetriever({vectorStore: new InMemoryStore()}));

  console.log("PLAYGROUND_testTOOLFUNCTION_HTML");

  // const test = await _store.vectorStore.similaritySearch(
  //   "Vice President Harris!",
  //   10
  // );

  // console.log("test", test);

  // const response = await TOOLFUNCTION_queryHTML(
  //   {
  //     query: "Top story!",
  //   },
  //   _store
  // );

  // console.log("response", response);
  // return response;
};

export const PLAYGROUND_testPuppeteerAgent = async () => {
  const vc: MemoryVectorStore = await MemoryVectorStore.fromDocuments(
    [],
    new OpenAIEmbeddings()
  );

  // console.log("Starting Test...", { ...AGENT_TOOLS_puppeteer("local") });

  const response = await generateText({
    model: (await MODEL_getModel_ai({
      modelName: "gpt-4o-mini",
      provider: ModelProviderEnum.OPENAI,
      temperature: 0,
    })) as any,
    prompt:
      "THIS IS A TEST...Goto Amazon's home page, then page.content the content as HTML using the puppeteer tools. Afterwards, query the text content for 'Prime Shipping' using the queryHTML tool.",
    tools: { ...AGENT_TOOLS_puppeteer("local", vc, []) },
    maxSteps: 10,
  });
  console.log("response", response.text);

  return response.text;

  //const vc: VectorStoreRetriever | null = null;

  // const testHTML = await _loadWebPageAndReturnHTML("https://www.msn.com/en-us/channel/topic/News/tp-Y_46b78bbb-31c4-4fc5-8a4a-858072348d06");

  // await SERVER_storeGeneralPurposeData(testHTML, "testHTML", "playground", "testPuppeteerAgent", "testHTML", false);

  //  const testHTML = (await SERVER_getGeneralPurposeDataSingle("testHTML")).content;

  // return testHTML
};

async function _loadWebPageAndReturnHTML(url: string) {
  const browser: Browser = await GLOBAL_getPuppeteerClient("local");

  console.log("step 1 complete");

  const page =
    (await browser.browserContexts()[0].pages())[0] ||
    (await browser.newPage());

  console.log("step 2 complete");

  await page.goto(url, { timeout: 0, waitUntil: "domcontentloaded" });

  console.log("step 3 complete");

  const testHTML = await page.content();

  console.log("step 4 complete", testHTML.length);

  // await page.close();
  return testHTML;
}

export const PLAYGROUND_testTOOLFUNCTION_htmlToVectorStore =
  async (): Promise<void> => {
    console.log("PLAYGROUND_HTML-TO-VEC");
    const timer = new Date();
    // const loader = new CheerioWebBaseLoader(
    //   "https://www.cnn.com/"
    // );
    const _html = (await SERVER_getGeneralPurposeDataSingle("testHTML"))
      .content;

    //const _text = htmlToText(_html)

    //console.log("step 1 complete...", _text.length)
    //return _text

    // // const docs = await loader.load();
    // console.log("step 0 complete...", _html.length)

    // const splitter = RecursiveCharacterTextSplitter.fromLanguage("html",
    //   {chunkSize: 1200, chunkOverlap: 200 }
    // );
    // const splitter = new RecursiveCharacterTextSplitter({
    //   chunkSize: 1200,
    //   chunkOverlap: 200,

    // })
    //-----------------------------
    // console.log("step 2 complete...")

    // const transformer = new MozillaReadabilityTransformer();
    // console.log("step 3 complete...")

    // const sequence = splitter.pipe(transformer);
    // console.log("step 4 complete...")

    // const newDocuments = await sequence.invoke([{pageContent: _html.slice(0, 100000), metadata: {url: "https://www.cnn.com/", title: "CNN"}}]);

    // console.log("step 5 complete...", (new Date().getTime() - timer.getTime()).toString())
    // console.log(newDocuments.length, newDocuments[0]);

    // const vc = await TOOLFUNCTION_htmlToVectorStore({html: _html, metaData: {url: "https://www.msn.com/en-us/channel/topic/News/tp-Y_46b78bbb-31c4-4fc5-8a4a-858072348d06", title: "MSN"}})

    // const result = await vc.vectorStore.similaritySearch("Kamala Harris", 10)
    // // run through readability

    // console.log("result", result)
  };

// export const PLAYGROUND_testLOAD_AGENT_TOOLS = async () => {
//   const vec = await MemoryVectorStore.fromDocuments([], new OpenAIEmbeddings());
//   console.log(
//     "LOAD_AGENT_TOOLS - ",
//     LOAD_AGENT_TOOLS(
//       [AI_Agent_Tools.PUPPETEER, AI_Agent_Tools.CONTEXT_SETS],
//       {},
//       [],
//       vec,
//       [],

//     )
//   );
// };

export const PLAYGROUND_test_randomBlock = async (
  verseOrChorus: "verse" | "chorus"
) => {
  const response = await _randomBlock(verseOrChorus);
  console.log("response", response);
  return response;
};

export const PLAYGROUND_test_similaritySearchLine = async (
  query: string,
  numResults: number
) => {
  const response = await _similaritySearchLine(query, numResults);
  console.log("response", response);
  return response;
};

export const PLAYGROUND_test_SERVER_getRandomLines = async (
  numResults: number
) => {
  const response = await SERVER_getRandomLines(numResults);
  console.log("response", response);
  return response;
};

export const PLAYGROUND_test_PINECONE_upsertAsVector = async (
  doc: string,
  namespace: string
) => {
  const response = await PINECONE_upsertAsVector(doc, namespace);
  console.log("response", response);
  return response;
};

// export const PLAYGROUND_test_ANALYSIS_TOOLS_postMessageAnalysis = async (
//   chatHistory: ServerMessage[]
// ) => {
//   const response = await ANALYSIS_TOOLS_postMessageAnalysis({
//     chatHistory,
//     userId: "test",
//     teamName: "test team",
//     taskContext: "we are building the greatest agentic workflow ever!",
//   });
//   console.log("response", response);
//   return response;
// };

// Test basicAgentChat whith agent-to-agent chat
export const PLAYGROUND_test_basicAgentChat = async (
  globalMessages: GlobalMessages
) => {
  const userId = globalMessages.currentState.userId;
  const dbName = `AgentState-${userId}`;
  const result = await SERVER_getGeneralPurposeDataSingle(dbName, "all");
  const _team: Team = JSON.parse(result.content).agents;
  console.log("TEAM:", _team.agents.map((agent) => agent.name).join("|"));
  const _thisAgent = _team.agents[1];

  //console.log("TEST_PLAYGROUND_test_basicAgentChat -> _thisAgent", _thisAgent);
  //return ""
  const response = await agentChannelMessageRouter(
    "Lynn Lyric::: Can you tell Agent Chief to ask Line Master to generate 5 random lines for me to read?",
    // "Lynn Lyric::: Can you tell Agent Chief to ask Dexter to add 2 sets for both our names?",
    [],
    _team,
    [],
    [_thisAgent.modelArgs],
    false,
    {
      directives: _thisAgent.promptDirectives || [],
      context: "",
      mission: _team.objectives || "",
      userName: "Nathaniel",
      thisAgentName: _thisAgent.name,
      agentType: _thisAgent.type as AgentTypeEnum,
      userId: userId,
      teamName: _team.name,
      skillSet: _thisAgent.systemPrompt || "",
      role: _thisAgent.roleDescription || "",
      tools: _thisAgent.tools || [],
      peerAgents: _team.agents.filter(
        (agent) => agent.name !== _thisAgent.name
      ),
      trainingMode: false,
    },
    { ...globalMessages.currentState, currentAgents: _team },
    userId,
    _team.name,
    false
  );
  //console.log("response", response?.response);
  return response;
};

export const PLAYGROUND_test_basicAgentChatWithAgentToAgentToolCall = async (
  globalMessages: GlobalMessages,
  message: string,
  agentIndex: number
) => {
  const userId = globalMessages.currentState.userId;
  const dbName = `AgentState-${userId}`;
  const result = await SERVER_getGeneralPurposeDataSingle(dbName, "all");
  if (result.content) {
    const _team: Team = JSON.parse(result.content).agents;
    const _thisAgent = _team.agents[agentIndex];
    const response = await agentChannelMessageRouter(
      message,
      [],
      _team,
      [],
      [
        _thisAgent?.modelArgs || {
          modelName: "gpt-4o-mini" as string,
          provider: ModelProviderEnum.OPENAI,
          temperature: 0,
        },
      ],
      false,
      {
        directives: _thisAgent?.promptDirectives || [],
        context: "",
        mission: _team.objectives || "",
        userName: "Nathaniel",
        thisAgentName: _thisAgent?.name || "",
        agentType: _thisAgent?.type as AgentTypeEnum,
        userId: userId,
        teamName: _team.name,
        skillSet: _thisAgent?.systemPrompt || "",
        role: _thisAgent?.roleDescription || "",
        tools: _thisAgent?.tools || [],
        peerAgents: _team.agents.filter(
          (agent) => agent.name !== _thisAgent?.name
        ),
        trainingMode: false,
      },
      globalMessages.currentState,
      userId,
      _team.name,
      false
    );
    console.log("TEST COMPLETE!", response?.response);
    return response;
  }
};
// Emulates what happens in agent component useEffect
export const PLAYGROUND_testAgentStoredInfo = async (
  agents: Team,
  userId: string
) => {
  // const dbName1 = `AgentState-${userId}`;
  // const _team = await SERVER_getGeneralPurposeDataSingle(dbName1, "all");
  // const team:Team = JSON.parse(_team.content).agents;
  // const testAgent = team.agents.find((agent:AgentComponentProps) => agent.name === "Line Master");
  console.log("userId", userId);

  const _nameSpace = DYNAMIC_NAMES.semantic_knowledge_base(userId);
  console.log("nameSpace", _nameSpace);
  const _result = await PINECONE_search("*", _nameSpace, {}, 100);
  console.log("result", _result);
  return _result;
  // if (testAgent) {
  //   const dbName = DYNAMIC_NAMES.db_client_info(testAgent.name, "AgentState", userId);
  //   const result = await SERVER_getGeneralPurposeDataMany(dbName);
  //     console.log("result", result);
  //     return result;
  //   }
};

export const PLAYGROUND_test_SERVER_deleteKnowledgeBaseItem = async (
  ids: string[],
  namespace: string
) => {
  const response = await PINECONE_deleteVectorsById(ids, namespace);
  console.log("response", response);
  return response;
};

export const PLAYGROUND_test_PINECONE_listVectors = async (
  namespace: string
) => {
  const response = await PINECONE_listVectors(namespace);
  console.log("response", response);
  return response;
};

export const PLAYGROUND_test_PINECONE_fetchData = async (namespace: string) => {
  console.log("namespace", namespace);
  const response = await PINECONE_fetchData(namespace);
  console.log("response", response);
  return response;
};

export const PLAYGROUND_test_UTILS_testPosMessageRoutine = async (
  props: PostMessageAnalysisProps
) => {
  const response = await ANALYSIS_TOOLS_handlePostMessageRoutine(props);
  console.log("response", response.nextFlag);
  return response;
};

// export const PLAYGROUND_test_MODEL_getOpenAIModelNamesOnline = async () => {
//   console.log("PLAYGROUND_test_MODEL_getOpenAIModelNamesOnline");
//   const response = await getOpenAIModelNamesOnline();
//   console.log(
//     "PLAYGROUND_test_MODEL_getOpenAIModelNamesOnline - response",
//     response
//   );
//   return response;
// };

// export const PLAYGROUND_test_MODEL_getBedrockModelNamesOnline = async () => {
//   console.log("PLAYGROUND_test_MODEL_getBedrockModelNamesOnline");
//   const response = await getBedrockModelNamesOnline({
//     byCustomizationType: "CONTINUED_PRE_TRAINING",
//     byInferenceType: "ON_DEMAND",
//     byOutputModality: "TEXT",
//     byProvider: "",
//   });
//   console.log(
//     "PLAYGROUND_test_MODEL_getBedrockModelNamesOnline - response",
//     response
//   );
//   return response;
// };

export const PLAYGROUND_test_Bedrock_models = async (
  _modelArgs: string,
  _state: AISessionState
) => {
  console.log("PLAYGROUND_test_Bedrock_models - modelArgs", _modelArgs);
  console.log(
    "PLAYGROUND_test_Bedrock_models - modelArgs",
    _modelArgs,
    "MODEL: ",
    await MODEL_getModel_ai(JSON.parse(_modelArgs))
  );
  const modelArgs = JSON.parse(_modelArgs);
  // const response = await generateText({
  //   model: await MODEL_getModel_ai(modelArgs),
  //   //system: "You are a helpful assistant.",
  //   messages: [{role: "user", content: "Hello, how are you?"}],
  // });

  let message = "Agent Chief::: Hello, how are you?";

  let _team: Team = _state.currentAgents;
  let _thisAgent: AgentComponentProps = _team.agents[0];
  _thisAgent.modelArgs = modelArgs;
  let userId = _state.userId;

  const result = await agentChannelMessageRouter(
    message,
    [],
    _team,
    [],
    [modelArgs],
    false,
    {
      directives: _thisAgent?.promptDirectives || [],
      context: "",
      mission: _team.objectives || "",
      userName: "Nathaniel",
      thisAgentName: _thisAgent?.name || "",
      agentType: _thisAgent?.type as AgentTypeEnum,
      userId: userId,
      teamName: _team.name,
      skillSet: _thisAgent?.systemPrompt || "",
      role: _thisAgent?.roleDescription || "",
      tools: _thisAgent?.tools || [],
      peerAgents: _team.agents.filter(
        (agent) => agent.name !== _thisAgent?.name
      ),
      trainingMode: false,
    },
    _state,
    userId,
    _team.name,
    false
  );
  console.log("TEST COMPLETE!", result?.response);

  console.log("PLAYGROUND_test_Bedrock_models - response", result?.response);
  return result?.response;
};

export const PLAYGROUND_test_agentAutoSpawn = async (
  shortDescription: string,
  state: AISessionState
) => {
  const result = await AGENT_AUTO_SPAWN(shortDescription, state);
  console.log("result", result);
  return result;
};

export const PLAYGROUND_test_dynamicTool = async (
  prompt: string,
  maxAttempts: number,
  context: string
) => {
  revalidatePath("/playground");
  console.log("PLAYGROUND_test_dynamicTool - prompt", prompt);
  // const evaluator = new ScriptEvaluator();
  // const response = await evaluator.analyzeRequirements(
  //   //"Please create a script that will return the result of scraping www.cruisebrothers.com home page.",
  //   prompt,
  //   ''
  // )
  // console.log("response", response);
  //return "TEST COMPLETE!";
  const result = await TOOLSACTION_DYNAMIC_SCRIPT_EVALUATEANDCREATE(
    prompt,
    maxAttempts,
    context
  );
  console.log("result", result);
  return result;
};

export const PLAYGROUND_test_agentMemory = async (
  userId: string,

  globalMessages: GlobalMessages
) => {
  const messages: ServerMessage[] = [
    {
      role: "user",
      content: "Hello, how are you?",
    },
    {
      role: "assistant",
      content: "I am fine, thank you!",
    },
    {
      role: "user",
      content: "What is the weather in San Francisco?",
    },
    {
      role: "assistant",
      content: "The weather in San Francisco is sunny and warm.",
    },
  ];
  const testAgent: AgentComponentProps = {
    type: AgentTypeEnum.TOOL_OPERATOR,
    name: "Test Agent",
    roleDescription: "This is a test agent",
    title: "Test Agent",
    modelArgs: {
      modelName: "gpt-4o-mini" as string,
      provider: ModelProviderEnum.OPENAI,
      temperature: 0,
    },
    tools: [AI_Agent_Tools.URL_SCRAPE],
    systemPrompt: "You are a helpful assistant",
    promptDirectives: [],
    disabled: false,
    index: 0,
  };

  const test = await MEMORY_store(messages, [testAgent], userId);
  console.log("test", test);

  // wait 5 seconds
  await new Promise((resolve) => setTimeout(resolve, 5000));

  const test2 = await MEMORY_retrieve(
    "Hello, how are you?",
    userId,
    "Test Agent",
    "string",
    AgentTypeEnum.TOOL_OPERATOR
  );
  console.log("test2", test2);

  return test;
};

export const PLAYGROUND_MIGRATE_GP_TO_TABLE = async (userId: string) => {
  const _states = await db.generalPurpose.findMany({
    where: {
      name: "AgentState-user_2f9RkJTtkBd0nQl3aCQw0PLf9x4",
    },
    select: {
      content: true,
      meta1: true,
      meta2: true,
      meta3: true,
      name: true,
      createdAt: true,
      updatedAt: true,
      id: true,
    },
  });

  console.log("AgentState-user_2f9RkJTtkBd0nQl3aCQw0PLf9x4 = ", _states.length);

  for (const agentTeam of _states) {
    try {
      if (agentTeam.meta1 === "all") {
        const item: {
          contextSets: ContextContainerProps[];
          agents: Team;
          messages: ServerMessage[];
          objectives: string;
        } = JSON.parse(agentTeam.content);

        const team = item.agents;
        const contextSets = item.contextSets || [];
        const messages = item.messages || [];
        const objectives =
          typeof team.objectives === "string"
            ? team.objectives
            : JSON.stringify(team.objectives);
        const agents = team.agents || [];

        if (agents.length === 0) {
          console.log(
            `Skipping team ${agentTeam.id} with name ${agentTeam.meta2} because it has no agents`
          );
          continue;
        }

        console.log(
          `Processing team ${agentTeam.id} with name ${agentTeam.meta2}`
        );

        // First check if team exists
        const existingTeam = await db.team.findFirst({
          where: { name: agentTeam.meta2 },
          include: { agents: true },
        });

        if (existingTeam) {
          // Update existing team
          // await db.team.update({
          //   where: { id: existingTeam.id },
          //   data: {
          //     objectives: objectives,
          //     context: {
          //       deleteMany: {},  // Remove old line sets
          //       createMany: {
          //         data: contextSets.map(lineSet => ({
          //           setName: lineSet.setName,
          //           text: lineSet.text,
          //           lines: JSON.stringify(lineSet.lines),
          //         }))
          //       }
          //     },
          //     agents: {
          //       // Update or create agents
          //       upsert: agents.map(agent => ({
          //         where: {
          //           id: existingTeam.agents.find(a => a.name === agent.name)?.id || -1
          //         },
          //         create: {
          //           name: agent.name,
          //           roleDescription: agent.roleDescription,
          //           title: agent.title,
          //           systemPrompt: agent.systemPrompt,
          //           modelName: agent.modelArgs.modelName,
          //           modelProvider: agent.modelArgs.provider,
          //           temperature: agent.modelArgs.temperature,
          //           tools: agent.tools?.map(tool => tool as string),
          //           promptDirectives: agent.promptDirectives || [],
          //           disabled: agent.disabled,
          //           training: agent.training,
          //           type: agent.type,
          //           voice: agent.voice,
          //           userId: userId,
          //         },
          //         update: {
          //           roleDescription: agent.roleDescription,
          //           title: agent.title,
          //           systemPrompt: agent.systemPrompt,
          //           modelName: agent.modelArgs.modelName,
          //           modelProvider: agent.modelArgs.provider,
          //           temperature: agent.modelArgs.temperature,
          //           tools: agent.tools?.map(tool => tool as string),
          //           promptDirectives: agent.promptDirectives || [],
          //           disabled: agent.disabled,
          //           training: agent.training,
          //           type: agent.type,
          //           voice: agent.voice,
          //           userId: userId,
          //         }
          //       }))
          //     }
          //   }
          // });
        } else {
          // Create new team
          await db.team.create({
            data: {
              name: agentTeam.meta2,
              objectives: objectives || "",
              userId: userId,
              context: {
                create: {
                  teamName: agentTeam.meta2,
                  sets: {
                    createMany: {
                      data: contextSets.map((set) => ({
                        setName: set.setName,
                        text: set.text,
                        lines: JSON.stringify(set.lines),
                      })),
                    },
                  },
                },
              },
              agents: {
                createMany: {
                  data: agents.map((agent) => ({
                    name: agent.name,
                    roleDescription: agent.roleDescription,
                    title: agent.title,
                    systemPrompt: agent.systemPrompt,
                    modelName: agent.modelArgs.modelName,
                    modelProvider: agent.modelArgs.provider,
                    temperature: agent.modelArgs.temperature,
                    tools: agent.tools?.map((tool) => tool as string),
                    promptDirectives: agent.promptDirectives || [],
                    disabled: agent.disabled,
                    training: agent.training,
                    type: agent.type,
                    voice: agent.voice,
                    userId: userId,
                  })),
                },
              },
            },
          });
        }
      }
    } catch (error) {
      console.error(`Error processing state ${agentTeam.id}:`, error);
      continue;
    }
  }
  return _states;
};
export const PLAYGROUND_MIGRATE_GP_TO_TABLE_GLOBAL_STATE_SAVE = async (
  sessionState: AISessionState
) => {
  const _states = await db.generalPurpose.findMany({
    where: {
      meta1: "GLOBAL_STATE_SAVE",
    },
    select: {
      content: true,
      meta1: true,
      meta2: true,
      meta3: true,
      name: true,
      createdAt: true,
      id: true,
    },
  });
  console.log("GLOBAL_STATE_SAVE_STATES = ", _states.length);

  // Now add all the states to the database
  for (const state of _states) {
    try {
      console.log(`Processing state ${state.id} with name ${state.meta3}`);
      const globalState: AppFrozenState = JSON.parse(state.content);
      console.log(`Successfully parsed state content for ${state.meta3}`);

      await APP_FROZEN_store(state.meta3, state.meta2, {
        localState: globalState.localState,
        currentConversation: globalState.currentConversation,
        
      });
      console.log(`Successfully stored frozen state for ${state.meta3}`);
    } catch (error) {
      console.error(`Error processing state ${state.id}:`, error);
      continue;
    }
  }
  return _states;
};

export const PLAYGROUND_test_database = async () => {
  console.log("PLAYGROUND_test_database called from index.ts");
  try {
    const test = await db.conversation.findFirstOrThrow({});
    console.log("test", test);
    return test;
  } catch (error) {
    console.error("Error in PLAYGROUND_test_database:", error);
    throw error;
  }
};

export const PLAYGROUND_test_agentGlobalPrompt = async (
  message: string,
  globalMessages: GlobalMessages
) => {
  console.log(
    "PLAYGROUND_test_agentGlobalPrompt called from index.ts",
    message,
    globalMessages
  );

  // initialize store

  const _team = globalMessages.currentState.currentAgents;
  const _agent = _team.agents.find((agent) => agent.name === "Agent Chief");
  if (!_agent) {
    throw new Error("Agent Chief not found");
  }
  const _context = await UTILS_convertLineSetsToContext(
    globalMessages.currentState.contextSet.sets,
    _agent.name
  );
  const prompt = await UTILS_loadAgentGlobalPrompt(
    {
      userName: globalMessages.currentState.genericData.userName,
      thisAgentName: _agent.name,
      agentType: _agent.type as AgentTypeEnum,
      userId: globalMessages.currentState.userId || "",
      teamName: _team.name || "",
      context: _context,
      skillSet: _agent.systemPrompt || "",
      role: _agent.roleDescription || "",
      tools: _agent.tools || [],
      peerAgents: _team.agents.filter((agent) => agent.name !== _agent.name),
      directives: _agent.promptDirectives || [],
      mission: _team.objectives || "",
      trainingMode: false,
    },
    _agent,
    _agent.type as AgentTypeEnum,
    message
  );
  console.log("prompt", prompt);
  return prompt;
};

export const PLAYGROUND_testSaveAgentState = async (
  agentState: Team,
  userId: string
) => {
  console.log(
    "PLAYGROUND_testSaveAgentState called from index.ts",
    agentState,
    userId
  );
  const result = await db.lastConversationDayName.create({
    data: {
      dayName: "test",
      userId: userId,
    },
  });
  console.log("result", result);

  // const _n = "yes";
  // const _name = "Agent Chief";
  // const _index = 0;
  // const result = await SERVER_storeGeneralPurposeData(
  //   // _n === "yes" ? JSON.stringify(agentState) : JSON.stringify(agentState.agents[_index]),
  //   "test",
  //   "all",
  //   _n === "yes" ? _name + "s Team" : _name,
  //   new Date().toISOString(),
  //   `AgentState-user_2f9RkJTtkBd0nQl3aCQw0PLf9x4`,
  //   true
  // );
  return result;
};

// test method chooser
// export const PLAYGROUND_test_methodChooser = async (
//   url: string
// ) => {
//   console.log("PLAYGROUND_test_methodChooser called from index.ts", url);
//   const result = await kbSiteMethodChooser(url);
//   console.log("result", result);
//   return result;
// };
