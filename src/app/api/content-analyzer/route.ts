import OpenAI from "openai";
import {

  Message,
 
} from "ai";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";

import {
  AgentAction,
  AgentExecutor,
  AgentFinish,
  AgentStep,
  createOpenAIFunctionsAgent,
} from "langchain/agents";
import { DynamicTool, DynamicStructuredTool } from "@langchain/core/tools";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  FunctionMessage,
  BaseMessage,
} from "@langchain/core/messages";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
  PromptTemplate,
} from "@langchain/core/prompts";
import { formatToOpenAIFunctionMessages } from "langchain/agents/format_scratchpad";
import { RunnableSequence } from "@langchain/core/runnables";
import { NextResponse } from "next/server";

import zodToJsonSchema from "zod-to-json-schema";
import {
  FunctionsAgentAction,
  OpenAIFunctionsAgentOutputParser,
} from "langchain/agents/openai/output_parser";
import { convertToOpenAIFunction } from "@langchain/core/utils/function_calling";

import { Artist } from "@/src/lib/types";
import { ChainValues } from "@langchain/core/utils/types";

//export const runtime = "edge";

export async function POST(req: Request) {
  let response: ChainValues | string = { message: "Hello" };
  let result: any = "testing";
  const {
    messages,
    systemPrompt,
    artists,
    keepItClean,
    userName,
  }: {
    messages: Message[];
    systemPrompt: string;
    artists: Artist[];
    keepItClean: boolean;
    userName: string;
  } = await req.json();

  if (artists.length === 0) {
    return NextResponse.json({
      message: "No artists provided",
    });
  }
  // console.log(artists, systemPrompt);

  // return NextResponse.json(response);

  // const data = new StreamData();

  // // important: use LangChainStream from the AI SDK:
  // const { stream, handlers } = LangChainStream({
  //   // onCompletion: (resp) => {
  //   //   data.append(JSON.stringify({response: resp})); // example
  //   //   data.close();
  //   // },
  //   onCompletion: (resp) => {
  //     console.log("onCompletion", resp);
  //   },
  //   onStart: () => {
  //     console.log("onStart");
  //     // data.appendMessageAnnotation({ text: "onStart" });
  //     // data.append(JSON.stringify({ text2: "onStart" }));
  //   },
  //   onText: (resp) => {
  //     console.log("onText", resp);
  //     // data.appendMessageAnnotation({ text: "resp" });
  //     // data.append(JSON.stringify({ text2: "resp" }));
  //   },

  //   onToken: (resp) => {
  //     console.log("onToken", resp);
  //     // data.appendMessageAnnotation({ text: resp });
  //     // data.append(JSON.stringify({ text2: resp }));
  //   },
  //   onFinal: (resp) => {
  //     console.log("onFinal", resp);
  //     //data.appendMessageAnnotation({ text: "resp" });
  //     //data.append(audio);
  //     data.close();
  //   },
  //   experimental_streamData: true,
  // });

  const cleanText = (text: string) => {
    //const regex1 = "\(.*?\)";
    const regex1 = /\[.*?\]/;
    const regex2 = /\(.*?\)/;
    const UTILS_cleanTitle = text.replace(regex1, "").replace(regex2, "");

    return UTILS_cleanTitle;
  };

  // const cleanTextTest = cleanText("Control (Originally Performed By Janet Jackson) [Karaoke]");

  // console.log("cleanTextTest", cleanTextTest);

  // return NextResponse.json({ cleanTextTest });

  

  const lyrics = artists.map((artist) => {return artist.songs.map((song) => {
    return song.lyrics
  })}).join("**********\n\n");

  console.log(`lyrics: ${lyrics}`);

  //return NextResponse.json(lyrics);

  if (lyrics === "") {
    return NextResponse.json({
      message:
        "Unable to research artist chosen. Please try again with a different artist.",
    });
  }
  // console.log(lyrics);

  // return NextResponse.json({ lyrics });

  let SYSTEM_TEMPLATE = `Artist Breeding: Developing the next generation of music artists using evolved methods of research, analysis, and reverse engineering. The goal is to scientifically make sense of the process needed to create ground breaking, trend accelerating, and influential music artists. 
  Your role is to act as a music artist development expert.
  A specific focus will be leveraged heavily toward the philosophy behind hit songs, viral music trends, and the psychology of what makes music popular.
  You will assist the organization with researching and analyzing music trends, music business marketing strategies that work and don't work, and reverse engineering the key elements that make certain music artists successful.

Song Trend Analysis:
*------------------------------*
Analyze the provided song lyrics and provide insights into the following:
Category Tags:

WHO DOES THIS APPEAL? women, men, gay, straight, old, young, black, white, latino, asian, urban, suburban, rural, rich, poor, educated, uneducated, employed, unemployed, married, single, divorced, widowed, religious, atheist, spiritual, agnostic, conservative, liberal, moderate

WHAT IS THIS ABOUT? 

emotions: sex, love, anger, hate, fear, regret, revenge, shame, hopeful, sad, lonely, happy, excited, greed, lust, wealth, religion, relationships, heartbreak, empowerment, confidence, addiction, nostalgia, betrayal, 



relationships, family, society, politics, religion, spirituality, nature, technology, science, health, education, work, money, art, music, literature, history, culture, sports, entertainment, fashion, food, travel, environment, animals, plants, weather, seasons, holidays, celebrations, disasters, crime, law,, war, peace, violence, conflict, human rights, social, equality, diversity, inclusion, identity, self, emotions, mental health, physical health, wellness, beauty, aging, death, life, meaning, purpose, philosophy, ethics, morality, values, beliefs, dreams, goals, success, failure, challenges, growth, change, transformation, creativity, innovation, imagination, inspiration, motivation, leadership, influence, power, authority, control, freedom, democracy, justice, peace, security, safety, trust, respect, communication, collaboration, teamwork, community, society, culture, diversity, inclusion, equality, equity,, human rights, social, environmental,


Research: 
- Explain in detail what makes this song appealing and to what demographic.
- Some songs become highly popular primarily due to the music track. These songs can be identified by reviewing the lyrics and finding no inherent meaning or depth. Can this song qualify as such, or does it have deeper lyrical significance?
- How does the writer use words to express different perspectives
- Analyze what makes certain partial phrases resonate deeply with the listener and why,
- Identify and explain occurrences of the writer using metaphors, similes, or other literary devices to convey deeper meaning
- Identify and evaluate the reason why some metaphors, similes, or other literary devices might fail to resonate with the listener, make the point effectively, or both.
- Create multiple theories about what inspired the lyrics based on the content and tone of the song.
- Explore and divulge any potential alternate meanings or subtext that could be conveyed through the lyrics.



- What is this song about?
- What do you believe inspired the lyrics?
- What kind of person does this appeal to?
- How many streams per day is this song getting?
- Is the success of this song grounded in the song itself or the Artist performing the song?
- What emotions or feelings does this song evoke in the listener?
- How does this song differ from other songs?
- What is the demographic this song aims to appeal to?
- What circumstance or event in the writers's life likely inspired the lyrics?

   
  `;


  // const tools = [
  //   new DynamicTool({
  //     name: "general-info-web-search",
  //     description: "use this for general search.",
  //     func: async (input: string) => {
  //       return TOOLFUNCTION_duckDuckGoZero(input);
  //     },
  //   }),
  // ];
  const chatHistory = messages.slice(0, -1).map((message) => {
    return message.role == "user"
      ? new HumanMessage(message.content)
      : new AIMessage(message.content);
  });

  const model = new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
    temperature: 0,
    streaming: true,
    maxTokens: 2500,
    verbose: true,
  });
  // const modelWithFunctions = model.bind({
  //   functions: tools.map((tool) => convertToOpenAIFunction(tool)),
  // });

  const MEMORY_KEY = "chat_history";
  const memoryPrompt = ChatPromptTemplate.fromMessages([
    ["system", SYSTEM_TEMPLATE],

    new MessagesPlaceholder(MEMORY_KEY),

    new MessagesPlaceholder("agent_scratchpad"),
  ]);

  const res = await memoryPrompt.format({
    chat_history: chatHistory,
    songs: lyrics,
    context: systemPrompt,
    artist: userName ? ` by ${userName}` : "",
    agent_scratchpad: [],
    input: "",
  });

  console.log("test prompt => ", res);
  //return NextResponse.json(response);
  // context and songs
  const agentWithMemory = RunnableSequence.from([
    {
      input: (i) => i.input,
      artist: () => artists.map((a) => a.name).join(", "),
      agent_scratchpad: (i) => formatToOpenAIFunctionMessages(i.steps),
      chat_history: (i) => i.chat_history,
      context: () => messages[messages.length - 1].content,
      songs: () => lyrics,
    },

    memoryPrompt,
    model,
    new OpenAIFunctionsAgentOutputParser(),
  ]);

  console.log("agentWithMemory", agentWithMemory);

  //return NextResponse.json(response);

  // const executorWithMemory = AgentExecutor.fromAgentAndTools({
  //   agent: agentWithMemory,
  //   tools: [],
  //   callbacks: [handlers],
  //   maxIterations: 3,
  //   verbose: true,
  //   returnIntermediateSteps: true,
  // });

  // response = executorWithMemory
  //   .invoke(
  //     {
  //       //input: `what is the web page 'https://cheerio.js.org/docs/intro' about?`,
  //       //input: "Hello",
  //       input: messages[messages.length - 1].content,

  //       chat_history: chatHistory,
  //     },
  //     { callbacks: [handlers] }
  //   )
  //   .catch(console.error);

  return NextResponse.json(response);
}
