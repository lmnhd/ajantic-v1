'use server';

import { anthropic } from "@ai-sdk/anthropic";
import { convertToCoreMessages, generateText, tool } from "ai";
// @ts-ignore
import { JSDOM } from "jsdom";
// @ts-ignore
import { chromium } from "playwright";
// @ts-ignore
import { Readability } from "@mozilla/readability";
// @ts-ignore
import puppeteer from "puppeteer-core";
// @ts-ignore
import { db } from "@/src/lib/db";
import { z } from "zod";
// @ts-ignore
import {
  AGENT_TOOLS_queryHTML,
  TOOLFUNCTION_htmlToVectorStore,
  TOOLFUNCTION_queryHTML,
} from "@/src/lib/agent-tools/parsers/html-vectorstore";
import { VectorStoreRetriever } from "@langchain/core/vectorstores";
// @ts-ignore
import { htmlToText } from "html-to-text";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
// @ts-ignore
import { AGENT_TOOLS_EMULATOR } from "@/src/lib/types";
// @ts-ignore
import { TextChatLogProps } from "@/src/lib/text-chat-log";
// @ts-ignore
import { logger } from '@/src/lib/logger';

// Global variables to maintain puppeteer instances
let globalPuppeteerClient: any;
let globalPuppeteerPage: any;

// Simplified session creation
export async function createSession() {
  logger.tool("Browserbase Tool - Creating Session", {
    projectId: process.env.BROWSERBASE_PROJECT_ID
  });
  
  const bb_api_key = process.env.BROWSERBASE_API_KEY!;
  const response = await fetch(`https://www.browserbase.com/v1/sessions`, {
    method: "POST",
    headers: {
      "x-bb-api-key": process.env.BROWSERBASE_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ projectId: process.env.BROWSERBASE_PROJECT_ID! }),
  });
  const { id } = await response.json();
  logger.tool("Browserbase Tool - Session Created", { sessionId: id });
  return id;
}

