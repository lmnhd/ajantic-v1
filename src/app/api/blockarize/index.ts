import { BlockLyricType } from "@/components/songeditor/lyric/block";
import { LineLyricType } from "@/components/songeditor/lyric/line";
import { LyricContainerProps } from "@/components/songeditor/lyric/lyric-container";
import { db } from "@/src/lib/db";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { StringOutputParser } from "@langchain/core/output_parsers";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";
//import { BlockarizeText } from ".";
import { tsParticles } from "@tsparticles/engine";

async function handleLineGroupSelection(props: {
  blockNum: number;
  lineNum: number;
}) {
  return "";
}
export function Blockarize(lyrics: string, blockName?: string) {
  // lyrics = `LABEL: Verse 1
  // LINE1: In a garden of peace, I lay my roots down,
  // LINE2: Dreaming under the sun, but shadows come around.
  // LINE3: They whisper like the wind, trying to shake my ground,
  // `;

  const lines = lyrics.split("\n");

  //console.log("initial blocked lines: ", lines);

  const blocks: BlockLyricType[] = [];

  let iteration = 0;
  let blockNumber = 1;
  let curBlock: any = {
    text: [],
    length: 0,
    name: "Block1",
    blockNum: blockNumber,
    handleGroupSelection: () => {},
    addLinesToReference: () => {},
  };

  for (let line of lines) {
    //console.log('line: ', line);
    if (line.includes("LABEL:")) {
      // check if there is a previous block
      if (curBlock.text.length > 0) {
        curBlock.length = curBlock.text.length;
        blocks.push({ ...curBlock });
        blockNumber++;
      }
      // start new block
      curBlock = {
        text: [createLine(line, "label", blockNumber, iteration)],
        length: 0,
        name: "Block" + blockNumber,
        blockNum: blockNumber,
        // handleGroupSelection: () => {},
        // addLinesToReference: () => {},
      };
    }
    if (line.includes("LINE")) {
      //console.log("blocking line: ", line);
      curBlock.text.push(createLine(line, "line", blockNumber, iteration));
      //console.log("curBlock.text: ", curBlock.text);
    }
    iteration++;

    //console.log("Curblock & Iteration: ", curBlock, iteration);

    if (iteration == lines.length - 1 && blocks.length == 0) {
      curBlock.length = curBlock.text.length;
      blocks.push({ ...curBlock });
    }

    // Name block if single and named
    if (blocks.length == 1 && blockName) {
      blocks[0].text[0].text = blockName;
    }
  }
  //console.log("Blockarize (Function) - blocks: ", blocks);
  return blocks;
}

const createLine = (
  line: string,
  type: "label" | "line",
  blockNumber: number,
  lineNumber: number
): any => {
  const numMatch = line.match(/\d+/g);
  //console.log('numMatch: ', numMatch);
  const number = numMatch ? Number(numMatch[0]) : 0;
  // console.log("number: ", number);
  // console.log("line: ", line);
  // console.log("blockNumber: ", blockNumber);

  return {
    text: line.replace("LABEL: ", "").replace(`LINE${number}:`, "").trim(),
    type,
    block: blockNumber,
    line: lineNumber,
    // addGroupLinesToReference: () => {},
    // handleGroupSelection: () => {},
    // addLinesToReference: () => {},
    isSelected: false,
  };
};

