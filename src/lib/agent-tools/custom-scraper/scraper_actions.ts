import {
  ScrapingActionType,
  FirecrawlScraperConfig,
  FirecrawlCrawlerConfig,
  DirectHttpFetchConfig,
  LlmExtractFromDataConfig,
  VisualScraperConfig,
  // We'll need to import specific config types for each action later from ./types
  // e.g., VisualScraperConfig, etc.
} from './types';

// We will instantiate FirecrawlApp directly
import FirecrawlApp from '@mendable/firecrawl-js';

// Use the consistent type for fetched credentials
type FetchedCredentials = Record<string, string | null>;

// Placeholder for LanguageModel if needed by LLM actions
// type LanguageModel = any;

interface ScrapingActionResult {
  data: string | null; // The primary data extracted by this action
  error?: string;
  contentType?: 'text/plain' | 'application/json' | 'text/html' | 'text/markdown'; // Optional: to guide next steps
  // Potentially add other metadata
}

/**
 * Executes a single scraping action based on the provided type and configuration.
 */
export async function executeScrapingAction(
  actionType: ScrapingActionType,
  targetUrl: string,
  actionConfig: any, // Will be cast to specific config types
  agentQuery: string,
  previousStepData?: string | null,
  credentials?: FetchedCredentials | null,
  // languageModel?: LanguageModel, // Pass if needed for LLM actions
): Promise<ScrapingActionResult> {
  console.log(`[ScraperAction] Executing action: ${actionType} on URL: ${targetUrl}`);

  // Default Firecrawl API key retrieval from environment.
  // Specific actions can override this if credentials provide a different key.
  const defaultFirecrawlApiKey = process.env.FIRECRAWL_API_KEY;
  // Allow API key to be provided via credentials (e.g., if a user has their own Firecrawl key)
  const firecrawlApiKey = credentials?.['FIRECRAWL_API_KEY'] || defaultFirecrawlApiKey;


  if ((actionType === ScrapingActionType.FIRECRAWL_CRAWL_URL || actionType === ScrapingActionType.FIRECRAWL_SCRAPE_URL) && !firecrawlApiKey) {
    const errorMsg = "Firecrawl API key not available (checked environment and credentials).";
    console.error(`[ScraperAction] ${errorMsg}`);
    return { data: null, error: errorMsg };
  }

  try {
    switch (actionType) {
      case ScrapingActionType.FIRECRAWL_CRAWL_URL:
        return await _executeFirecrawlCrawlUrl(
          targetUrl,
          actionConfig as FirecrawlCrawlerConfig, // Config for getting raw/markdown content
          firecrawlApiKey! // Known to be non-null due to check above
        );

      case ScrapingActionType.FIRECRAWL_SCRAPE_URL:
        // This uses Firecrawl's LLM extraction mode
        return await _executeFirecrawlLlmScrape(
          targetUrl,
          actionConfig as FirecrawlScraperConfig, // Config for LLM-based extraction
          agentQuery,
          firecrawlApiKey! // Known to be non-null due to check above
        );

      case ScrapingActionType.VISUAL_SCRAPE_EXTRACT:
        return await _executeVisualScrape(
          targetUrl,
          actionConfig as VisualScraperConfig,
          agentQuery,
          credentials
        );

      case ScrapingActionType.DIRECT_HTTP_FETCH:
        return await _executeDirectHttpFetch(
          targetUrl, // Note: targetUrl might not always be relevant if previousStepData is the primary input
          actionConfig as DirectHttpFetchConfig,
          credentials
        );

      case ScrapingActionType.LLM_EXTRACT_FROM_DATA:
        return await _executeLlmExtraction(
          previousStepData ?? null, // Pass undefined as null
          actionConfig as LlmExtractFromDataConfig,
          agentQuery,
          // languageModel, // Pass the actual LLM client here when available
          credentials
        );

      default:
        console.warn(`[ScraperAction] Unknown or unsupported action type: ${actionType}`);
        return { data: null, error: `Unknown action type: ${actionType}` };
    }
  } catch (error: any) {
    console.error(`[ScraperAction] Error executing action ${actionType}:`, error);
    return { data: null, error: `Failed to execute action ${actionType}: ${error.message}` };
  }
}

