import { generateText, tool } from "ai";
import * as cheerio from "cheerio";
import { MODEL_getModel_ai } from "../vercelAI-model-switcher";

import { ModelProviderEnum } from "@/src/lib/types";
import FirecrawlApp, {
  CrawlParams,
  CrawlStatusResponse,
  ScrapeResponse,
} from "@mendable/firecrawl-js";
import { z } from "zod";
import { db } from "@/src/lib/db";
import { SERVER_storeGeneralPurposeData } from "@/src/lib/server";
import puppeteer from "puppeteer-core";
import { TextChatLogProps } from "../text-chat-log";
import { logger } from "@/src/lib/logger";

export async function TOOLFUNCTION_scrapeAndSummarizeUrl(url: string) {
  let result = "";
  try {
    const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
    logger.tool("Starting webpage scrape", {
      action: "URL_SCRAPE_START",
      url,
    });

    const scrapeResponse = await app.scrapeUrl(url, {
      formats: ["markdown", "html"],
    });

    if (!scrapeResponse.success) {
      logger.error("Failed to scrape webpage", {
        action: "URL_SCRAPE_FAILED",
        url,
        error: scrapeResponse.error,
      });
      throw new Error(`Failed to scrape: ${scrapeResponse.error}`);
    }

    logger.tool("Generating summary of webpage content", {
      action: "URL_SUMMARIZE_START",
      contentLength: scrapeResponse.markdown?.length || 0,
    });

    const response2 = await generateText({
      model: await MODEL_getModel_ai({
        modelName: "gpt-4o-mini",
        provider: ModelProviderEnum.OPENAI,
        temperature: 0,
      }),
      prompt: `Extract and summarize the PRIMARY content of this page only and return it as easy to read markdown. Ignore all extraneous elements and info like ads, scripts, navigation, etc: ${scrapeResponse.markdown}`,
    });

    result = response2.text;
    logger.tool("Webpage summary generated", {
      action: "URL_SUMMARIZE_COMPLETE",
      summaryLength: result.length,
    });
  } catch (error) {
    logger.error("Failed to process webpage", {
      action: "URL_PROCESS_ERROR",
      url,
      error: error instanceof Error ? error.message : String(error),
    });
    result = `Error: ${error}`;
  }
  return result;
}

export async function TOOLFUNCTION_scrapeUrl(url: string) {
  let result = "";
  try {
    const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
    const scrapeResponse = await app.scrapeUrl(url, {
      formats: ["markdown", "html"],
    });
    result = (scrapeResponse as ScrapeResponse).markdown || "";
  } catch (error) {
    console.error("Error in TOOLFUNCTION_scrapeUrl:", error);
    result = `Error: ${error}`;
  }
  return result;
}
export async function TOOLFUNCTION_crawlUrl(url: string) {
  try {
    const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
    const crawlResponse = await app.crawlUrl(url, {
      limit: 100,
    });
    console.log("crawlResponse", crawlResponse);
    return (crawlResponse as CrawlStatusResponse).data
      .map((d) => d.metadata?.title + " - " + d.metadata?.sourceURL)
      .join("\n");
  } catch (error) {
    console.error("Error in TOOLFUNCTION_crawlUrl:", error);
    return `Error: ${error}`;
  }
}

export const AGENT_TOOLS_urlScrape = (textChatLogs: TextChatLogProps[]) => {
  return {
    scrapeAndSummarizeUrl: tool({
      description: "Scrape a URL and summarize its content",
      parameters: z.object({
        url: z.string(),
      }),
      execute: async ({ url }) => {
        logger.tool("Processing webpage content", {
          action: "URL_PROCESS_START",
          url,
        });

        textChatLogs.push({
          role: "function",
          message: `Scraping and summarizing URL: ${url}`,
          agentName: "URL_SCRAPE_scrapeAndSummarizeUrl",
          timestamp: new Date(),
        });
        const result = await TOOLFUNCTION_scrapeAndSummarizeUrl(url);
        logger.tool("URL Scrape Tool - Scrape and Summarize Complete", {
          url,
          resultLength: result.length,
        });
        return result;
      },
    }),
    scrapeUrl: tool({
      description: "Scrape a URL and return its content",
      parameters: z.object({
        url: z.string(),
      }),
      execute: async ({ url }) => {
        logger.tool("URL Scrape Tool - Scrape", { url });
        textChatLogs.push({
          role: "function",
          message: `Scraping URL: ${url}`,
          agentName: "URL_SCRAPE_scrapeUrl",
          timestamp: new Date(),
        });
        const result = await TOOLFUNCTION_scrapeUrl(url);
        logger.tool("URL Scrape Tool - Scrape Complete", {
          url,
          resultLength: result.length,
        });
        return result;
      },
    }),
    crawlUrl: tool({
      description: "Crawl a URL and return its content and all linked pages",
      parameters: z.object({
        url: z.string(),
      }),
      execute: async ({ url }) => {
        logger.tool("URL Scrape Tool - Crawl", { url });
        textChatLogs.push({
          role: "function",
          message: `Crawling URL: ${url}`,
          agentName: "URL_SCRAPE_crawlUrl",
          timestamp: new Date(),
        });
        const result = await TOOLFUNCTION_crawlUrl(url);
        logger.tool("URL Scrape Tool - Crawl Complete", {
          url,
          resultLength: result.length,
        });
        return result;
      },
    }),
  };
};

