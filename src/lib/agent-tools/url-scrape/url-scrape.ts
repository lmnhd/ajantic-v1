import { tool } from "ai";
import { z } from "zod";
import { TextChatLogProps } from "@/src/lib/text-chat-log";
import {
  CORE_scrapeAndSummarizeUrl,
  CORE_scrapeUrl,
  CORE_crawlUrl,
  CORE_generateReferenceDocument
} from "./url-scrape_core";

/**
 * Returns URL scraping tools configured with provided chat logs
 */
export const AGENT_TOOLS_urlScrape = (textChatLogs: TextChatLogProps[]) => {
  return {
    scrapeAndSummarizeUrl: tool({
      description: "Scrape a URL and summarize its content",
      parameters: z.object({
        url: z.string(),
      }),
      execute: async ({ url }) => {
        textChatLogs.push({
          role: "function",
          message: `Scraping and summarizing URL: ${url}`,
          agentName: "URL_SCRAPE_scrapeAndSummarizeUrl",
          timestamp: new Date(),
        });
        const result = await CORE_scrapeAndSummarizeUrl(url);
        return result;
      },
    }),
    
    scrapeUrl: tool({
      description: "Scrape a URL and return its content",
      parameters: z.object({
        url: z.string(),
      }),
      execute: async ({ url }) => {
        textChatLogs.push({
          role: "function",
          message: `Scraping URL: ${url}`,
          agentName: "URL_SCRAPE_scrapeUrl",
          timestamp: new Date(),
        });
        const result = await CORE_scrapeUrl(url);
        return result;
      },
    }),
    
    crawlUrl: tool({
      description: "Crawl a URL and return its content and all linked pages",
      parameters: z.object({
        url: z.string(),
      }),
      execute: async ({ url }) => {
        textChatLogs.push({
          role: "function",
          message: `Crawling URL: ${url}`,
          agentName: "URL_SCRAPE_crawlUrl",
          timestamp: new Date(),
        });
        const result = await CORE_crawlUrl(url);
        return result;
      },
    }),
  };
};

/**
 * Returns reference document generation tools configured with provided chat logs
 */
export const AGENT_TOOLS_generateReferenceDocuments = (
  textChatLogs: TextChatLogProps[]
) => {
  return {
    REFERENCE_DOCUMENT_generate: tool({
      description: `Generate a reference document for a given tool, technique, or process.`,
      parameters: z.object({
        task: z
          .string()
          .describe(
            "The subject and size of the document to generate. ex: research and write a 1 page cheat sheet for using 'Power Shell' to automate tasks."
          ),
        nameOfDocument: z
          .string()
          .describe(
            "The name of the document to generate. ex: powershell_cheat_sheet"
          ),
      }),
      execute: async ({ task, nameOfDocument }) => {
        textChatLogs.push({
          role: "function",
          message: `Generating reference document: ${task} with name ${nameOfDocument}`,
          agentName: "URL_SCRAPE_generateReferenceDocuments",
          timestamp: new Date(),
        });
        return await CORE_generateReferenceDocument(task, nameOfDocument);
      },
    }),
  };
}; 