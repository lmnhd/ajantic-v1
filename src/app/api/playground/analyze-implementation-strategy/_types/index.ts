import { z } from "zod";
import { ToolRequest as ImportedToolRequest, ModelProviderEnum, ModelArgs } from "@/src/lib/types"; // Assuming ToolRequest and ModelProviderEnum are well-defined here

// --- Zod Schemas (Primarily for API runtime validation) ---

// Re-exporting ToolRequest if it's only from lib/types and not modified here
export type ToolRequest = ImportedToolRequest;

const inputParameterSchema = z.object({
    name: z.string(),
    type: z.enum(["string", "number", "boolean", "array", "object"]),
    description: z.string(),
    required: z.boolean().optional(),
    default: z.any().optional()
});

// Zod schema for ToolRequest - can be used for validating currentToolRequest
export const toolRequestZodSchema = z.object({
    name: z.string(),
    description: z.string(),
    purpose: z.string().optional(),
    inputs: z.array(inputParameterSchema),
    expectedOutput: z.string(),
    category: z.string().optional(),
    additionalContext: z.string().optional(),
    implementation: z.string().optional(),
    modificationRequests: z.array(z.string()).optional(),
    examples: z.array(z.object({
        input: z.record(z.any()),
        output: z.any()
    })).optional(),
}).passthrough();

const preliminaryResearchIdentifiersZodSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  serviceName: z.string().optional(),
  targetUrl: z.string().optional(),
});

// --- Authoritative Manual Interface Definitions ---

// Define the Zod schema for the AnalysisResult (used within StrategyAnalysis)
// Ensure this is exported if needed elsewhere
export const analysisResultSchemaInternal = z.object({
    consultationId: z.string().describe("Unique ID for this specific consultation round analysis."),
    recommendedType: z.enum(["api", "function", "scraping", "unknown", "error"]).describe("Recommended implementation type ('api', 'function', 'scraping', 'unknown', or 'error')."),
    confidence: z.enum(["high", "medium", "low"]).optional().describe("Confidence level in the recommendation."),
    strategyTitle: z.string().optional().describe("A concise title for the suggested strategy."),
    strategyDetails: z.string().describe("Detailed explanation of the recommended strategy. If 'api', include endpoint. If 'function', outline logic. If 'scraping', detail method (firecrawl, visual) and target."),
    potentialIssues: z.array(z.string()).optional().describe("List of potential issues or challenges with the strategy."),
    exampleUsage: z.string().optional().describe("A brief example of how the tool might be used."),
    requiredCredentialName: z.string().optional().nullable().describe("Credential name if API needs auth (e.g., 'SERVICE_API_KEY'). Use null or omit if none needed."),
    warnings: z.array(z.string()).optional().describe("List potential issues, blockers, or reasons why other types were ruled out."),
    // New scraping-specific hints
    suggestedBaseDomain: z.string().optional().describe("If scraping recommended, the likely base domain."),
    scrapingMethodHint: z.enum(["firecrawl", "visual", "directHttpFetch"]).optional().describe("Suggested raw scraping method."),
    authRequiresPuppeteer: z.boolean().optional().describe("If scraping requires login, does it likely need Puppeteer for form interaction?"),
    exampleTargetPageUrl: z.string().url().optional().describe("If scraping, an example URL (e.g., from a logged-in session) where target data is found. This helps immensely in config generation."),
    // Fields related to research context
    preliminaryFindings: z.string().optional().describe("Summary of preliminary research conducted."),
    preliminaryResearchFor: z.object({
        name: z.string().optional(),
        description: z.string().optional(),
        serviceName: z.string().optional(),
        targetUrl: z.string().optional(),
    }).optional().describe("The key identifiers of the tool request for which the preliminary research was performed."),
    extractedApiEndpoint: z.string().optional().describe("Specifically extracted API endpoint URL from detailed research, if any."),
});

// Re-define RecommendedImplementationType to include scraping
export enum RecommendedImplementationType {
    API = 'api',
    FUNCTION = 'function',
    SCRAPING = 'scraping', // Added scraping
    UNKNOWN = 'unknown',
    ERROR = 'error',
}

export enum ResearchDepth {
    BASIC = 'basic',
    DETAILED = 'detailed',
}

export interface PreliminaryResearchIdentifiers {
    name?: string;
    description?: string;
    serviceName?: string;
    targetUrl?: string;
}

// Update AnalysisResult to align with the zod schema definition above
export type AnalysisResult = z.infer<typeof analysisResultSchemaInternal>;

export interface VerificationResult {
    status: 'success' | 'failure' | 'skipped';
    details: string;

}

export interface ConsultationRound {
    round: number;
    modificationsRequested: string[];
    analysis: AnalysisResult; // Uses the updated AnalysisResult type
    verification?: VerificationResult | null; // Make verification optional and nullable
    timestamp: string; // ISO 8601 format
}