export const AGENT_PROCESS_documentInfo = async (
  task: string = `research and write a 1 page cheat sheet for using 'Power Shell' to automate tasks.`,
  nameOfDocument: string = "powershell_cheat_sheet"
) => {
  let response = "";
  try {
    logger.tool("Generating reference document", {
      action: "DOC_GEN_START",
      task: task.substring(0, 50) + (task.length > 50 ? "..." : ""),
      document: nameOfDocument,
    });

    const _res = await generateText({
      model: await MODEL_getModel_ai({
        modelName: "gpt-4o-mini",
        provider: ModelProviderEnum.OPENAI,
        temperature: 0,
      }),
      prompt: `Use the provided tools to ${task}`,
      tools: AGENT_TOOLS_urlScrape([]),
      maxSteps: 30,
    });
    console.log("response", _res.text);

    const _dbName = "research_analysis_agent_tools_url_scrape";
    await SERVER_storeGeneralPurposeData(
      _res.text,
      task,
      nameOfDocument,
      "",
      _dbName,
      true
    );
    response = _res.text;

    logger.tool("Reference document generated", {
      action: "DOC_GEN_COMPLETE",
      document: nameOfDocument,
      contentLength: response.length,
    });
  } catch (error) {
    logger.error("Failed to generate reference document", {
      action: "DOC_GEN_ERROR",
      document: nameOfDocument,
      error: error instanceof Error ? error.message : String(error),
    });
    response = `Error: ${error}`;
  }
  return response;
};

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
        console.log(
          "AGENT_TOOLS_generateReferenceDocuments: execute",
          task,
          nameOfDocument
        );
        textChatLogs.push({
          role: "function",
          message: `Generating reference document: ${task} with name ${nameOfDocument}`,
          agentName: "URL_SCRAPE_generateReferenceDocuments",
          timestamp: new Date(),
        });
        return await AGENT_PROCESS_documentInfo(task, nameOfDocument);
      },
    }),
  };
};

export const TEST_PUPPETER_BROWSER = async () => {
  (async () => {
    const browser = await puppeteer.connect({
      browserWSEndpoint: `wss://connect.browserbase.com?apiKey=${process.env.BROWSERBASE_API_KEY}`,
    });

    const pages = await browser.pages();
    const page = pages[0];

    await page.goto("https://www.browserbase.com");
    console.log("page title", await page.title());
    await page.close();
    await browser.close();

    return "done";
  })().catch((error) => console.error(error.message));
};

export const TEST_AGENT_CREATE_GMAIL = async () => {
  const prompt = `
    Use the following cheat sheet and provided tools to create a test gmail account and return the new address name and password.
    If unable to complete this task, please give information on how to resolve the issue.
    ### Cheat Sheet for Creating a New Gmail Account## Steps to Create a New Google Account1. **Visit the Sign-In Page**:    - Go to the [Google Account sign-in page](https://accounts.google.com/signin).2. **Start Account Creation**:   - Click on **Create account**.   - Choose the type of account you want to create:      - Personal     - Child     - Business3. **Fill in Your Information**:   - Enter the following details:     - **Name**: First and last name.     - **Birthday**: Enter your date of birth.     - **Gender**: Select your gender.     - **Username**: Choose a unique username (this will be your Gmail address).     - **Password**: Create a strong password and confirm it.4. **Phone Number Verification (Optional)**:   - You can add and verify a phone number for account recovery and security.5. **Complete the Process**:   - Click **Next** to proceed with the account creation.## Important Notes- **Username Availability**:   - You cannot use a username that is already taken or very similar to an existing one.- **Gmail vs. Google Account**:   - A Gmail account is a type of Google Account, but you can create a Google Account using a non-Gmail email address.- **Account Security**:   - Enhance your account security by adding recovery information, such as a phone number or an alternate email address.- **Using Existing Credentials**:   - If you already have a Google Account, you can use the same credentials to sign in to other Google products.- **Feedback and Notifications**:   - You can change where your Google notifications are sent and provide feedback about the account creation process.This cheat sheet provides a concise guide for AI agents to assist users in creating a new Gmail account efficiently.`;

  const response = await generateText({
    model: await MODEL_getModel_ai({
      modelName: "gpt-4o-mini",
      provider: ModelProviderEnum.OPENAI,
      temperature: 0,
    }),
    prompt: prompt,
    tools: AGENT_TOOLS_urlScrape([]),
    maxSteps: 30,
  });
  return response.text;
};