// --- Helper Functions for each action ---

async function _executeFirecrawlCrawlUrl(
  targetUrl: string,
  config: FirecrawlCrawlerConfig,
  apiKey: string,
): Promise<ScrapingActionResult> {
  if (!targetUrl) {
    return { data: null, error: "URL is required for Firecrawl crawl." };
  }
  const app = new FirecrawlApp({ apiKey });
  try {
    console.log(`[ScraperAction][FirecrawlCrawl] Calling Firecrawl crawl on ${targetUrl} with config:`, JSON.stringify(config));

    const params = {
        pageOptions: {
            onlyMainContent: config.pageOptions?.onlyMainContent ?? true,
            includeRawHtml: config.pageOptions?.includeRawHtml ?? false,
        },
        // No extractorOptions for this action type
    };

    console.log(`[ScraperAction][FirecrawlCrawl] Using scrapeUrl for content fetch on ${targetUrl}`);
    // Corrected: Pass params directly, which include pageOptions
    const scrapeResult = await app.scrapeUrl(targetUrl, params as any); 

    // Type assertion for data access, assuming Firecrawl types are set up
    const resultData = (scrapeResult as any)?.data;

    if (!scrapeResult || (scrapeResult as any).success === false || !resultData) {
        const errorMsg = (scrapeResult as any).error || (resultData as any)?.error || 'Firecrawl crawl (content fetch) did not return expected data object.';
        console.error('[ScraperAction][FirecrawlCrawl] Error:', errorMsg, scrapeResult);
        return { data: null, error: errorMsg };
    }
    
    let contentType: ScrapingActionResult['contentType'] = 'text/plain';
    let content = '';

    if (config.pageOptions?.includeRawHtml && resultData.html) {
        content = resultData.html;
        contentType = 'text/html';
    } else if (resultData.markdown) { 
        content = resultData.markdown;
        contentType = 'text/markdown';
    } else if (resultData.content) { 
         content = resultData.content;
    } else {
        return {data: null, error: "Firecrawl returned no HTML, Markdown, or content."}
    }
    console.log(`[ScraperAction][FirecrawlCrawl] Successfully fetched content. Type: ${contentType}`);
    return { data: content, contentType };

  } catch (error: any) {
    console.error('[ScraperAction][FirecrawlCrawl] Error:', error);
    return { data: null, error: `Firecrawl crawl failed: ${error.message}` };
  }
}


