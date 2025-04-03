"use server";
const { load } = require("cheerio");
import { DynamicTool, DynamicStructuredTool } from "@langchain/core/tools";
import z from "zod";
import * as hub from "langchain/hub"; 
import { db } from "@/src/lib/db";
import { BlockLyricType } from "@/components/songeditor/lyric/block";
import { PINECONE_search } from "../pinecone";

// Function to find toolfunction_synonyms of a given word
export async function TOOLFUNCTION_synonyms(baseWord: string) {
  let finalResult = "err";
  try {
    if (!baseWord) {
      console.log("TOOLFUNCTION_synonyms no base word");
      return "no base word";
    }
    console.log("TOOLFUNCTION_synonyms baseWord", baseWord);
    const url = `https://www.thesaurus.com/browse/${baseWord}`;
    const res = await fetch(url);
    const $ = load(await res.text());
    const aTags = $("section ul li");
    const words = [];
    for (let i = 0; i < aTags.length; i++) {
      const aTag = aTags[i];
      const word = $(aTag).text();
      words.push(word);
    }

    console.log(words.join("\n"));
    finalResult = words.join("\n");
  } catch (error) {
    console.error(
      "Error fetching synonyms - Word Finder Tool may not be working:",
      error
    );
    finalResult = `Error fetching synonyms - Word Finder Tool may not be working: ${String(
      error
    )}`;
  }
  return finalResult;
}

// Function to find rhymes of a given word
export async function TOOLFUNCTION_rymingDictionary(
  baseWord: string = "water"
) {
  console.log("TOOLFUNCTION_rymingDictionary_baseWord", baseWord);
  if (!baseWord) {
    console.log("TOOLFUNCTION_rymingDictionary no base word");
    return "ryming_no_word";
  }
  // const url = `https://www.thewordfinder.com/words-that-rhyme-with/?word=${baseWord}&non_extra=1`;

  try {
    const url = `https://www.rhymezone.com/r/rhyme.cgi?Word=${baseWord}&typeofrhyme=perfect&org1=syl&org2=l&org3=y`;
    console.log("TOOLFUNCTION_rymingDictionary url", url);

    const res = await fetch(url);
    const html = await res.text();
    console.log("TOOLFUNCTION_rymingDictionary html", html);
    //return;

    const $ = load(html);
    const allText = $("body").text();
    //console.log("TOOLFUNCTION_rymingDictionary_allText", allText);
    //const _words = $(".words strong")
    const _words = $("a.d");
    console.log("TOOLFUNCTION_rymingDictionary_words", _words.length);
    //return _words;

    const words = [];
    for (let i = 0; i < _words.length; i++) {
      const _w = _words[i];
      const word = $(_w).text();
      words.push(word);
    }
    console.log("TOOLFUNCTION_rymingDictionary", words.join("\n"));
    return words.join("\n");
  } catch (error) {
    console.error(
      "Error fetching rhymes - Rhyme Finder Tool may not be working:",
      error
    );
    return `Error fetching rhymes - Rhyme Finder Tool may not be working: ${String(
      error
    )}`;
  }
}

// Function to search the web using bing
export async function TOOLFUNCTION_bingSearch(
  query: string,
  count: number = 3,
  offset: number = 0,
  mkt: string = "en-us",
  safeSearch: string = "Moderate"
) {
  if (
    !process.env.BING_SEARCH_API_ENDPOINT ||
    !process.env.BING_SEARCH_API_KEY
  ) {
    return "no bing search api key or endpoint";
  }
  const url =
    process.env.BING_SEARCH_API_ENDPOINT +
    `v7.0/search?q=${encodeURI(
      query
    )}&count=${count}&offset=${offset}&mkt=${mkt}&safesearch=${safeSearch}`;
  console.log(url);
  //return;
  const options = {
    method: "GET",
    headers: {
      "Ocp-Apim-Subscription-Key": process.env.BING_SEARCH_API_KEY || "",
    },
  };

  const response = await fetch(url, options);
  const result = await response.text();
  console.log(result);
  return result;
}

// Function to search the web using duckduckgo
export async function TOOLFUNCTION_duckDuckGoZero(query: string) {
  if (!process.env.RAPIDAPI_API_KEY || !process.env.RAPIDAPI_HOST) {
    return "no rapidApi key or host";
  }

  const url = `https://duckduckgo-duckduckgo-zero-click-info.p.rapidapi.com/?q=${encodeURI(
    query
  )}&callback=process_duckduckgo&no_html=1&no_redirect=1&skip_disambig=1&format=json`;
  const options = {
    method: "GET",
    headers: {
      "X-RapidAPI-Key": process.env.RAPIDAPI_API_KEY || "",
      "X-RapidAPI-Host": process.env.RAPIDAPI_HOST || "",
    },
  };
}

export async function TOOLFUNCTION_randomWord() {
  let randWord = "";
  let attempts = 0;
  const maxAttempts = 10;
  const timeBetweenAttempts = 500;

  while (randWord.length < 3 && attempts < maxAttempts) {
    randWord = await _randomWord();
    attempts++;
    await new Promise((resolve) => setTimeout(resolve, timeBetweenAttempts));
  }

  return randWord;
}

export async function TOOLFUNCTION_randomLine() {
  return await _randomLine();
}

