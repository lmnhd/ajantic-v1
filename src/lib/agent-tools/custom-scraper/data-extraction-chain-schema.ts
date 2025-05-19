import { z } from 'zod';
import { ScrapingActionType } from './types'; // Ensure ScrapingActionType is defined and exported in types.ts
// Import the BASE (non-optional) versions for use with .pick()
import { 
    firecrawlScraperConfigBaseSchema, 
    visualScraperConfigBaseSchema, 
    directHttpFetchConfigBaseSchema 
} from './scraping-methods-config-schema';

// Schema for the 'config' field within a DataExtractionChainStep,
// which can vary depending on the actionType.
const scrapingActionConfigSchema = z.union([
    // Use the base schema for .pick() and then make the result .optional()
    firecrawlScraperConfigBaseSchema.pick({ extractorOptions: true, pageOptions: true, mode: true }).optional(), 
    visualScraperConfigBaseSchema.optional(), 
    directHttpFetchConfigBaseSchema.optional(), 
    z.object({ // For LLM_EXTRACT_FROM_DATA
        extractionPrompt: z.string().min(1),
        extractionSchema: z.record(z.unknown()).optional(), 
        // modelArgs if needed
    }).optional(),
    z.record(z.unknown()).optional(), // Fallback for other or future action types with generic config
]);


export const dataExtractionChainStepSchema = z.object({
    actionType: z.nativeEnum(ScrapingActionType),
    description: z.string().optional(),
    // `config`'s specific shape might depend on `actionType`.
    // For simplicity in the main schema, we use a broader type here,
    // but runtime validation might need to be more specific if actionType implies a certain config structure.
    config: scrapingActionConfigSchema.optional(),
    inputSource: z.string().optional().describe("Variable name for the data from the previous step (e.g., 'step1_output', 'page_content'). If empty, uses output of immediately preceding step or initial agent query for first step."),
    outputVariable: z.string().optional().describe("Variable name to store the output of this step. If empty, output might be implicitly passed or named by default."),
});

export const dataExtractionChainSchema = z.array(dataExtractionChainStepSchema).optional().default([]);

export type DataExtractionChainStep = z.infer<typeof dataExtractionChainStepSchema>;
export type DataExtractionChain = z.infer<typeof dataExtractionChainSchema>; 