// Function to get or create puppeteer client
export async function getPuppeteerClient(browserBaseOrLocal: string): Promise<any> {
  console.log("getPuppeteerClient called");
  
  try {
    // Check if existing client and page are still connected
    if (globalPuppeteerClient && globalPuppeteerPage) {
      try {
        // Test if the browser and page are still responsive
        await globalPuppeteerPage.title();
        console.log("Using existing puppeteer client and page");
        return globalPuppeteerClient;
      } catch (error) {
        console.log("Existing client/page disconnected, creating new ones");
        globalPuppeteerClient = undefined;
        globalPuppeteerPage = undefined;
      }
    }

    // Create new client
    if (browserBaseOrLocal === "browserbase") {
      const sessionId = await createSession();
      const wsUrl = `wss://connect.browserbase.com?apiKey=${process.env.BROWSERBASE_API_KEY}&sessionId=${sessionId}`;
      globalPuppeteerClient = await puppeteer.connect({ browserURL: wsUrl });
    } else {
      const findChrome = require('chrome-finder');
      try {
        const executablePath = findChrome();
        console.log("Executable path:", executablePath);
        globalPuppeteerClient = await puppeteer.launch({ 
          executablePath,
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
      } catch (error) {
        console.error('Could not find Chrome installation:', error);
        globalPuppeteerClient = await puppeteer.launch({ 
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
      }
    }
    
    // Create new page
    globalPuppeteerPage = await globalPuppeteerClient.newPage();
    await globalPuppeteerPage.setViewport({ width: 1280, height: 800 });

    // Set up disconnection handler
    globalPuppeteerClient.on('disconnected', () => {
      console.log("Browser disconnected");
      globalPuppeteerClient = undefined;
      globalPuppeteerPage = undefined;
    });

    console.log("Created new puppeteer client and page");
    return globalPuppeteerClient;

  } catch (error) {
    console.error("Error in getPuppeteerClient:", error);
    throw error;
  }
}

export async function getPuppeteerPage(): Promise<any> {
  if (!globalPuppeteerPage) {
    throw new Error("No global page available");
  }
  return globalPuppeteerPage;
}

// Page info fetching from google search
async function getPageInfo(message: string) {
  logger.tool("Browserbase Tool - Getting Page Info", { query: message });
  const sessionId = await createSession();
  const wsUrl = `wss://connect.browserbase.com?apiKey=${process.env.BROWSERBASE_API_KEY}&sessionId=${sessionId}`;

  const browser = await chromium.connectOverCDP(wsUrl);
  const page = browser.contexts()[0].pages()[0];

  // Use the user's message to create the search query
  const searchQuery = encodeURIComponent(`${message}?`);
  logger.tool("Browserbase Tool - Searching Google", { query: searchQuery });
  await page.goto(`https://www.google.com/search?q=${searchQuery}`);

  const content = await page.content();
  // Parse the content into a readable format
  const dom = new JSDOM(content);

  // Use the Readability library to extract the article content
  const article = new Readability(dom.window.document).parse();

  await browser.close();
  logger.tool("Browserbase Tool - Page Info Retrieved", { 
    hasContent: !!article?.textContent,
    contentLength: article?.textContent?.length || 0 
  });

  // Return the article content
  return article?.textContent || "";
}

// GET request to generate a response based on userMessage
export async function TOOLFUNCTION_browserbase_test(userMessage: string) {
  logger.tool("Browserbase Tool - Test Function", { message: userMessage });
  const info = await getPageInfo(userMessage);
  const response = await generateText({
    model: anthropic("claude-3-5-sonnet-20240620"),
    messages: convertToCoreMessages([
      { role: "system", content: "You are a helpful assistant" },
      { role: "user", content: `Info: ${info}\n\nQuestion: ${userMessage}` },
    ]),
  });
  logger.tool("Browserbase Tool - Test Response Generated", { responseLength: response.text.length });
  return response.text;
}

export async function TOOLFUNCTION_browserbase_test2(userMessage: string) {
  const sessionId = await createSession();
  const wsUrl = `wss://connect.browserbase.com?apiKey=${process.env.BROWSERBASE_API_KEY}&sessionId=${sessionId}`;

  const browser = await chromium.connectOverCDP(wsUrl);
  const page = browser.contexts()[0].pages()[0];

  await page.goto("https://developer.chrome.com/");

  // Type into search box.
  await page.locator(".devsite-search-field").fill("automate beyond recorder");

  // Wait and click on first result.
  await page.locator(".devsite-result-item-link").click();

  // Locate the full title with a unique string.
  const textSelector = await page
    .locator("text/Customize and automate")
    .evaluate((el: Element) => el.textContent);
  const fullTitle = await textSelector;

  // Print the full title.
  console.log('The title of this blog post is "%s".', fullTitle);

  await browser.close();
}

export async function TOOLFUNCTION_puppeteer(
  params: {
    url: string;
    action:
      | "page.click"
      | "page.content"
      | "page.select"
      | "page.cookies"
      | "page.evaluate"
      | "page.focus"
      | "page.goto"
      | "page.isClosed"
      | "page.goBack"
      | "page.goForward"
      | "page.reload"
      | "page.target"
      | "page.title"
      | "page.type"
      | "page.url"
      | "page.waitForRequest"
      | "page.waitForResponse"
      | "page.waitForSelector"
      | "page.waitForNavigation"
      | "page.waitForTimeout"
      | "page.waitForFunction";
    mode: "html" | "text";
    selector?: string;
    value?: string;
    waitFor?: number;
    options?: any;
    callBackForWaitFor?: (callBack: any) => void;
  },
  browserBaseOrLocal: "browserbase" | "local",
  vc: MemoryVectorStore
) {
  logger.tool("Puppeteer Tool - Starting Action", { 
    action: params.action,
    mode: params.mode,
    browserType: browserBaseOrLocal
  });

  let result = "";
  const browser: any = await getPuppeteerClient(
    browserBaseOrLocal
  );
  const _numPages = (await browser.browserContexts()[0].pages()).length;
  const page =
    (await browser.browserContexts()[0].pages())[_numPages - 1] ||
    (await browser.newPage());

  await page.setDefaultNavigationTimeout(0);

  switch (params.action) {
    case "page.click":
      try {
        logger.tool("Puppeteer Tool - Clicking Element", { selector: params.selector });
        await page.click(params.selector || "", params.options);
        result = "clicked";
      } catch (error) {
        logger.tool("Puppeteer Tool - Click Error", { 
          selector: params.selector,
          error: (error as Error).message 
        });
        result = "error clicking: " + error;
      }
      break;

    case "page.content":
      try {
        logger.tool("Puppeteer Tool - Getting Content", { mode: params.mode });
        const content =
          params.mode === "html"
            ? await page.content()
            : htmlToText(await page.content());
        const metadata = {
          url: page.url(),
          title: await page.title(),
        };
        logger.tool("Puppeteer Tool - Content Retrieved", { 
          contentLength: content.length,
          url: metadata.url,
          title: metadata.title
        });

        if (content.length > 500000) {
          logger.tool("Puppeteer Tool - Vectorizing Large Content");
          vc = await TOOLFUNCTION_htmlToVectorStore(
            { html: content, metaData: metadata },
            vc
          );
          result = "Content is too large to return. Use the queryHTML tool to retrieve this content...";
        } else {
          result = content;
        }
      } catch (error) {
        logger.tool("Puppeteer Tool - Content Error", { 
          error: (error as Error).message 
        });
        result = "error getting content: " + error;
      }
      break;

    case "page.select":
      try {
        await page.select(params.selector || "", params.value || "");
        result = "selected " + params.selector;
      } catch (error) {
        result = "error selecting: " + error;
      }
      break;
    case "page.cookies":
      try {
        result = JSON.stringify(await page.cookies());
      } catch (error) {
        result = "error getting cookies: " + error;
      }
      break;
    case "page.evaluate":
      try {
        result = await page.evaluate(params.value || "");
      } catch (error) {
        result = "error evaluating: " + error;
      }
      break;
    case "page.focus":
      try {
        await page.focus(params.selector || "");
        result = "focused on " + params.selector;
      } catch (error) {
        result = "error focusing: " + error;
      }
      break;
    case "page.goto":
      try {
        await page.goto(params.url, { waitUntil: "load", timeout: 0 });
        result = "navigated to " + params.url;
      } catch (error) {
        result = "error navigating: " + error;
      }
      break;
    case "page.isClosed":
      try {
        result = await page.isClosed().toString();
      } catch (error) {
        result = "error checking if closed: " + error;
      }
      break;
    case "page.goBack":
      try {
        await page.goBack();
        result = "navigated back";
      } catch (error) {
        result = "error going back: " + error;
      }
      break;
    case "page.goForward":
      try {
        await page.goForward();
        result = "navigated forward";
      } catch (error) {
        result = "error going forward: " + error;
      }
      break;
    case "page.reload":
      try {
        await page.reload();
        result = "reloaded";
      } catch (error) {
        result = "error reloading: " + error;
      }
      break;
    case "page.title":
      try {
        result = await page.title();
      } catch (error) {
        result = "error getting title: " + error;
      }
      break;
    case "page.type":
      try {
        await page.type(params.selector || "", params.value || "");
        result = "typed into " + params.selector;
      } catch (error) {
        result = "error typing: " + error;
      }
      break;
    case "page.waitForSelector":
      try {
        await page
          .waitForSelector(params.selector || "", {
            timeout: params.waitFor || 10000,
          })
          // @ts-ignore - Ignoring type errors for page.evaluate with callback
          .then((args: any) => {
            if (params.callBackForWaitFor) {
              // @ts-ignore - Ignoring type errors for page.evaluate with callback
              page.evaluate(params.callBackForWaitFor, args);
            }
            result = "waited for selector " + params.selector;
            console.log("Waited for selector: ", params.selector);
          });
      } catch (error) {
        result = "error waiting for selector: " + error;
      }
      break;
    case "page.url":
      try {
        result = await page.url();
      } catch (error) {
        result = "error getting url: " + error;
      }
      break;
    case "page.waitForNavigation":
      try {
        await page.waitForNavigation({ timeout: params.waitFor || 10000 });
        result = "waited for navigation";
      } catch (error) {
        result = "error waiting for navigation: " + error;
      }
      break;
    case "page.waitForTimeout":
      try {
        await page.waitForTimeout(params.waitFor || 10000);
        result = "waited for timeout";
      } catch (error) {
        result = "error waiting for timeout: " + error;
      }
      break;
    case "page.waitForFunction":
      try {
        await page.waitForFunction(params.value || "");
        result = "waited for function";
      } catch (error) {
        result = "error waiting for function: " + error;
      }
      break;
  }

  logger.tool("Puppeteer Tool - Action Complete", { 
    action: params.action,
    success: !result.includes("error")
  });
  return result;
}
const Action = z
  .enum([
    "page.click",
    "page.content",
    "page.select",
    "page.cookies",
    "page.evaluate",
    "page.focus",
    "page.goto",
    "page.isClosed",
    "page.goBack",
    "page.goForward",
    "page.reload",
    "page.title",
    "page.type",
    "page.waitForSelector",
    "page.url",
    "page.waitForRequest",
    "page.waitForResponse",
    "page.waitForNavigation",
    "page.waitForTimeout",
    "page.waitForFunction",
  ])
  .describe("The action to perform on the page.");

// --- CORE Functions for Tool Definitions ---

export const CORE_navigate = async (
    params: { url: string },
    browserBaseOrLocal: "browserbase" | "local",
    vc: MemoryVectorStore,
    textChatLogs: TextChatLogProps[]
): Promise<string> => {
    logger.tool("CORE: Puppeteer Navigate", { url: params.url });
    textChatLogs.push({ role: "function", message: `CORE: Navigating to ${params.url}`, agentName: "PUPPETEER_navigate", timestamp: new Date() });
    try {
        const result = await TOOLFUNCTION_puppeteer(
            { ...params, action: "page.goto", mode: "text" }, // mode is required by TOOLFUNCTION_puppeteer
            browserBaseOrLocal,
            vc
        );
        return JSON.stringify({ success: true, result });
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Navigation failed";
        logger.error("CORE: Puppeteer Navigate Error", { url: params.url, error: errorMsg });
        return JSON.stringify({ success: false, error: errorMsg });
    }
};

export const CORE_interact = async (
    params: { action: string; selector?: string; value?: string },
    browserBaseOrLocal: "browserbase" | "local",
    vc: MemoryVectorStore,
    textChatLogs: TextChatLogProps[]
): Promise<string> => {
    logger.tool("CORE: Puppeteer Interact", { action: params.action, selector: params.selector });
    textChatLogs.push({ role: "function", message: `CORE: Interacting - Action: ${params.action}, Selector: ${params.selector}`, agentName: "PUPPETEER_interact", timestamp: new Date() });
    try {
        // Need current URL - TOOLFUNCTION_puppeteer might need modification or we get it separately
        // For now, pass a placeholder or omit if TOOLFUNCTION_puppeteer doesn't strictly need it for these actions
        const result = await TOOLFUNCTION_puppeteer(
            { 
                url: "current_page_placeholder", // May need revision
                action: params.action as any, // Cast needed due to TOOLFUNCTION_puppeteer's specific enum
                selector: params.selector,
                value: params.value,
                mode: "text"
            },
            browserBaseOrLocal,
            vc
        );
        // TOOLFUNCTION_puppeteer returns stringified result/error
        return result; 
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Interaction failed";
        logger.error("CORE: Puppeteer Interact Error", { action: params.action, selector: params.selector, error: errorMsg });
        return JSON.stringify({ success: false, error: errorMsg });
    }
};

export const CORE_extract = async (
    params: { mode: "text" | "html"; selector?: string },
    browserBaseOrLocal: "browserbase" | "local",
    vc: MemoryVectorStore,
    textChatLogs: TextChatLogProps[]
): Promise<string> => {
    logger.tool("CORE: Puppeteer Extract", { mode: params.mode, selector: params.selector });
    textChatLogs.push({ role: "function", message: `CORE: Extracting content - Mode: ${params.mode}, Selector: ${params.selector}`, agentName: "PUPPETEER_extract", timestamp: new Date() });
    try {
        const result = await TOOLFUNCTION_puppeteer(
            { 
                url: "current_page_placeholder", // May need revision
                action: "page.content", // Or evaluate based on selector
                selector: params.selector,
                mode: params.mode 
            },
            browserBaseOrLocal,
            vc
        );
         // TOOLFUNCTION_puppeteer returns stringified result/error
        return result;
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Extraction failed";
        logger.error("CORE: Puppeteer Extract Error", { mode: params.mode, selector: params.selector, error: errorMsg });
        return JSON.stringify({ success: false, error: errorMsg });
    }
};

export const CORE_query = async (
    params: { query: string; selector?: string },
    browserBaseOrLocal: "browserbase" | "local",
    vc: MemoryVectorStore,
    textChatLogs: TextChatLogProps[]
): Promise<string> => {
     logger.tool("CORE: Puppeteer Query", { query: params.query, selector: params.selector });
     textChatLogs.push({ role: "function", message: `CORE: Querying page content - Query: ${params.query}, Selector: ${params.selector}`, agentName: "PUPPETEER_query", timestamp: new Date() });
    try {
        // 1. Extract relevant content using TOOLFUNCTION_puppeteer
        const contentResultString = await TOOLFUNCTION_puppeteer(
            { 
                url: "current_page_placeholder", // May need revision
                action: "page.content", 
                selector: params.selector, // Extract specific section if selector provided
                mode: "text" // Need clean text for querying
            },
            browserBaseOrLocal,
            vc
        );
        const contentResult = JSON.parse(contentResultString);
        if (!contentResult.success) {
            throw new Error(contentResult.error || "Failed to extract content for query");
        }
        const pageContent = contentResult.result;

        // 2. Use AI to answer the query based on the content
        // Placeholder for AI call - replace with actual implementation
        // Example using generateText:
        /*
        const response = await generateText({
            model: anthropic("claude-3-5-sonnet-20240620"), // Or your preferred model
            prompt: `Based on the following content from the webpage${params.selector ? ` (section: ${params.selector})` : ''}, answer the question.\n\nContent:\n${pageContent}\n\nQuestion: ${params.query}`,
        });
        const answer = response.text;
        */
        const answer = `Placeholder: AI would answer "${params.query}" based on extracted content.`; // Placeholder

        logger.tool("CORE: Puppeteer Query Successful", { query: params.query });
        return JSON.stringify({ success: true, answer });

    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Query failed";
        logger.error("CORE: Puppeteer Query Error", { query: params.query, selector: params.selector, error: errorMsg });
        return JSON.stringify({ success: false, error: errorMsg });
    }
};

