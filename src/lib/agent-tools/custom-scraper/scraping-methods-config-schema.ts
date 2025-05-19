import { z } from 'zod';
import { ScrapingMethodType } from './types'; // Ensure ScrapingMethodType is defined and exported in types.ts

// Base schema without .optional()
export const firecrawlScraperConfigBaseSchema = z.object({
    mode: z.enum(['scrape', 'crawl']).optional().default('scrape'),
    pageOptions: z.object({ 
        timeout: z.number().int().positive().optional(),
        maxDepth: z.number().int().positive().optional(), 
        maxPages: z.number().int().positive().optional(), 
        includeFileTypes: z.array(z.string()).optional(), 
        excludeFileTypes: z.array(z.string()).optional(), 
        onlyMainContent: z.boolean().optional().default(false), 
        scrollTimeout: z.number().int().positive().optional(), 
    }).passthrough().optional(), 
    extractorOptions: z.object({
        mode: z.enum(['llm-extraction', 'markdown', 'html', 'text']).optional().default('llm-extraction'),
        extractionPrompt: z.string().optional(),
        extractionSchema: z.record(z.unknown()).optional(), 
    }).passthrough().optional(),
    crawlerOptions: z.object({ 
        maxDepth: z.number().int().positive().optional(),
        maxPagesToScrape: z.number().int().positive().optional(),
        includePaths: z.array(z.string()).optional(),
        excludePaths: z.array(z.string()).optional(),
        limit: z.number().int().positive().optional(), 
    }).passthrough().optional(),
});
export const firecrawlScraperConfigSchema = firecrawlScraperConfigBaseSchema.optional();

// Base schema without .optional()
export const visualScraperConfigBaseSchema = z.object({
    baseDataDescription: z.string().min(1,"Base data description is required for visual scraping."),
    waitForRenderMs: z.number().int().positive().optional().default(2000),
    screenshotOptions: z.object({
        fullPage: z.boolean().optional().default(true),
        quality: z.number().int().min(0).max(100).optional().default(80),
        type: z.enum(['png', 'jpeg']).optional().default('jpeg'),
    }).passthrough().optional().default({}),
});
export const visualScraperConfigSchema = visualScraperConfigBaseSchema.optional();

// Base schema without .optional()
export const directHttpFetchConfigBaseSchema = z.object({
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']).optional().default('GET'),
    headers: z.record(z.string()).optional(), 
    body: z.union([z.string(), z.record(z.unknown())]).optional(), 
    responseType: z.enum(['json', 'text', 'arraybuffer', 'blob']).optional().default('text'),
});
export const directHttpFetchConfigSchema = directHttpFetchConfigBaseSchema.optional();


export const scrapingMethodsConfigSchema = z.object({
    preferredMethod: z.nativeEnum(ScrapingMethodType),
    firecrawl: firecrawlScraperConfigSchema, // This remains the .optional() version for the overall config object
    visual: visualScraperConfigSchema,       // This remains the .optional() version
    directHttpFetch: directHttpFetchConfigSchema, // This remains the .optional() version
}).refine(data => {
    if (data.preferredMethod === ScrapingMethodType.FIRECRAWL_REQUEST && !data.firecrawl) return false;
    if (data.preferredMethod === ScrapingMethodType.VISUAL_SCRAPE_EXTRACT && !data.visual) return false;
    if (data.preferredMethod === ScrapingMethodType.DIRECT_HTTP_REQUEST && !data.directHttpFetch) return false;
    return true;
}, {
    message: "The preferred scraping method must have its corresponding configuration object present.",
});

export type ScrapingMethodsConfig = z.infer<typeof scrapingMethodsConfigSchema>;
// Export types for base schemas if they are needed externally, otherwise keep them internal
export type FirecrawlScraperConfig = z.infer<typeof firecrawlScraperConfigSchema>; // This is the optional type
export type VisualScraperConfig = z.infer<typeof visualScraperConfigSchema>;       // This is the optional type
export type DirectHttpFetchConfig = z.infer<typeof directHttpFetchConfigSchema>; // This is the optional type 