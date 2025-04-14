'use server';

import { generateText } from "ai";
import * as cheerio from "cheerio";
import { MODEL_getModel_ai } from "../../vercelAI-model-switcher";
import { ModelProviderEnum } from "@/src/lib/types";
import FirecrawlApp, {
  CrawlParams,
  CrawlStatusResponse,
  ScrapeResponse,
} from "@mendable/firecrawl-js";
import { SERVER_storeGeneralPurposeData } from "@/src/lib/server";
import puppeteer from "puppeteer-core";
import { logger } from "@/src/lib/logger";

/**
 * Core function to scrape and summarize a URL
 */
export async function CORE_scrapeAndSummarizeUrl(url: string) {
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

/**
 * Core function to scrape a URL without summarization
 */
export async function CORE_scrapeUrl(url: string) {
  let result = "";
  try {
    const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
    const scrapeResponse = await app.scrapeUrl(url, {
      formats: ["markdown", "html"],
    });
    result = (scrapeResponse as ScrapeResponse).markdown || "";
  } catch (error) {
    logger.error("Error in CORE_scrapeUrl:", {
      url,
      error: error instanceof Error ? error.message : String(error),
    });
    result = `Error: ${error}`;
  }
  return result;
}

/**
 * Core function to crawl URLs from a starting URL
 */
export async function CORE_crawlUrl(url: string) {
  try {
    const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
    const crawlResponse = await app.crawlUrl(url, {
      limit: 100,
    });
    return (crawlResponse as CrawlStatusResponse).data
      .map((d) => d.metadata?.title + " - " + d.metadata?.sourceURL)
      .join("\n");
  } catch (error) {
    logger.error("Error in CORE_crawlUrl:", {
      url,
      error: error instanceof Error ? error.message : String(error),
    });
    return `Error: ${error}`;
  }
}

/**
 * Core function to generate a reference document
 */
export async function CORE_generateReferenceDocument(
  task: string = `research and write a 1 page cheat sheet for using 'Power Shell' to automate tasks.`,
  nameOfDocument: string = "powershell_cheat_sheet"
) {
  let response = "";
  try {
    logger.tool("Generating reference document", {
      action: "DOC_GEN_START",
      task: task.substring(0, 50) + (task.length > 50 ? "..." : ""),
      document: nameOfDocument,
    });

    const model = await MODEL_getModel_ai({
      modelName: "gpt-4o-mini",
      provider: ModelProviderEnum.OPENAI,
      temperature: 0,
    });

    // Import tool functions directly here to avoid client-side usage
    const scrapeAndSummarizeUrl = async (url: string) => CORE_scrapeAndSummarizeUrl(url);
    const scrapeUrl = async (url: string) => CORE_scrapeUrl(url);
    const crawlUrl = async (url: string) => CORE_crawlUrl(url);

    // Create tools object for the generateText call
    const tools = {
      scrapeAndSummarizeUrl: {
        description: "Scrape a URL and summarize its content",
        parameters: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "The URL to scrape"
            }
          },
          required: ["url"]
        },
        execute: scrapeAndSummarizeUrl
      },
      scrapeUrl: {
        description: "Scrape a URL and return its content",
        parameters: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "The URL to scrape"
            }
          },
          required: ["url"]
        },
        execute: scrapeUrl
      },
      crawlUrl: {
        description: "Crawl a URL and return its content and all linked pages",
        parameters: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "The URL to crawl"
            }
          },
          required: ["url"]
        },
        execute: crawlUrl
      }
    };

    // Generate the document using the tools
    const _res = await generateText({
      model: model,
      prompt: `Use the provided tools to ${task}`,
      tools: tools,
      maxSteps: 30,
    });
    
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
}

/**
 * Legacy test function for Puppeteer
 */
