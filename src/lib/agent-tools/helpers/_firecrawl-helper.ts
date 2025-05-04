"use server";
import FirecrawlApp, { CrawlScrapeOptions } from '@mendable/firecrawl-js'; // Or use @mendable/firecrawl-node
import { FirecrawlCheckResult } from '../../../app/api/playground/analyze-scraping/_types'; // Import type from local types file
import { logger } from '@/src/lib/logger'; // Import logger

// Firecrawl Helper
export async function executeFirecrawlScrape(
    url: string,
    apiKey: string | undefined,
    options?: CrawlScrapeOptions
): Promise<Omit<FirecrawlCheckResult, 'attempted'>> {
    if (!apiKey) {
        logger.warn("executeFirecrawlScrape called without API key."); // Use logger
        return { success: false, error: "Firecrawl API key not configured on server." };
    }
    if (!url) {
        return { success: false, error: "URL is required for Firecrawl." };
    }

    logger.log(`Attempting Firecrawl scrape for: ${url}`); // Use logger
    const app = new FirecrawlApp({ apiKey });
    const defaultOptions: CrawlScrapeOptions = {
        onlyMainContent: true,
        ...(options ?? {})
    };

    try {
        const scrapeResult = await app.scrapeUrl(url, defaultOptions) as any;

        if (!scrapeResult?.markdown) {
             const errorMessage = scrapeResult?.error || 'Unknown error (markdown content missing)';
             logger.error(`Firecrawl scrape failed for ${url}: ${errorMessage}`); // Use logger
             return { success: false, error: `Firecrawl failed: ${errorMessage}` };
        }

        logger.log(`Firecrawl scrape successful for: ${url}`); // Use logger
        return {
            success: true,
            dataExcerpt: scrapeResult.markdown,
        };

    } catch (error: any) {
        logger.error(`Error during Firecrawl execution for ${url}:`, error); // Use logger
        return { success: false, error: `Firecrawl helper threw error: ${error.message}` };
    }
} 