async function _executeFirecrawlLlmScrape(
  targetUrl: string,
  config: FirecrawlScraperConfig, // This config is for LLM extraction mode
  agentQuery: string,
  apiKey: string,
  // credentials?: FetchedCredentials | null // Credentials not directly used here, apiKey is main
): Promise<ScrapingActionResult> {
  if (!targetUrl) {
    return { data: null, error: "URL is required for Firecrawl scrape." };
  }

  const app = new FirecrawlApp({ apiKey });
  
  const params: any = { // Type according to Firecrawl's ScrapeOptions/PageScrapeOptions
      pageOptions: { 
        onlyMainContent: config.pageOptions?.onlyMainContent ?? true, 
        includeRawHtml: config.pageOptions?.includeRawHtml ?? false, // Usually false for LLM extraction
        // Adjust other pageOptions as needed from FirecrawlScraperConfig
      },
      extractorOptions: { 
          mode: 'llm-extraction',
          extractionPrompt: config.extractorOptions?.extractionPrompt || // Prefer prompt from config
                            `Based on the content of the page, extract the specific information requested by the query: "${agentQuery}". Structure the output as a JSON object. If multiple distinct items match the query, return them in a JSON array. If no relevant information is found, return an empty JSON object or an appropriate message stating so.`,
          extractionSchema: config.extractorOptions?.extractionSchema, // Pass schema if defined in config
      },
      // Other options like timeout from config.scraperOptions if applicable
      // scraperOptions: config.scraperOptions 
  };
  
  try {
    console.log(`[ScraperAction][FirecrawlLlmScrape] Calling Firecrawl scrape (LLM mode) on ${targetUrl} with params:`, JSON.stringify(params)); 
    const scrapeResult = await app.scrapeUrl(targetUrl, params as any);

    // Type assertion for data access
    const resultData = (scrapeResult as any)?.data;

    if (!scrapeResult || (scrapeResult as any).success === false || !resultData || typeof resultData !== 'object') { 
       console.error('[ScraperAction][FirecrawlLlmScrape] Failed to get LLM extraction data object.', scrapeResult);
       const errorMsg = (scrapeResult as any).error || (resultData as any)?.error || 'Firecrawl scrape (LLM mode) did not return expected data object.';
       return { data: null, error: errorMsg, contentType: 'application/json' }; 
    }

    const extractedData = resultData.llm_extraction || resultData.json;

    if (extractedData === undefined || extractedData === null) {
        console.error('[ScraperAction][FirecrawlLlmScrape] LLM extracted data is missing in the response (checked llm_extraction and json fields).', resultData);
        return { data: null, error: 'LLM extracted data field (llm_extraction or json) not found in Firecrawl response.', contentType: 'application/json'};
    }

    const extractedDataString = typeof extractedData === 'string' ? extractedData : JSON.stringify(extractedData, null, 2);
    console.log(`[ScraperAction][FirecrawlLlmScrape] Successfully extracted data.`);
    return { data: extractedDataString, contentType: 'application/json' };

  } catch (error: any) {
    console.error('[ScraperAction][FirecrawlLlmScrape] Error:', error);
    return { data: null, error: `Firecrawl scrape (LLM mode) failed: ${error.message}`, contentType: 'application/json' };
  }
}

