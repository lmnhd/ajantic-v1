import { tool } from "ai";
import { z } from "zod";
import { TextChatLogProps } from "@/src/lib/text-chat-log";
import {
  CORE_scrapeAndSummarizeUrl,
  CORE_scrapeUrl,
  CORE_crawlUrl,
  CORE_generateReferenceDocument,
  CORE_scrapeAndQueryUrl,
} from "./url-scrape_core";
import { logger } from "../../logger"; // Assuming logger is available

/**
 * Returns URL scraping tools configured with provided chat logs
 */
export const AGENT_TOOLS_urlScrape = (textChatLogs: TextChatLogProps[]) => {
  // --- Add flag(s) here ---
  // Use separate flags if you want to allow one of each type per turn,
  // or a single flag if only one scrape operation total is allowed.
  // Let's start with one flag for any data-intensive scrape.
  let dataScrapeToolCalledThisTurn = false;
  const alreadyCalledMessage = "Tool already called this turn. Please process the previous result before calling again.";

  return {
    scrapeAndSummarizeUrl: tool({
      description: "Scrape a URL and generate a concise summary of its main content. Best for getting a general overview of a page. (Limit: Once per turn)",
      parameters: z.object({
        url: z.string().describe("The URL to scrape and summarize."),
      }),
      execute: async ({ url }) => {
        // Check the flag
        if (dataScrapeToolCalledThisTurn) {
            logger.warn("URL_SCRAPE_scrapeAndSummarizeUrl - Tool call limit reached this turn.", { url });
            return alreadyCalledMessage;
        }
        // Set the flag
        dataScrapeToolCalledThisTurn = true;

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
    
    scrapeAndQueryUrl: tool({
        description: "Scrape a URL and return the `topK` most relevant text chunks based on a **specific, focused query**. Use this for targeted information retrieval within a page. **Prefer low `topK` (e.g., 1-2)** for efficiency. (Limit: Once per turn)",
        parameters: z.object({
            url: z.string().describe("The URL to scrape and query."),
            query: z.string().describe("The specific question or topic to search for within the page content."),
            topK: z.number().optional().default(3).describe("Optional: The maximum number of relevant text chunks to return (default: 3, recommended: 1-2)."),
        }),
        execute: async ({ url, query, topK }) => {
            // Check the flag
            if (dataScrapeToolCalledThisTurn) {
                logger.warn("URL_SCRAPE_scrapeAndQueryUrl - Tool call limit reached this turn.", { url, query });
                console.warn(`[TOOL_WARN] scrapeAndQueryUrl limit reached for ${url}`);
                return alreadyCalledMessage;
            }
            // Set the flag
            dataScrapeToolCalledThisTurn = true;
            console.log(`[TOOL] Executing scrapeAndQueryUrl for ${url}`);

            textChatLogs.push({
                role: "function",
                message: `Scraping URL (${url}) and querying for: "${query}" (topK: ${topK})`,
                agentName: "URL_SCRAPE_scrapeAndQueryUrl",
                timestamp: new Date(),
            });
            const result = await CORE_scrapeAndQueryUrl(url, query, topK);
            return result;
        },
    }),
    
    scrapeUrl: tool({
      description: "Scrape a URL and return its raw markdown content. Less preferred; use other scrape tools. (Limit: Once per turn - Shared limit)",
      parameters: z.object({
        url: z.string().describe("The URL to scrape."),
      }),
      execute: async ({ url }) => {
        // Check the flag
        if (dataScrapeToolCalledThisTurn) {
            logger.warn("URL_SCRAPE_scrapeUrl - Tool call limit reached this turn.", { url });
            return alreadyCalledMessage;
        }
        // Set the flag
        dataScrapeToolCalledThisTurn = true;

        textChatLogs.push({
          role: "function",
          message: `Scraping URL (raw): ${url}`,
          agentName: "URL_SCRAPE_scrapeUrl",
          timestamp: new Date(),
        });
        const result = await CORE_scrapeUrl(url);
        return result;
      },
    }),
    
    crawlUrl: tool({
      description: "Crawl a starting URL and return a list of linked page titles and URLs found (up to a limit). Does not return page content.",
      parameters: z.object({
        url: z.string().describe("The starting URL to crawl."),
      }),
      execute: async ({ url }) => {
        // No flag check here, assuming crawl is less intensive/problematic
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