export type ConsultationHistory = ConsultationRound[];

export interface ConsultationRequestContext {
    userId?: string; // Optional, depending on if user context is needed during consultation
    existingToolRef?: string; // Optional, if refining an existing tool
    modelArgs?: ModelArgs; // Allow overriding model selection
    currentToolRequest: ToolRequest;
}

export interface UserFeedback {
    isHelpful: boolean;
    suggestedCorrection?: string;
    rating?: number; // e.g., 1-5
}

export interface StrategyAnalysis {
    id: string;
    consultationId?: string; // ID linking rounds within this analysis
    timestamp: Date;
    request: {
        currentToolRequest: ToolRequest;
        researchDepth?: ResearchDepth;
        userContext?: string;
        previousAnalysis?: ConsultationRound; // Reference to the last round if iterative
    };
    analysis: AnalysisResult; // The core recommendation and details
    verification?: VerificationResult; // Result of any live checks performed
    feedback?: { // Optional feedback structure
        rating?: number; // e.g., 1-5
        comment?: string;
        accepted?: boolean; // Did the user accept this strategy?
    };
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    error?: string; // Error message if status is 'failed'
    version: string; // Version of the consultant logic used
    recommendedType: "api" | "function" | "scraping" | "unknown" | "error";
    strategyDetails: string;
}

// --- Zod Schemas continued (for API validation, complementing manual types) ---

const verificationResultZodSchema = z.object({
    status: z.enum(["success", "failure", "skipped"]), // Corrected quotes
    details: z.string()
});

const consultationRoundZodSchema = z.object({
    round: z.number().int().positive(),
    modificationsRequested: z.array(z.string()),
    analysis: analysisResultSchemaInternal, // Use the Zod version for analysis here
    verification: verificationResultZodSchema.optional().nullable(),
    timestamp: z.string().datetime(),
});

const consultationHistoryZodSchema = z.array(consultationRoundZodSchema);

const providerEnumValues = Object.values(ModelProviderEnum) as [string, ...string[]];
const modelArgsZodSchema = z.object({
    provider: z.enum(providerEnumValues),
    modelName: z.string(),
    temperature: z.number().optional().default(0.7),
    topP: z.number().optional(),
    maxTokens: z.number().optional(),
}).optional();

// Schema for the incoming request to the API endpoint (renamed to avoid TS name clash)
export const apiConsultationRequestZodSchema = z.object({
    userId: z.string().min(1),
    currentToolRequest: toolRequestZodSchema, // Use Zod schema for request part
    consultationHistory: consultationHistoryZodSchema.optional().default([]),
    newStrategyModifications: z.array(z.string()).optional().default([]),
    modelArgs: modelArgsZodSchema.optional(), // Made optional for clarity
    researchDepth: z.nativeEnum(ResearchDepth).optional(),
});
export type ApiConsultationRequest = z.infer<typeof apiConsultationRequestZodSchema>;

// Schema for the response from the API endpoint (renamed to avoid TS name clash)
export const apiConsultationResponseZodSchema = z.object({
    latestRound: consultationRoundZodSchema,
    updatedHistory: consultationHistoryZodSchema,
    strategyAnalysis: z.custom<StrategyAnalysis>() // For the full object, often easier to use custom or any
});
export type ApiConsultationResponse = z.infer<typeof apiConsultationResponseZodSchema>;


// Helper function
export function createEmptyStrategyAnalysis(requestContext: ConsultationRequestContext, consultationIdInput?: string): StrategyAnalysis {
    const now = new Date();
    const currentConsultationId = consultationIdInput || `default-consult-${now.getTime()}`;
    return {
        id: `analysis-${now.getTime()}-${Math.random().toString(36).substring(2, 9)}`,
        consultationId: currentConsultationId,
        timestamp: now,
        request: requestContext,
        analysis: {
            consultationId: currentConsultationId,
            recommendedType: RecommendedImplementationType.UNKNOWN,
            strategyDetails: 'Analysis not yet performed.',
            warnings: [],
            potentialIssues: [],
            confidence: 'low',
            strategyTitle: 'Initial Analysis',
            suggestedBaseDomain: undefined,
            scrapingMethodHint: undefined,
            authRequiresPuppeteer: undefined,
            exampleTargetPageUrl: undefined,
            extractedApiEndpoint: undefined,
            preliminaryFindings: undefined,
            preliminaryResearchFor: undefined,
            requiredCredentialName: undefined,
            exampleUsage: undefined,
        },
        recommendedType: RecommendedImplementationType.UNKNOWN,
        strategyDetails: 'Analysis not yet performed.',
        verification: undefined,
        feedback: undefined,
        status: 'pending',
        version: '1.2.1', // Incremented version
    };
}

// Note: ModelProviderEnum should be correctly defined in or imported into @/src/lib/types
// If ToolRequest from @/src/lib/types is just an interface, toolRequestZodSchema here can serve as its validator.