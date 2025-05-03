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
import { MODEL_JSON, UTILS_getEmbeddings, UTILS_getModelArgsByName } from "../../utils";

// --- NEW IMPORTS ---
import { TOOLFUNCTION_split_text } from "@/src/app/api/tools/splitters"; // Assuming path
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { Document as LangchainDocument } from "@langchain/core/documents";
import { Embeddings } from "@langchain/core/embeddings"; // Import base Embeddings type
import { OpenAIEmbeddings } from "@langchain/openai";

/**
 * Core function to scrape and summarize a URL (Optimized)
 */
export async function CORE_scrapeAndSummarizeUrl(url: string) {
  let result = "";
  try {
    const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
    logger.tool("Starting webpage scrape", { action: "URL_SCRAPE_START", url });
    console.log(`[TOOL] Starting webpage scrape: ${url}`);

    // Ensure HTML format is requested
    const scrapeResponse = await app.scrapeUrl(url, {
      formats: ["markdown", "html"], // Keep markdown for potential fallback or other uses
    });

    // 1. Handle failure case first
    if (!scrapeResponse.success) {
      const errorMsg = `Failed to scrape webpage. Error: ${scrapeResponse.error || 'Unknown scrape error.'}`;
      logger.error(errorMsg, {
        action: "URL_SCRAPE_FAILED",
        url,
        error: scrapeResponse.error,
      });
      console.error(`[TOOL_ERROR] Scrape Failed: ${url} - ${errorMsg}`);
      throw new Error(errorMsg);
    }

    // 2. Handle success case, but missing HTML
    if (!scrapeResponse.html) {
      const errorMsg = `Scrape successful, but HTML content missing.`;
      logger.error(errorMsg, {
        action: "URL_SCRAPE_HTML_MISSING",
        url,
      });
      console.error(`[TOOL_ERROR] Scrape HTML Missing: ${url} - ${errorMsg}`);
      // Fallback to markdown if available (only reachable if success is true)
      if (scrapeResponse.markdown) {
         logger.warn("Falling back to summarizing raw markdown due to missing HTML content.", { url });
         console.warn(`[TOOL_WARN] Falling back to summarizing raw markdown for ${url}`);
         // Implement markdown summarization logic here if desired
         // For now, return error indicating fallback not implemented
         return `Error: Scrape successful but HTML missing, and fallback to Markdown summary is not implemented.`;
      } else {
         // If success is true, but no HTML and no Markdown, it's an issue.
         const finalErrorMsg = `Scrape successful, but both HTML and Markdown content are missing.`;
         logger.error(finalErrorMsg, { action: "URL_SCRAPE_CONTENT_MISSING", url });
         console.error(`[TOOL_ERROR] Scrape Content Missing: ${url} - ${finalErrorMsg}`);
         throw new Error(finalErrorMsg);
      }
    }

    // --- Optimization Start ---
    logger.tool("Extracting main content using Cheerio", {
      action: "URL_CONTENT_EXTRACTION_START",
      htmlLength: scrapeResponse.html.length,
    });
    console.log(`[TOOL] Extracting main content via Cheerio (HTML length: ${scrapeResponse.html.length}) for: ${url}`);

    const $ = cheerio.load(scrapeResponse.html);

    // Attempt to find main content - adjust selectors based on common patterns
    let mainContent = "";
    const selectors = ['article', 'main', '.main', '#main', '.post-content', '#content', '.entry-content', 'body']; // Add more specific selectors if known
    for (const selector of selectors) {
        const element = $(selector);
        if (element.length > 0) {
            // Remove common clutter *within* the selected element
            element.find('nav, header, footer, aside, script, style, noscript, iframe, form, button, input, select, textarea, [aria-hidden="true"], .ad, .advertisement, .sidebar, .related-posts, .comments, .share-buttons').remove();
            mainContent = element.text(); // Get text content
            if (mainContent.trim().length > 50) { // Basic check if content seems substantial
                 logger.log(`Extracted content using selector: ${selector}`);
                 break; // Use the first good match
            }
        }
    }

     // Fallback if no specific selector worked well, use body but still clean
    if (!mainContent || mainContent.trim().length <= 50) {
        logger.warn("Could not find specific main content element via selectors, falling back to cleaned body.", { url });
        const bodyElement = $('body');
        bodyElement.find('nav, header, footer, aside, script, style, noscript, iframe, form, button, input, select, textarea, [aria-hidden="true"], .ad, .advertisement, .sidebar, .related-posts, .comments, .share-buttons').remove();
        mainContent = bodyElement.text();
    }


    // Basic cleaning of the extracted text
    const cleanedContent = mainContent
        .replace(/\s\s+/g, ' ') // Replace multiple whitespace chars with single space
        .replace(/(\r\n|\n|\r){2,}/g, '\n') // Replace multiple newlines with single newline
        .trim();

     const MAX_CONTENT_LENGTH_FOR_SUMMARY = 15000; // Adjust as needed (chars)
     const truncatedContent = cleanedContent.length > MAX_CONTENT_LENGTH_FOR_SUMMARY
        ? cleanedContent.substring(0, MAX_CONTENT_LENGTH_FOR_SUMMARY) + "... (content truncated)"
        : cleanedContent;


    if (truncatedContent.length === 0) {
        logger.warn("Extracted content was empty after cleaning.", { action: "URL_CONTENT_EXTRACTION_EMPTY", url });
        console.warn(`[TOOL_WARN] Extracted content was empty after cleaning for ${url}`);
        return "Error: Could not extract meaningful content from the page.";
    }

    logger.tool("Generating summary of EXTRACTED webpage content", {
      action: "URL_SUMMARIZE_START",
      originalContentLength: cleanedContent.length,
      summarizationInputLength: truncatedContent.length,
    });
    // --- Optimization End ---

    const modelForSummary = await MODEL_getModel_ai(UTILS_getModelArgsByName(MODEL_JSON().Google["models/gemini-2.5-pro-exp-03-25"].name));
    const summaryPrompt = `You have been provided with the pre-extracted and cleaned main text content from a webpage. Please summarize this content concisely and return it as easy-to-read markdown. Focus on the key information present in the provided text:\n\n---\n${truncatedContent}\n---`;
    const summaryPromptChars = summaryPrompt.length;

    logger.tool("Generating summary of EXTRACTED webpage content", {
      action: "URL_SUMMARIZE_START",
      modelId: modelForSummary.modelId,
      originalContentLength: cleanedContent.length,
      summarizationInputLength: truncatedContent.length,
      promptChars: summaryPromptChars
    });
    console.log(`[TOOL] Generating summary for ${url}: Model=${modelForSummary.modelId}, InputChars=${truncatedContent.length}, PromptChars=${summaryPromptChars}`);

    if (summaryPromptChars > 18000) {
        logger.warn(`[CORE_scrapeAndSummarizeUrl] Summary prompt is large (~${summaryPromptChars} chars), potentially exceeding limits.`, { url });
        console.warn(`[TOOL_WARN] Summary prompt is large (~${summaryPromptChars} chars) for ${url}`);
    }

    const response2 = await generateText({
      model: modelForSummary,
      prompt: summaryPrompt,
    });

    result = response2.text;
    logger.tool("Webpage summary generated from extracted content", {
      action: "URL_SUMMARIZE_COMPLETE",
      modelId: modelForSummary.modelId,
      summaryLength: result.length,
      inputTokens: response2.usage?.promptTokens,
      outputTokens: response2.usage?.completionTokens,
      totalTokens: response2.usage?.totalTokens,
      finishReason: response2.finishReason,
    });
    console.log(`[TOOL] Summary complete for ${url}: ` +
        `Model=${modelForSummary.modelId}, ` +
        `SummaryLen=${result.length}, ` +
        `InTokens=${response2.usage?.promptTokens || 'N/A'}, ` +
        `OutTokens=${response2.usage?.completionTokens || 'N/A'}, ` +
        `TotalTokens=${response2.usage?.totalTokens || 'N/A'}, ` +
        `FinishReason=${response2.finishReason || 'N/A'}`
    );
  } catch (error) {
    logger.error("Failed to process webpage for summary", {
      action: "URL_PROCESS_SUMMARY_ERROR",
      url,
      error: error instanceof Error ? error.message : String(error),
    });
    console.error(`[TOOL_ERROR] Failed to process summary for ${url}: ${error instanceof Error ? error.message : String(error)}`);
    result = `Error summarizing URL ${url}: ${error instanceof Error ? error.message : String(error)}`;
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

/**
 * Core function to scrape a URL, chunk its content, store temporarily in Memory,
 * query it, and return relevant chunks.
 */
export async function CORE_scrapeAndQueryUrl(url: string, query: string, topK: number = 3) {
  try {
    const embeddings: Embeddings = await UTILS_getEmbeddings();
    if (!embeddings) {
        console.error("[TOOL_ERROR] Failed to initialize embeddings for scrapeAndQueryUrl");
        throw new Error("Failed to initialize embeddings.");
    }

    const app = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
    logger.tool("Starting webpage scrape for query", { action: "URL_SCRAPE_QUERY_START", url, query });
    console.log(`[TOOL] Starting scrape for query: URL=${url}, Query=${query.substring(0,50)}...`);

    // 1. Scrape (HTML only needed)
    const scrapeResponse = await app.scrapeUrl(url, { formats: ["html"] });

    // Handle scrape failure or missing HTML
    if (!scrapeResponse.success) {
        const errorMsg = `Failed to scrape webpage. Error: ${scrapeResponse.error || 'Unknown scrape error.'}`;
        logger.error(errorMsg, { action: "URL_SCRAPE_FAILED", url, error: scrapeResponse.error });
        console.error(`[TOOL_ERROR] Scrape Failed (Query): ${url} - ${errorMsg}`);
        throw new Error(errorMsg);
    }
    if (!scrapeResponse.html) {
        const errorMsg = `Scrape successful, but HTML content missing.`;
        logger.error(errorMsg, { action: "URL_SCRAPE_HTML_MISSING", url });
        console.error(`[TOOL_ERROR] Scrape HTML Missing (Query): ${url} - ${errorMsg}`);
        throw new Error(errorMsg);
    }

    // 2. Extract & Clean Content (using Cheerio)
    logger.tool("Extracting main content via Cheerio", { action: "URL_CONTENT_EXTRACTION_START", htmlLength: scrapeResponse.html.length });
    console.log(`[TOOL] Extracting content via Cheerio (Query): URL=${url}, HTML length=${scrapeResponse.html.length}`);
    const $ = cheerio.load(scrapeResponse.html);
    let mainContent = "";
    const selectors = ['article', 'main', '.main', '#main', '.post-content', '#content', '.entry-content', 'body'];
    for (const selector of selectors) {
        const element = $(selector);
        if (element.length > 0) {
            element.find('nav, header, footer, aside, script, style, noscript, iframe, form, button, input, select, textarea, [aria-hidden="true"], .ad, .advertisement, .sidebar, .related-posts, .comments, .share-buttons').remove();
            mainContent = element.text();
            if (mainContent.trim().length > 50) {
                 logger.log(`Extracted content using selector: ${selector}`);
                 break;
            }
        }
    }
    if (!mainContent || mainContent.trim().length <= 50) {
        logger.warn("Could not find specific main content element, falling back to cleaned body.", { url });
        const bodyElement = $('body');
        bodyElement.find('nav, header, footer, aside, script, style, noscript, iframe, form, button, input, select, textarea, [aria-hidden="true"], .ad, .advertisement, .sidebar, .related-posts, .comments, .share-buttons').remove();
        mainContent = bodyElement.text();
    }
    const cleanedContent = mainContent.replace(/\s\s+/g, ' ').replace(/(\r\n|\n|\r){2,}/g, '\n').trim();

    if (cleanedContent.length === 0) {
      logger.warn("Extracted content was empty after cleaning.", { url });
      console.warn(`[TOOL_WARN] Extracted content empty (Query) for ${url}`);
      return "Error: Could not extract meaningful content from the page.";
    }
    logger.tool("Content extracted and cleaned", { action: "URL_CONTENT_EXTRACTION_COMPLETE", contentLength: cleanedContent.length });
    console.log(`[TOOL] Content extracted/cleaned (Query): URL=${url}, Length=${cleanedContent.length}`);

    // 3. Chunk Text
    const chunkSize = 1000;
    const chunkOverlap = 150;
    const textChunks = await TOOLFUNCTION_split_text(cleanedContent, chunkSize, chunkOverlap);
    if (!textChunks || textChunks.length === 0) {
        console.error(`[TOOL_ERROR] Failed to split text into chunks for ${url}`);
        return "Error: Failed to split extracted content into chunks.";
    }
    logger.tool("Text split into chunks", { action: "URL_TEXT_CHUNKED", chunkCount: textChunks.length });
    console.log(`[TOOL] Text split (Query): URL=${url}, Chunks=${textChunks.length}`);

    // 4. Create Langchain Documents
    const documents = textChunks.map((chunk, index) => new LangchainDocument({
        pageContent: chunk.pageContent,
        metadata: {
            url: url,
            chunk: index + 1,
            totalChunks: textChunks.length,
        },
    }));

    // 5. Create In-Memory Vector Store and Add Documents
    logger.tool("Creating in-memory vector store and adding documents", { action: "URL_MEMSTORE_ADD_START", chunkCount: documents.length });
    console.log(`[TOOL] Creating MemoryVectorStore (Query): URL=${url}, Docs=${documents.length}`);
    const vectorStore = await MemoryVectorStore.fromDocuments(documents, embeddings);
    logger.tool("In-memory vector store populated", { action: "URL_MEMSTORE_ADD_COMPLETE" });
    console.log(`[TOOL] MemoryVectorStore populated (Query): URL=${url}`);

    // 6. Search Memory Vector Store
    logger.tool("Searching in-memory vector store", {
        action: "URL_MEMSTORE_SEARCH_START",
        query: query.substring(0, 50) + "...",
        topK: topK
    });
    console.log(`[TOOL] Searching MemoryVectorStore (Query): URL=${url}, Query=${query.substring(0,50)}..., topK=${topK}`);
    const searchResults = await vectorStore.similaritySearchWithScore(query, topK);
    logger.tool("In-memory search complete", { action: "URL_MEMSTORE_SEARCH_COMPLETE", resultsCount: searchResults?.length || 0 });
    console.log(`[TOOL] Search complete (Query): URL=${url}, Results=${searchResults?.length || 0}`);

    // 7. Format Results
    if (!searchResults || searchResults.length === 0) {
      return "No relevant information found on the page for your query.";
    }

    const formattedResults = searchResults
      // Optional: Filter out low-scoring results if needed
      // .filter(([doc, score]) => score > 0.7) // Example threshold
      .map(([doc, score]) => {
          const scoreStr = score ? ` (Score: ${score.toFixed(3)})` : '';
          const chunkNum = doc.metadata?.chunk;
          const totalChunks = doc.metadata?.totalChunks;
          const header = chunkNum && totalChunks ? `[Chunk ${chunkNum}/${totalChunks}${scoreStr}]` : `[Relevant Chunk${scoreStr}]`;
          return `${header}\n${doc.pageContent}`;
      })
      .join("\n\n---\n\n"); // Separator between chunks

    // --- START EDIT: Add Truncation ---
    const MAX_RETURN_LENGTH = 4000; // Adjust this character limit as needed (e.g., ~1000 tokens)

    const finalOutput = formattedResults.length > MAX_RETURN_LENGTH
        ? formattedResults.substring(0, MAX_RETURN_LENGTH) + "\n\n... (results truncated due to length)"
        : formattedResults;

    logger.tool("Formatted and potentially truncated query results prepared for return", {
        action: "URL_QUERY_RESULT_FINALIZED", url: url, query: query.substring(0,50)+"...",
        originalFormattedLength: formattedResults.length, finalReturnedLength: finalOutput.length,
        wasTruncated: formattedResults.length > MAX_RETURN_LENGTH
    });
    console.log(`[TOOL] Returning query results for ${url}: OrigLen=${formattedResults.length}, FinalLen=${finalOutput.length}, Truncated=${formattedResults.length > MAX_RETURN_LENGTH}`);

    return finalOutput; // <-- Return the potentially truncated string
    // --- END EDIT ---

  } catch (error) {
    logger.error("Failed to process webpage for query", {
      action: "URL_SCRAPE_QUERY_ERROR",
      url,
      query,
      error: error instanceof Error ? error.message : String(error),
    });
    console.error(`[TOOL_ERROR] Failed during scrape/query for ${url}: ${error instanceof Error ? error.message : String(error)}`);
    return `Error scraping or querying URL ${url}: ${error instanceof Error ? error.message : String(error)}`;
  }
  // No 'finally' block needed for cleanup as MemoryVectorStore is garbage collected
} 