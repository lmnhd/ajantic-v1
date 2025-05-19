import { z } from 'zod';
// import { SourceFindingStrategyType } from './types'; // No longer needed here, moved to source-finder-config-schema.ts
import { authConfigSchema } from './auth-config-schema';
import { scrapingMethodsConfigSchema } from './scraping-methods-config-schema';
// import { dataExtractionChainSchema } from './data-extraction-chain-schema';
import { sourceFinderConfigSchema } from './source-finder-config-schema'; // This import is now correct

// --- Sub-Schemas ---

const credentialRequirementSchema = z.object({
    name: z.string().min(1, "Credential name cannot be empty."),
    label: z.string().min(1, "Credential label cannot be empty."),
});

// urlPatternConfigSchema has been moved to source-finder-config-schema.ts
// siteSearchConfigSchema has been moved to source-finder-config-schema.ts
// sitemapConfigSchema has been moved to source-finder-config-schema.ts
// webSearchConfigSchema has been moved to source-finder-config-schema.ts
// llmNavigationConfigSchema has been moved to source-finder-config-schema.ts
// sourceFinderConfigSchema definition has been moved to source-finder-config-schema.ts


const firecrawlScraperConfigSchema = z.object({
    onlyMainContent: z.boolean().optional(),
    includeRawHtml: z.boolean().optional(),
    // Passthrough for flexibility, maybe refine later if specific options are critical
}).passthrough().optional();

const visualScraperConfigSchema = z.object({
    baseDataDescription: z.string().optional(),
    waitForRenderMs: z.number().int().positive().optional(),
    screenshotOptions: z.object({ // Make optional sub-fields optional too
        fullPage: z.boolean().optional(),
        quality: z.number().int().min(0).max(100).optional(),
        type: z.enum(['png', 'jpeg']).optional(),
    }).passthrough().optional(),
    // modelArgs: modelArgsSchema.optional(),
}).optional();

// const scrapingMethodsConfigSchema = z.object({ ... }); // This is imported


// --- Main Schema ---

export const scrapingToolImplementationConfigSchema = z.object({
	baseDomain: z.string().url('Base domain must be a valid URL.'),
	startUrl: z.string().url('Start URL must be a valid URL.'),
	// TODO: Re-evaluate if this is truly optional or if we should have a default.
	defaultExecutionPath: z.string().optional(),
	sourceFinderConfig: sourceFinderConfigSchema, // Now correctly uses the imported schema
	authConfig: authConfigSchema.optional(),
	scrapingMethodsConfig: scrapingMethodsConfigSchema,
	// dataExtractionChain: dataExtractionChainSchema.optional(),
	// TODO: Consider adding a field for "example usage" or "common parameters"
});

// Export the main schema type for potential use elsewhere
export type ScrapingToolImplementationConfig = z.infer<typeof scrapingToolImplementationConfigSchema>;