// Function to pull a random word from a random BlockarizeResearchObject
export async function _randomWord() {
  const dbName = "BlockarizeResearchObject";
  const dbName2 = "WordPlayExample";
  let randWord = "";

  try {
    let randSongs = await db.generalPurpose.findMany({
      where: {
        name: dbName,
      },
    });
    // let randSongs2 = await db.generalPurpose.findMany({
    //   where: {
    //     name: dbName2,
    //   },
    // });
    // randSongs = randSongs.concat(randSongs2);

    const randSong = randSongs[Math.floor(Math.random() * randSongs.length)];

    const bSong: BlockLyricType[] = JSON.parse(randSong.content);

    const randBlock = bSong[Math.floor(Math.random() * bSong.length)];

    const randLine = randBlock.text.filter((line, index) => index !== 0)[
      Math.floor(Math.random() * randBlock.text.length)
    ];
    if (!randLine || !randLine.text) {
      return "";
    }
    randWord =
      randLine.text.split(" ")[
        Math.floor(Math.random() * randLine.text.split(" ").length)
      ] || "";

    console.log("TOOLFUNCTION_randomWord", randWord);
  } catch (error) {
    console.error("Error fetching random word:", error);
  }

  return randWord;
}

// Function to pull a random line from a random BlockarizeResearchObject
export async function _randomLine() {
  const dbName = "BlockarizeResearchObject";
  const dbName2 = "WordPlayExample";
  let randLine = "";

  try {
    let randSongs = await db.generalPurpose.findMany({
      where: {
        name: dbName,
      },
    });
    // let randSongs2 = await db.generalPurpose.findMany({
    //   where: {
    //     name: dbName2,
    //   },
    // });
    // randSongs = randSongs.concat(randSongs2);
    console.log("randSongs", randSongs.length);

    const randSong = randSongs[Math.floor(Math.random() * randSongs.length)];
    //console.log("randSong", randSong);

    const bSong: BlockLyricType[] = JSON.parse(randSong.content);
    //console.log("bSong", bSong);

    let randBlock = bSong[Math.floor(Math.random() * bSong.length)];
    //console.log("randBlock", randBlock);
    // Remove the first line from the block
    randBlock.text = randBlock.text.filter((line, index) => index !== 0 && line.text.length > 10);

     randLine = randBlock.text[Math.floor(Math.random() * randBlock.text.length)].text;
  } catch (error) {
    console.error("Error fetching random line:", error);
    randLine = `Error fetching random line: ${String(error)}`;
  }

  return randLine;
}
export async function _randomLines(count: number = 3) {
  let result = ""
  
  for(let i = 0; i < count; i++){
    result += await _randomLine() + "\n";
  }
  console.log("TOOLFUNCTION_randomLines", result);
  return result;
}

// Function to pull a random block from a random BlockarizeResearchObject
export async function _randomBlock(verseOrChorus: 'verse' | 'chorus') {
  const dbName = "BlockarizeResearchObject";
  const dbName2 = "WordPlayExample";
  let result = ""

  try {
    let randSongs = await db.generalPurpose.findMany({
      where: {
        name: dbName,
      },
    });
   
    console.log("randSongs", randSongs.length);

    const randSong = randSongs[Math.floor(Math.random() * randSongs.length)];
    //console.log("randSong", randSong);

    let bSong: BlockLyricType[] = JSON.parse(randSong.content);

    //console.log("bSong", bSong);

    if (verseOrChorus === 'verse') {
      bSong = bSong.filter((block) => block.text[0].text.toLowerCase().includes('chorus'));
    } else if (verseOrChorus === 'chorus') {
      bSong = bSong.filter((block) => block.text[0].text.toLowerCase().includes('verse'));
    }

    const randBlock = bSong[Math.floor(Math.random() * bSong.length)];
    //console.log("randBlock", randBlock);
    // Remove the first line from the block
    randBlock.text = randBlock.text.filter((line, index) => index !== 0 && line.text.length > 10);

    result = randBlock.text.map((line) => line.text).join("\n");
    console.log("TOOLFUNCTION_randomBlock", result);
   

     //randLine = randBlock.text.
  } catch (error) {
    console.error("Error fetching random block:", error);
    result = `Error fetching random block: ${String(error)}`;
  }
  return result;
}

export async function _similaritySearchLine(query: string, numResults: number) {
  const response = await PINECONE_search(query, 'RandomLines', {}, numResults);
  return response
}

// Tool to find synonyms of a given word
// export const AITOOL_synonymsTool = new DynamicStructuredTool({
//   name: "word-finder",
//   description: "retrieves toolfunction_synonyms of a given word",
//   schema: z.object({
//     word: z.string(),
//   }),
//   func: async ({ word }) => {
//     return await TOOLFUNCTION_synonyms(word);
//   },
// });

// // Tool to find rhymes of a given word
// export const AITOOL_ryhmingTool = new DynamicStructuredTool({
//   name: "ryhme-finder",
//   description: "retrieves rhymes of a given word",
//   schema: z.object({
//     word: z.string(),
//   }),
//   func: async ({ word }) => {
//     return await TOOLFUNCTION_rymingDictionary(word);
//   },
// });

// // Tool to search the web using bing
// export const AITOOL_bingSearchTool = new DynamicStructuredTool({
//   name: "bing-search",
//   description: "searches the web using bing",
//   schema: z.object({
//     query: z.string(),
//     count: z.number().optional(),
//     offset: z.number().optional(),
//     mkt: z.string().optional(),
//     safeSearch: z.string().optional(),
//   }),
//   func: async ({ query, count, offset, mkt, safeSearch }) => {
//     return await TOOLFUNCTION_bingSearch(query, count, offset, mkt, safeSearch);
//   },
// });

// // Tool to get a random word
// export const AITOOL_RandomWordTool = new DynamicStructuredTool({
//   name: "random-word",
//   description: "retrieves a random word",
//   schema: z.object({
//     word: z.string(),
//   }),
//   func: async () => {
//     return (await TOOLFUNCTION_randomWord()) || "Thee";
//   },
// });