export async function BlockarizeText(lyric: string, messages: any[]) {
  //const lyric = await getLyricsFromGenius('euphoria', 'Kendrick Lamar');

  //console.log('lyric: ', lyric);

  //  return lyric;

  let SYSTEM_TEMPLATE = `You are an AI song writer and analyzer. Your job is to take the given song lyrics and restructure them into a list of text lines with labels. We call this process 'Blockarization'.

*** <EXAMPLES>
Here are 4 examples of how to parse original lyrics to the desired format: 

*** ORIGINAL:
  **Verse 1:**  
Caught in your gaze, it's like a maze,  
Every turn, a new surprise under your spell.  
You say my name, it's not the same,  
Got me tangled in your game, can't you tell?

**Pre-Chorus:**  
But oh, you chase me like a dream,  
Flying high on a fantasy.  
Just remember while you scheme,  
Love's not just about "me, me, me." ***


*** BLOCKARIZED: 
LABEL: Verse 1
LINE1: Caught in your gaze, it's like a maze,
LINE2: Every turn, a new surprise under your spell.
LINE3: You say my name, it's not the same,
LINE4: Got me tangled in your game, can't you tell?

LABEL: Pre-Chorus
LINE1: But oh, you chase me like a dream,
LINE2: Flying high on a fantasy.
LINE3: Just remember while you scheme,
LINE4: Love's not just about "me, me, me." ***

*** ORIGINAL:
[Intro - Beyonce]
Nobody pray for me
It been that day for me
Way (Yeah, yeah)

[Verse 1 - Jay Z]
Ayy, I remember syrup sandwiches and crime allowances
Finesse a nigga with some counterfeits, but now I'm countin’ this
Parmesan where my accountant lives, in fact, I'm downin' this
D’USSÉ with my boo bae, tastes like Kool-Aid for the analysts
Girl, I can buy your ass the world with my paystub
Ooh, that pussy good, won't you sit it on my taste bloods?
I get way too petty once you let me do the extras
Pull up on your block, then break it down: we playin' Tetris
A.m. to the p.m., p.m. to the a.m., funk
Piss out your per diem, you just gotta hate 'em, funk
If I quit your BM, I still ride Mercedes, funk
If I quit this season, I still be the greatest, funk
My left stroke just went viral
Right stroke put lil' baby in a spiral
Soprano C, we like to keep it on a high note
It's levels to it, you and I know

[Chorus]
Bitch, be humble (Hol' up, bitch)
Sit down (Hol' up, lil’, hol’ up, lil' bitch)
Be humble (Hol’ up, bitch)
Sit down (Hol' up, sit down, lil', sit down, lil' bitch)
Be humble (Hol’ up, hol' up)
Bitch, sit down (Hol' up, hol' up, lil' bitch)
Be humble (Lil' bitch, hol' up, bitch)
Sit down (Hol' up, hol' up, hol' up, hol' up)
Be humble (Hol' up, hol' up)
Sit down (Hol' up, hol' up, lil', hol' up, lil' bitch)
Be humble (Hol' up, bitch)
Sit down (Hol' up, sit down, lil', sit down, lil' bitch)
Be humble (Hol' up, hol' up)
Bitch, sit down (Hol' up, hol' up, lil' bitch)
Be humble (Lil' bitch, hol' up, bitch)
Sit down (Hol' up, hol' up, hol' up, hol' up) ***

*** BLOCKARIZED:
LABEL: Intro
LINE1: Nobody pray for me
LINE2: It been that day for me
LINE3: Way (Yeah, yeah)

LABEL: Verse 1
LINE1: Ayy, I remember syrup sandwiches and crime allowances
LINE2: Finesse a nigga with some counterfeits, but now I'm countin’ this
LINE3: Parmesan where my accountant lives, in fact, I'm downin' this
LINE4: D’USSÉ with my boo bae, tastes like Kool-Aid for the analysts

CONTINUE: 
LINE5: Girl, I can buy your ass the world with my paystub
LINE6: Ooh, that pussy good, won't you sit it on my taste bloods?
LINE7: I get way too petty once you let me do the extras
LINE8: Pull up on your block, then break it down: we playin' Tetris

CONTINUE:
LINE9: A.m. to the p.m., p.m. to the a.m., funk
LINE10: Piss out your per diem, you just gotta hate 'em, funk
LINE11: If I quit your BM, I still ride Mercedes, funk
LINE12: If I quit this season, I still be the greatest, funk

CONTINUE:
LINE13: My left stroke just went viral
LINE14: Right stroke put lil' baby in a spiral
LINE15: Soprano C, we like to keep it on a high note
LINE16: It's levels to it, you and I know

LABEL: Chorus
LINE1: Bitch, be humble (Hol' up, bitch)
LINE2: Sit down (Hol' up, lil’, hol’ up, lil' bitch)
LINE3: Be humble (Hol’ up, bitch)
LINE4: Sit down (Hol' up, sit down, lil', sit down, lil' bitch)

CONTINUE:
LINE5: Be humble (Hol’ up, hol' up)
LINE6: Bitch, sit down (Hol' up, hol' up, lil' bitch)
LINE7: Be humble (Lil' bitch, hol' up, bitch)
LINE8: Sit down (Hol' up, hol' up, hol' up, hol' up)

CONTINUE:
LINE9: Be humble (Hol' up, hol' up)
LINE10: Sit down (Hol' up, hol' up, lil', hol' up, lil' bitch)
LINE11: Be humble (Hol' up, bitch)
LINE12: Sit down (Hol' up, sit down, lil', sit down, lil' bitch) ***

*** ORIGINAL:
"I think Im in love with you/I didnt know it at the time/I know what I want to do/Its makin me lose my mind/I thought about thinkin it through/And every time I do I find/I wanna make your dreams come true/I think Im in love with you/Im in love with you" ***

*** BLOCKARIZED:
LABEL: Block
LINE1: I think Im in love with you
LINE2: I didnt know it at the time
LINE3: I know what I want to do
LINE4: Its makin me lose my mind

CONTINUE:
LINE5: I thought about thinkin it through
LINE6: And every time I do I find
LINE7: I wanna make your dreams come true
LINE8: I think Im in love with you

CONTINUE:
LINE9: Im in love with you ***

*** ORIGINAL:
[Verse 1]Baby, do you ever wonderWhatever happened way back whenOr if I'll see you againAnd maybe if you ever wonderAw, you might wish things could changeI know this might sound strange but[Chorus]I think I'm in love with youI didn't know it at the timeI know what I want to doIt's makin' me lose my mindI thought about thinkin' it throughAnd every time I do I findI wanna make your dreams come trueI think I'm in love with youI'm in love with you[Verse 2]Ooh, you are the power over meYou are the truth that I believeYou are my life, you are my worldYou are thе air I'm breathin', girlYou are the light I want to seeYou'rе all of everythin' to meYou are the reasons that I amWoman\n"
    "[Chorus]I think I'm in love with youI didn't know it at the timeI know what I want to doIt's makin' me lose my mindI thought about thinkin' it throughAnd every time I do I findI wanna make your dreams come trueI think I'm in love with youI'm in love with you[Chorus]Oh, I think I'm in love with youI didn't know it at the timeI know what I want to doIt's makin' me lose my mind, girlI thought about thinkin' it throughAnd every time I do I findI wanna make your dreams come trueI think I'm in love with youI'm in love with youOh, I think I'm in love with youI didn't know it at the timeI know what I want to doIt's makin' me lose my mind, girlI thought about thinkin' it throughAnd every time I do I findI wanna make your dreams come trueI think I'm in love with youI'm in love with you\n"
    "[Outro]I think I'm in love with youI think I'm in love with youI think I'm in love with youI think I'm in love with youI think I'm in love with youI think I'm in love with you", ***
  
  *** BLOCKARIZED:
  LABEL: Verse 1
  LINE1: Baby, do you ever wonder
  LINE2: Whatever happened way back when
  LINE3: Or if I'll see you again
  LINE4: And maybe if you ever wonder

  CONTINUE:
  LINE5: Aw, you might wish things could change
  LINE6: I know this might sound strange but

  LABEL: Chorus
  LINE1: I think I'm in love with you
  LINE2: I didn't know it at the time
  LINE3: I know what I want to do
  LINE4: Its makin' me lose my mind

  CONTINUE:
  LINE5: I thought about thinkin' it through
  LINE6: And every time I do I find
  LINE7: I wanna make your dreams come true
  LINE8: I think I'm in love with you

  CONTINUE:
  LINE9: I'm in love with you

  LABEL: Verse 2
  LINE1: Ooh, you are the power over me
  LINE2: You are the truth that I believe
  LINE3: You are my life, you are my world
  LINE4: You are thе air I'm breathin', girl

  CONTINUE
  LINE5: You are the light I want to see
  LINE6: You'rе all of everythin' to me
  LINE7: You are the reasons that I am
  LINE8: Woman

  LABEL: Chorus
  LINE1: I think I'm in love with you
  LINE2: I didn't know it at the time
  LINE3: I know what I want to do
  LINE4: Its makin' me lose my mind, girl

  CONTINUE:
  LINE5: I thought about thinkin' it through
  LINE6: And every time I do I find
  LINE7: I wanna make your dreams come true
  LINE8: I think I'm in love with you

  CONTINUE:
  LINE9: I'm in love with you

  LABEL: Outro
  LINE1: I think I'm in love with you
  LINE2: I think I'm in love with you
  LINE3: I think I'm in love with you
  LINE4: I think I'm in love with you

  CONTINUE:
  LINE5: I think I'm in love with you
  LINE6: I think I'm in love with you
  LINE7: I think I'm in love with you
  LINE8: I think I'm in love with you

  CONTINUE:
  LINE9: I think I'm in love with you ***

  </EXAMPLES> 

*** IMPORTANT:
---1. Remove all personal names, places, and other miscellaneous information.
---2. ONLY return the blockarized lines.

<LYRICS>
   {lyrics}
</LYRICS>

   
   
   
  `;

  const chatHistory = messages.slice(0, -1).map((message) => {
    return message.role == "user"
      ? new HumanMessage(message.content)
      : new AIMessage(message.content);
  });

  const model = new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
    temperature: 0,
    streaming: false,
    maxTokens: 4096,
    verbose: false,
  });
  // const modelWithFunctions = model.bind({
  //   functions: tools.map((tool) => convertToOpenAIFunction(tool)),
  // });

  const MEMORY_KEY = "history";
  const memoryPrompt = ChatPromptTemplate.fromMessages([
    ["system", SYSTEM_TEMPLATE],

    new MessagesPlaceholder(MEMORY_KEY),
  ]);
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
  // const res = await memoryPrompt.format({
  //   history: chatHistory,
  //   //songs: lyrics,
  //   context: systemPrompt,
  //   artist: userName ? ` by ${userName}` : "",
  //   agent_scratchpad: [],
  //   input: "",
  // });

  // console.log("test prompt => ", res);
  //return NextResponse.json(response);
  // context and songs
  const agentWithMemory = RunnableSequence.from([
    memoryPrompt,
    model,
    new StringOutputParser(),
  ]);

  let response = await agentWithMemory
    .invoke(
      {
        history: chatHistory,
        lyrics: lyric,
      }
      //{ callbacks: [handlers] }
    )
    .catch(console.error);

  //console.log("response => ", response);
  return response as string;
}