export async function TEST_PUPPETER_BROWSER() {
  try {
    const browser = await puppeteer.connect({
      browserWSEndpoint: `wss://connect.browserbase.com?apiKey=${process.env.BROWSERBASE_API_KEY}`,
    });

    const pages = await browser.pages();
    const page = pages[0];

    await page.goto("https://www.browserbase.com");
    const title = await page.title();
    await page.close();
    await browser.close();

    return `Successfully connected to Browserbase and visited browserbase.com. Page title: ${title}`;
  } catch (error) {
    logger.error("Error in TEST_PUPPETER_BROWSER:", {
      error: error instanceof Error ? error.message : String(error),
    });
    return `Error: ${error}`;
  }
}

/**
 * Legacy test function for Gmail creation
 */
export async function TEST_AGENT_CREATE_GMAIL() {
  try {
    const prompt = `
    Use the following cheat sheet and provided tools to create a test gmail account and return the new address name and password.
    If unable to complete this task, please give information on how to resolve the issue.
    ### Cheat Sheet for Creating a New Gmail Account## Steps to Create a New Google Account1. **Visit the Sign-In Page**:    - Go to the [Google Account sign-in page](https://accounts.google.com/signin).2. **Start Account Creation**:   - Click on **Create account**.   - Choose the type of account you want to create:      - Personal     - Child     - Business3. **Fill in Your Information**:   - Enter the following details:     - **Name**: First and last name.     - **Birthday**: Enter your date of birth.     - **Gender**: Select your gender.     - **Username**: Choose a unique username (this will be your Gmail address).     - **Password**: Create a strong password and confirm it.4. **Phone Number Verification (Optional)**:   - You can add and verify a phone number for account recovery and security.5. **Complete the Process**:   - Click **Next** to proceed with the account creation.## Important Notes- **Username Availability**:   - You cannot use a username that is already taken or very similar to an existing one.- **Gmail vs. Google Account**:   - A Gmail account is a type of Google Account, but you can create a Google Account using a non-Gmail email address.- **Account Security**:   - Enhance your account security by adding recovery information, such as a phone number or an alternate email address.- **Using Existing Credentials**:   - If you already have a Google Account, you can use the same credentials to sign in to other Google products.- **Feedback and Notifications**:   - You can change where your Google notifications are sent and provide feedback about the account creation process.This cheat sheet provides a concise guide for AI agents to assist users in creating a new Gmail account efficiently.`;

    const model = await MODEL_getModel_ai({
      modelName: "gpt-4o-mini",
      provider: ModelProviderEnum.OPENAI,
      temperature: 0,
    });

    // Import tool functions directly here to avoid client-side usage
    const scrapeAndSummarizeUrl = async (url: string) => CORE_scrapeAndSummarizeUrl(url);
    const scrapeUrl = async (url: string) => CORE_scrapeUrl(url);
    const crawlUrl = async (url: string) => CORE_crawlUrl(url);

    // Create tools object for the generateText call
    const tools = {
      scrapeAndSummarizeUrl: {
        description: "Scrape a URL and summarize its content",
        parameters: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "The URL to scrape"
            }
          },
          required: ["url"]
        },
        execute: scrapeAndSummarizeUrl
      },
      scrapeUrl: {
        description: "Scrape a URL and return its content",
        parameters: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "The URL to scrape"
            }
          },
          required: ["url"]
        },
        execute: scrapeUrl
      },
      crawlUrl: {
        description: "Crawl a URL and return its content and all linked pages",
        parameters: {
          type: "object",
          properties: {
            url: {
              type: "string",
              description: "The URL to crawl"
            }
          },
          required: ["url"]
        },
        execute: crawlUrl
      }
    };

    const response = await generateText({
      model: model,
      prompt: prompt,
      tools: tools,
      maxSteps: 30,
    });
    
    return response.text;
  } catch (error) {
    logger.error("Error in TEST_AGENT_CREATE_GMAIL:", {
      error: error instanceof Error ? error.message : String(error),
    });
    return `Error: ${error}`;
  }
} 