async function _executeDirectHttpFetch(
  targetUrl: string,
  config: DirectHttpFetchConfig,
  credentials?: FetchedCredentials | null
): Promise<ScrapingActionResult> {
  const method = config.method || 'GET';
  const headers = { ...config.headers }; // Start with config headers
  const body = config.body;
  const responseType = config.responseType || 'text';

  console.log(`[ScraperAction][DirectHttpFetch] Fetching URL: ${targetUrl} with method: ${method}`);

  // Example: Injecting an API key from credentials if specified in headers by a placeholder
  // This is a simple example; more robust credential injection might be needed.
  for (const key in headers) {
    if (headers[key].startsWith('CREDENTIAL:')) {
      const credName = headers[key].substring('CREDENTIAL:'.length);
      if (credentials && credentials[credName]) {
        headers[key] = credentials[credName]!;
        console.log(`[ScraperAction][DirectHttpFetch] Injected credential "${credName}" into header "${key}".`);
      } else {
        console.warn(`[ScraperAction][DirectHttpFetch] Credential placeholder "${credName}" in header "${key}" but credential not found.`);
        // Decide: remove header or leave as is? For now, leave (might be optional)
      }
    }
  }

  try {
    const response = await fetch(targetUrl, {
      method: method,
      headers: headers,
      body: method === 'POST' ? body : undefined, // Simplified condition
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ScraperAction][DirectHttpFetch] HTTP error ${response.status}: ${errorText}`);
      return { data: null, error: `HTTP error ${response.status}: ${response.statusText}. Details: ${errorText}` };
    }

    let responseData: string;
    let contentType: ScrapingActionResult['contentType'] = 'text/plain';

    if (responseType === 'json') {
      const json = await response.json();
      responseData = JSON.stringify(json, null, 2);
      contentType = 'application/json';
    } else {
      responseData = await response.text();
      // Try to guess content type from headers if plain text
      const httpContentType = response.headers.get('content-type');
      if (httpContentType?.includes('application/json')) contentType = 'application/json';
      else if (httpContentType?.includes('text/html')) contentType = 'text/html';
      else if (httpContentType?.includes('text/markdown')) contentType = 'text/markdown';
      // else keep as text/plain
    }

    console.log(`[ScraperAction][DirectHttpFetch] Successfully fetched data. Content-Type: ${contentType}`);
    return { data: responseData, contentType };

  } catch (error: any) {
    console.error('[ScraperAction][DirectHttpFetch] Error:', error);
    return { data: null, error: `Direct HTTP fetch failed: ${error.message}` };
  }
}

async function _executeLlmExtraction(
  previousData: string | null,
  config: LlmExtractFromDataConfig,
  agentQuery: string,
  // languageModel: LanguageModel, // This would be your LLM client instance
  credentials?: FetchedCredentials | null
): Promise<ScrapingActionResult> {
  if (!previousData) {
    return { data: null, error: "No previous data provided for LLM extraction." };
  }

  const prompt = config.extractionPrompt || 
                 `Given the following data, extract the information relevant to the query: "${agentQuery}". Structure the output as a JSON object. If multiple distinct items match the query, return them in a JSON array. If no relevant information is found, return an empty JSON object or an appropriate message.`;

  console.log(`[ScraperAction][LlmExtract] Using prompt: "${prompt.substring(0, 100)}..." on data of length ${previousData.length}`);

  // --- Placeholder for actual LLM call ---
  // Example conceptual call:
  // try {
  //   const llmResponse = await languageModel.generate({
  //     prompt: `${prompt}\n\nData:\n${previousData}`,
  //     // You might pass config.outputSchema here if the LLM supports structured output guidance
  //     // maxTokens, temperature, etc. could come from config.modelArgs
  //   });
  //   const extractedJsonString = llmResponse.text; // or however your LLM client returns it
  //   console.log("[ScraperAction][LlmExtract] LLM extraction successful.");
  //   return { data: extractedJsonString, contentType: 'application/json' };
  // } catch (error: any) {
  //   console.error("[ScraperAction][LlmExtract] LLM call failed:", error);
  //   return { data: null, error: `LLM extraction failed: ${error.message}` };
  // }
  // --- End Placeholder ---

  // For now, returning a mock success since no LLM client is integrated here
  console.warn("[ScraperAction][LlmExtract] LLM client not integrated. This is a placeholder implementation.");
  // Simulate extracting the first 500 chars as JSON for testing purposes
  const mockExtractedData = {
    query: agentQuery,
    promptUsed: prompt,
    extractedContentSample: previousData.substring(0, 500),
    message: "This is mock data. LLM extraction needs to be fully implemented."
  };
  return { 
    data: JSON.stringify(mockExtractedData, null, 2), 
    contentType: 'application/json', 
    error: "LLM client not integrated; this is mock data." 
  };
}

// Import the existing helper
import { executeVisualScrape as helperExecuteVisualScrape } from '../helpers/_visual-scraping';

async function _executeVisualScrape(
  targetUrl: string,
  config: VisualScraperConfig,
  agentQuery: string, // agentQuery might be used if baseDataDescription is missing
  credentials?: FetchedCredentials | null
): Promise<ScrapingActionResult> {
  const dataDescription = config.baseDataDescription || agentQuery;
  console.log(`[ScraperAction][VisualScrape] Executing visual scrape for URL: ${targetUrl} with data description: "${dataDescription}"`);

  try {
    const structuredData = await helperExecuteVisualScrape({
      url: targetUrl,
      dataDescription: dataDescription,
    });

    if (structuredData) {
      console.log("[ScraperAction][VisualScrape] Visual scraping successful.");
      return { data: JSON.stringify(structuredData, null, 2), contentType: 'application/json' };
    } else {
      console.warn("[ScraperAction][VisualScrape] Visual scraping returned no data or failed.");
      return { data: null, error: "Visual scraping helper returned no data or failed." };
    }
  } catch (error: any) {
    console.error("[ScraperAction][VisualScrape] Error during visual scrape execution:", error);
    return { data: null, error: `Visual scraping failed: ${error.message}` };
  }
}
