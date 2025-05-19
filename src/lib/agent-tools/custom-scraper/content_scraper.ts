import {
  ScrapingMethodsConfig,
  // FetchedCredentials, // This was incorrect
  FirecrawlScraperConfig,
  VisualScraperConfig,
  ScrapingActionType,
} from './types';
import { AuthContext } from './auth_handler';
import { executeScrapingAction } from './scraper_actions';
import { FetchedCredentials } from './execution_logic'; // Corrected import

export interface ScrapedContentResult {
  content: string | null;
  contentType?: 'text/plain' | 'application/json' | 'text/html' | 'text/markdown';
  error?: string;
}

/**
 * Fetches the initial content from the target URL using the preferred scraping method.
 *
 * @param targetUrl The URL to scrape.
 * @param scrapingMethodsConfig Configuration for the available scraping methods.
 * @param authContext The authentication context (e.g., Puppeteer page, auth headers).
 * @param agentQuery The original agent query, passed to actions if they need it.
 * @param credentials Fetched credentials, passed to actions if they need them.
 * @returns A Promise resolving to the scraped content and its type.
 */
export async function getContent(
  targetUrl: string,
  scrapingMethodsConfig: ScrapingMethodsConfig,
  authContext: AuthContext,
  agentQuery: string, // For actions like Firecrawl LLM mode or Visual Scrape
  credentials: FetchedCredentials,
): Promise<ScrapedContentResult> {
  const { preferredMethod, firecrawl, visual, directHttpFetch } = scrapingMethodsConfig;

  console.log(`[ContentScraper] Getting content for URL: ${targetUrl} using preferred method: ${preferredMethod}`);

  if (authContext.error) {
    return { content: null, error: `Cannot get content due to auth error: ${authContext.error}` };
  }

  try {
    switch (preferredMethod) {
      case 'firecrawl':
        // If Firecrawl is preferred, decide if it's simple content crawl or LLM extraction mode.
        // For initial content fetching, usually it's a crawl. Extraction chain handles further processing.
        // However, if dataExtractionChain is empty and firecrawl config has LLM opts, it might be one-shot.
        // For now, assume simple content fetch if firecrawl object doesn't specify LLM mode explicitly.
        const firecrawlConfig = firecrawl || {} as FirecrawlScraperConfig;
        // If firecrawlConfig.extractorOptions.mode === 'llm-extraction', then use SCRAPE_URL
        // This part of logic might be better if scraper_actions took a more flexible config
        // For now, we default to CRAWL_URL for getting general content.
        // If the config specifically includes extractorOptions, that suggests SCRAPE_URL.
        if (firecrawlConfig.extractorOptions && (firecrawlConfig.extractorOptions as any).mode === 'llm-extraction') {
            console.log('[ContentScraper] Firecrawl preferred with LLM extraction mode.');
            const result = await executeScrapingAction(
                ScrapingActionType.FIRECRAWL_SCRAPE_URL,
                targetUrl,
                firecrawlConfig, // Pass the full firecrawl config
                agentQuery,
                null, // No previous step data for initial content fetch
                credentials
            );
            return { content: result.data, contentType: result.contentType, error: result.error };
        } else {
            console.log('[ContentScraper] Firecrawl preferred, using CRAWL_URL for content.');
            const result = await executeScrapingAction(
                ScrapingActionType.FIRECRAWL_CRAWL_URL,
                targetUrl,
                firecrawlConfig, // Pass the full firecrawl config
                agentQuery,      // agentQuery not strictly used by CRAWL_URL but pass for consistency
                null,
                credentials
            );
            return { content: result.data, contentType: result.contentType, error: result.error };
        }

      case 'visual':
        // Visual scraping usually implies using Puppeteer.
        // The _executeVisualScrape in scraper_actions.ts already handles structured data extraction.
        // This might be a one-shot operation if no further dataExtractionChain is planned.
        console.log('[ContentScraper] Visual scraping preferred.');
        if (!visual) {
            return { content: null, error: "Visual scraping preferred, but no visual config found." };
        }
        // TODO: Pass puppeteerPage from authContext if available and visual scraper needs it.
        // For now, _executeVisualScrape launches its own instance via helpers/_visual-scraping.ts
        const visualResult = await executeScrapingAction(
          ScrapingActionType.VISUAL_SCRAPE_EXTRACT,
          targetUrl,
          visual, // Pass the visual scraping config
          agentQuery,
          null,
          credentials
        );
        return { content: visualResult.data, contentType: visualResult.contentType, error: visualResult.error };

      case 'directHttpFetch':
        console.log('[ContentScraper] Direct HTTP fetch preferred.');
        // Pass authHeaders from authContext if available
        // The directHttpFetch action in scraper_actions.ts should handle merging these.
        const httpConfig = {
            ...(directHttpFetch || {}),
            headers: {
                ...(authContext.authHeaders || {}),
                ...((directHttpFetch as any)?.headers || {}),
            }
        };
        const fetchResult = await executeScrapingAction(
          ScrapingActionType.DIRECT_HTTP_FETCH,
          targetUrl,
          httpConfig,
          agentQuery, // Not typically used by direct fetch but pass for consistency
          null,
          credentials
        );
        return { content: fetchResult.data, contentType: fetchResult.contentType, error: fetchResult.error };

      default:
        console.warn(`[ContentScraper] Unsupported preferred method: ${preferredMethod}`);
        return { content: null, error: `Unsupported preferred scraping method: ${preferredMethod}` };
    }
  } catch (error: any) {
    console.error(`[ContentScraper] Error getting content with method ${preferredMethod}:`, error);
    return { content: null, error: `Failed to get content: ${error.message}` };
  }
} 