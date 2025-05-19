import { z } from 'zod';
import { SourceFindingStrategyType } from './types'; // Import the enum

// --- Sub-Schemas for SourceFinderConfig ---

const urlPatternConfigSchema = z.object({
    name: z.string().min(1),
    pattern: z.string().url("Pattern must be a valid URL template (potentially with placeholders like ${var})."),
    mapsToInput: z.string().min(1, "Must specify the tool input parameter name for mapping."),
});

const siteSearchConfigSchema = z.object({
    searchPageUrl: z.string().url().optional(),
    searchInputSelector: z.string().min(1, "Search input selector is required."),
    searchSubmitSelector: z.string().min(1, "Search submit selector is required."),
    resultsContainerSelector: z.string().optional(),
    resultLinkSelector: z.string().min(1, "Result link selector is required."),
    resultTitleSelector: z.string().optional(),
    resultSnippetSelector: z.string().optional(),
});

const sitemapConfigSchema = z.object({
    sitemapUrl: z.string().url().optional(),
}).optional();

const webSearchConfigSchema = z.object({
    searchEngine: z.enum(["perplexity", "googleCustomSearch"]).optional().default("perplexity"),
    maxResultsToConsider: z.number().int().positive().optional().default(5),
}).optional();

const llmNavigationConfigSchema = z.object({
    maxSteps: z.number().int().positive().optional().default(5),
    // modelArgs: modelArgsSchema.optional(), // Add if defining modelArgsSchema elsewhere
}).optional();

export const sourceFinderConfigSchema = z.object({
    enabledStrategies: z.array(z.nativeEnum(SourceFindingStrategyType)).min(1, "At least one source finding strategy must be enabled."),
    urlPatterns: z.array(urlPatternConfigSchema).optional(),
    siteSearch: siteSearchConfigSchema.optional(),
    sitemap: sitemapConfigSchema.optional(),
    webSearch: webSearchConfigSchema.optional(),
    llmNavigation: llmNavigationConfigSchema.optional(),
}).refine(data => {
    if (data.enabledStrategies.includes(SourceFindingStrategyType.CONFIGURED_URL_PATTERNS) && (!data.urlPatterns || data.urlPatterns.length === 0)) return false;
    if (data.enabledStrategies.includes(SourceFindingStrategyType.SITE_SPECIFIC_SEARCH) && !data.siteSearch) return false;
    if (data.enabledStrategies.includes(SourceFindingStrategyType.SEMANTIC_SITEMAP_TRAVERSAL) && !data.sitemap) return false;
    if (data.enabledStrategies.includes(SourceFindingStrategyType.GENERAL_WEB_SEARCH) && !data.webSearch) return false;
    if (data.enabledStrategies.includes(SourceFindingStrategyType.LLM_GUIDED_NAVIGATION) && !data.llmNavigation) return false;
    return true;
}, {
    message: "Enabled source finding strategies must have their corresponding configuration objects present.",
});

export type SourceFinderConfig = z.infer<typeof sourceFinderConfigSchema>; 