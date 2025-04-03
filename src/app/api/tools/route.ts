import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import {
  AgentExecutor,
  createOpenAIFunctionsAgent,
  createOpenAIToolsAgent,
} from "langchain/agents";
import {
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from "@langchain/core/prompts";

import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";

import {
  StringOutputParser,
  BytesOutputParser,
} from "@langchain/core/output_parsers";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AITOOL_ryhmingTool } from "./lc";
import { AITOOL_synonymsTool } from "./lc";

//export const runtime = "edge";

export async function POST(req: Request) {
  console.log("------------FOUR BARS-------------\n\n\n");
  let response = { message: "Hello" };
  const { dilemma } = await req.json();
  console.log("------------FOUR BARS-------------\n\n\n");
  console.log("------------FOUR BARS-------------\n\n\n");
  console.log("------------FOUR BARS-------------\n\n\n");
  //console.log('dilemma: ', dilemma)
  //await TOOLFUNCTION_rymingDictionary();

  // const prompt = await hub.pull("hwchase17/openai-tools-agent");
  // console.log('prompt: ', prompt)

  // return NextResponse.json(response);

  const wps = await db.wordplay.findMany({
    take: 100,
    select: {
      name: true,
      description: true,
      example: true,
    },
  });

  const ratings: {
    name: string;
    description: string;
    count: number;
    examples: string[];
  }[] = [];

  for (const wp of wps) {
    const name = wp.name.split("-")[0];
    if (!ratings.find((rating) => rating.name === name)) {
      ratings.push({
        name,
        description: wp.description,
        count: 1,
        examples: [wp.example],
      });
    } else {
      const rating = ratings.find((rating) => rating.name === name);
      rating!.count += 1;
      rating!.examples.push(wp.example);
    }
  }

  console.log(ratings.sort((a, b) => b.count - a.count));
  return NextResponse.json(response);

  let usedWordPlayString = "";

  const wordPlayText = wps
    .slice(0, 100)
    .filter((play) => {
      const technique = play.description;
      const name = play.name.split("-")[0];
      if (!usedWordPlayString.toLowerCase().includes(name.toLowerCase())) {
        usedWordPlayString += name;
        return true;
      } else {
        return false;
      }
    })
    .map((wp) => wp.name.split("-")[0] + ":\n" + wp.description)
    .join("\n\n");

  //   const technique = wordPlays[1].description;
  console.log(wordPlayText);
  //return NextResponse.json(response);

  const firstLinePrompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(
      `You are an assistant song lyric writer. In exactly {numWords} syllable's, Write the first line of the first verse of a song about:
      `
    ),
    new MessagesPlaceholder("chat_history"),
    HumanMessagePromptTemplate.fromTemplate(
      //"Here is the song idea: {song}"
      `{dilemma}`
    ),
    new MessagesPlaceholder("agent_scratchpad"),
  ]);

  const sarcasticPrompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(
      `You are an assistant song lyric writer. Rewrite the following phrase in a sarcastic tone: ${dilemma}.`
    ),
  ]);
  const nWordsPrompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(
      `You are an assistant song lyric writer. In exactly {numWords} words, write a one sentence line that poetically phrases this as a question: ${dilemma}.`
    ),
  ]);

  const perfectRymePrompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(
      `You are an assistant song lyric writer. Using exactly {numWords} words, write a {numWords} word sentence that ryhmes with the following. 
     
      
     `
    ),
    new MessagesPlaceholder("chat_history"),
    HumanMessagePromptTemplate.fromTemplate(
      //"Here is the song idea: {song}"
      `"{excerpt}".`
    ),
    new MessagesPlaceholder("agent_scratchpad"),
  ]);

  const unexpectedWordsPrompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(
      `You are an assistant song lyric writer. Take the following excerpt and reword it using the 'word-finder' tool to find unexpected variations for key words: {excerpt}.`
    ),
    new MessagesPlaceholder("chat_history"),
    HumanMessagePromptTemplate.fromTemplate(
      //"Here is the song idea: {song}"
      `Here is the song topic: {dilemma}`
    ),
    new MessagesPlaceholder("agent_scratchpad"),
  ]);

  const wordPlayPrompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(`You are an assistant song lyric writer. Your task is to take a given topic and write a clever and poetic one liner using at least 1 of the listed word play techniques about the provided topic.
    
    1. Start by identifying key words and phrases in the topic and re-wording them in unexpected ways.
    2. Look for unique opportunities to use the word play techniques.
    3. Always try to use words that are most uncommon and unexpected.
    4. Look for ways to combine the word play techniques to create a more complex lyrical structure.
    .
     
    Use 2 or more of the following techniques: ${wordPlayText}
       
       
      
       
       `),
    new MessagesPlaceholder("chat_history"),
    HumanMessagePromptTemplate.fromTemplate(
      //"Here is the song idea: {song}"
      `Here is the song topic: {dilemma}`
    ),
    new MessagesPlaceholder("agent_scratchpad"),
  ]);
  //   const songBuilderPrompt = ChatPromptTemplate.fromMessages([
  //     SystemMessagePromptTemplate.fromTemplate(`You are an assistant song lyric writer. Generate 3 unique and individual 4 bar chorus lines for the given song idea.
  //        return only the 3 chorus lines as a numerical list.

  //        `),
  //     HumanMessagePromptTemplate.fromTemplate(
  //       "Here is the song idea: {song}"
  //     ),
  //   ]);
  //   const songIdeaExtractionPrompt = ChatPromptTemplate.fromMessages([
  //     SystemMessagePromptTemplate.fromTemplate(`You are an assistant song lyric analyzer. Your task is to extract 3 unique concepts for new songs based on a lyric excerpt from within the following song.
  //        return only the 3 song ideas as an itemized list.
  // 1. Use the 'ryhme-finder' tool to find unique ryhme options for given word
  // 2. Add and remove words as nessary to make the line exactly {numWords} words long.

  const model = new ChatOpenAI({
    modelName: "gpt-3.5-turbo-16k",
    maxTokens: 4000,
    temperature: 1,
    topP: 1,
    streaming: false,
    verbose: true,
  });
  const outputParser = new StringOutputParser();

  const agent = await createOpenAIToolsAgent({
    llm: model,

    tools: [AITOOL_synonymsTool, AITOOL_ryhmingTool],
    prompt: perfectRymePrompt,
  });

  const agentExecutor = new AgentExecutor({
    agent,
    tools: [AITOOL_synonymsTool, AITOOL_ryhmingTool],

    verbose: true,
  });

  const resp = await agentExecutor.invoke({
    numWords: 10,
    dilemma: dilemma,
    chat_history: [],
    excerpt: "Chasing hearts, running from their own empty souls",
  });
  console.log(resp);

  //        `),
  //     HumanMessagePromptTemplate.fromTemplate(
  //       "Here is the song to summarize: {song}"
  //     ),
  //   ]);

  return NextResponse.json(response);
}
//In a complicated dance, seeking love's gentle glove
//Chasing hearts, running from their own empty souls
