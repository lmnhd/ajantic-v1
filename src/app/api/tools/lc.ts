import { DynamicStructuredTool } from "@langchain/core/tools";

import z from "zod";
import { TOOLFUNCTION_bingSearch, TOOLFUNCTION_randomWord, TOOLFUNCTION_rymingDictionary, TOOLFUNCTION_synonyms } from ".";

//Tool to find synonyms of a given word
export const AITOOL_synonymsTool = new DynamicStructuredTool({
  name: "word-finder",
  description: "retrieves toolfunction_synonyms of a given word",
  schema: z.object({
    word: z.string(),
  }),
  func: async ({ word }) => {
    return await TOOLFUNCTION_synonyms(word);
  },
});

// Tool to find rhymes of a given word
export const AITOOL_ryhmingTool = new DynamicStructuredTool({
  name: "ryhme-finder",
  description: "retrieves rhymes of a given word",
  schema: z.object({
    word: z.string(),
  }),
  func: async ({ word }) => {
    return await TOOLFUNCTION_rymingDictionary(word);
  },
});

// Tool to search the web using bing
export const AITOOL_bingSearchTool = new DynamicStructuredTool({
  name: "bing-search",
  description: "searches the web using bing",
  schema: z.object({
    query: z.string(),
    count: z.number().optional(),
    offset: z.number().optional(),
    mkt: z.string().optional(),
    safeSearch: z.string().optional(),
  }),
  func: async ({ query, count, offset, mkt, safeSearch }) => {
    return await TOOLFUNCTION_bingSearch(query, count, offset, mkt, safeSearch);
  },
});

// Tool to get a random word
export const AITOOL_RandomWordTool = new DynamicStructuredTool({
  name: "random-word",
  description: "retrieves a random word",
  schema: z.object({
    word: z.string(),
  }),
  func: async () => {
    return (await TOOLFUNCTION_randomWord()) || "Thee";
  },
});