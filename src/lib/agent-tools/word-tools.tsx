import {
  _randomWord,
  TOOLFUNCTION_randomLine,
  TOOLFUNCTION_rymingDictionary,
  TOOLFUNCTION_synonyms,
  _randomBlock,
  _randomLines,
  _similaritySearchLine,
} from "@/src/app/api/tools";
import { AGENT_TOOLS_EMULATOR } from "@/src/lib/types";
import { tool } from "ai";
import z from "zod";
import { TextChatLogProps } from "../text-chat-log";
import { logger } from '@/src/lib/logger';

export const AGENT_TOOLS_word = (textChatLogs: TextChatLogProps[]) => {
  return {
    randomWord: tool({
      description: `Pull a random word from a random BlockarizeResearchObject.`,
      parameters: z.object({}),
      execute: async (_) => {
        logger.tool("Word Tool - Getting Random Word");
        
        textChatLogs.push({
          role: "function",
          message: "Getting a random word",
          agentName: "WORD_randomWord",
          timestamp: new Date(),
        });
        
        try {
          const word = await _randomWord();
          logger.tool("Word Tool - Random Word Retrieved", { word });
          return word;
        } catch (error) {
          logger.tool("Word Tool - Random Word Error", {
            error: (error as Error).message
          });
          throw error;
        }
      },
    }),
    randomLines: tool({
      description: `Pull a random line from a random BlockarizeResearchObject.`,
      parameters: z.object({
        count: z.number().describe("The number of lines to return."),
      }),
      execute: async ({ count }) => {
        logger.tool("Word Tool - Getting Random Lines", { count });
        
        textChatLogs.push({
          role: "function",
          message: `Getting ${count} random lines`,
          agentName: "WORD_randomLines",
          timestamp: new Date(),
        });
        
        try {
          const lines = await _randomLines(count);
          logger.tool("Word Tool - Random Lines Retrieved", { 
            count: lines.length 
          });
          return lines;
        } catch (error) {
          logger.tool("Word Tool - Random Lines Error", {
            error: (error as Error).message
          });
          throw error;
        }
      },
    }),
    randomBlock: tool({
      description: `Pull a random block from a random BlockarizeResearchObject.`,
      parameters: z.object({
        verseOrChorus: z
          .enum(["verse", "chorus"])
          .describe("Choose verse or chorus."),
      }),
      execute: async ({ verseOrChorus }) => {
        logger.tool("Word Tool - Getting Random Block", { type: verseOrChorus });
        
        textChatLogs.push({
          role: "function",
          message: `Getting a random ${verseOrChorus} block`,
          agentName: "WORD_randomBlock",
          timestamp: new Date(),
        });
        
        try {
          const block = await _randomBlock(verseOrChorus);
          logger.tool("Word Tool - Random Block Retrieved", { 
            type: verseOrChorus,
            blockLength: block.length 
          });
          return block;
        } catch (error) {
          logger.tool("Word Tool - Random Block Error", {
            type: verseOrChorus,
            error: (error as Error).message
          });
          throw error;
        }
      },
    }),
    similarLines: tool({
      description: `Find similar lines to a given line.`,
      parameters: z.object({
        line: z.string().describe("The line to find similar lines to."),
        numResults: z
          .number()
          .describe("The number of similar lines to return."),
      }),
      execute: async ({ line }) => {
        logger.tool("Word Tool - Finding Similar Lines", { 
          line: line.substring(0, 50) + (line.length > 50 ? "..." : "") 
        });
        
        textChatLogs.push({
          role: "function",
          message: `Finding similar lines to: ${line}`,
          agentName: "WORD_similarLines",
          timestamp: new Date(),
        });
        
        try {
          const similarLines = await _similaritySearchLine(line, 10);
          logger.tool("Word Tool - Similar Lines Found", { 
            count: similarLines.length 
          });
          return similarLines;
        } catch (error) {
          logger.tool("Word Tool - Similar Lines Error", {
            error: (error as Error).message
          });
          throw error;
        }
      },
    }),
    rhymeFinder: tool({
      description: `Find rhyming words for a given word.`,
      parameters: z.object({
        word: z.string().describe("The word to find rhymes for."),
      }),
      execute: async ({ word }) => {
        logger.tool("Word Tool - Finding Rhymes", { word });
        
        textChatLogs.push({
          role: "function",
          message: `Finding rhymes for: ${word}`,
          agentName: "WORD_rhymeFinder",
          timestamp: new Date(),
        });
        
        try {
          const rhymes = await TOOLFUNCTION_rymingDictionary(word);
          logger.tool("Word Tool - Rhymes Found", { 
            word,
            count: rhymes.length 
          });
          return rhymes;
        } catch (error) {
          logger.tool("Word Tool - Rhymes Error", {
            word,
            error: (error as Error).message
          });
          throw error;
        }
      },
    }),
    wordFinder: tool({
      description: `Find synonyms for a given word.`,
      parameters: z.object({
        word: z.string().describe("The word to find synonyms for."),
      }),
      execute: async ({ word }) => {
        logger.tool("Word Tool - Finding Synonyms", { word });
        
        textChatLogs.push({
          role: "function",
          message: `Finding synonyms for: ${word}`,
          agentName: "WORD_wordFinder",
          timestamp: new Date(),
        });
        
        try {
          const synonyms = await TOOLFUNCTION_synonyms(word);
          logger.tool("Word Tool - Synonyms Found", { 
            word,
            count: synonyms.length 
          });
          return synonyms;
        } catch (error) {
          logger.tool("Word Tool - Synonyms Error", {
            word,
            error: (error as Error).message
          });
          throw error;
        }
      },
    }),
  };
};

export const AGENT_TOOLS_EMULATOR_word = (): AGENT_TOOLS_EMULATOR[] => {
  return [
    {
      name: "randomWord",
      description: "Pull a random word from a random BlockarizeResearchObject.",
      parameters: [],
      execute: async () => {
        return await _randomWord();
      },
    },
    {
      name: "randomLines",
      description: "Pull a random line from a random BlockarizeResearchObject.",
      parameters: [
        {
          name: "count",
          type: "number",
          description: "The number of lines to return.",
        },
      ],
      execute: async (parameters: Record<string, string>) => {
        const count = parseInt(parameters["count"]);
        return await _randomLines(count);
      },
    },
    {
      name: "randomBlock",
      description:
        "Pull a random block from a random BlockarizeResearchObject.",
      parameters: [
        {
          name: "verseOrChorus",
          type: "string",
          description: "Choose verse or chorus.",
        },
      ],
      execute: async (parameters: Record<string, string>) => {
        const verseOrChorus = parameters["verseOrChorus"] as "verse" | "chorus";
        return await _randomBlock(verseOrChorus);
      },
    },
    {
      name: "similarLines",
      description: "Find similar lines to a given line.",
      parameters: [
        {
          name: "line",
          type: "string",
          description: "The line to find similar lines to.",
        },
      ],
      execute: async (parameters: Record<string, string>) => {
        const line = parameters["line"];
        return await _similaritySearchLine(line, 10);
      },
    },
    {
      name: "rhymeFinder",
      description: "Find rhyming words for a given word.",
      parameters: [
        {
          name: "word",
          type: "string",
          description: "The word to find rhymes for.",
        },
      ],
      execute: async (parameters: Record<string, string>) => {
        const word = parameters["word"];
        return await TOOLFUNCTION_rymingDictionary(word);
      },
    },
    {
      name: "wordFinder",
      description: "Find synonyms for a given word.",
      parameters: [
        {
          name: "word",
          type: "string",
          description: "The word to find synonyms for.",
        },
      ],
      execute: async (parameters: Record<string, string>) => {
        const word = parameters["word"];
        return await TOOLFUNCTION_synonyms(word);
      },
    },
  ];
};
