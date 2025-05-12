import { z } from "zod";
import { ToolRequest as ImportedToolRequest, ModelProviderEnum } from "@/src/lib/types"; // Assuming ToolRequest and ModelProviderEnum are well-defined here

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

// Changed from type alias to enum for z.nativeEnum compatibility
export enum RecommendedImplementationType {
    FUNCTION = "function",
    API = "api",
    UNKNOWN = "unknown",
    ERROR = "error"
}

export enum ResearchDepth {
    BASIC = "BASIC",
    DETAILED = "DETAILED"
}

export interface PreliminaryResearchIdentifiers {
    name: string;
    description: string;
    serviceName: string;
    targetUrl: string;
}

export interface AnalysisResult {
    consultationId?: string;
    recommendedType: RecommendedImplementationType;
    confidence?: "high" | "medium" | "low";
    strategyTitle?: string;
    strategyDetails: string;
    potentialIssues?: string[];
    exampleUsage?: string;
    requiredCredentialName?: string | null | undefined;
    warnings?: string[]; // Can be same as potentialIssues or separate
    extractedApiEndpoint?: string;
    preliminaryFindings?: string;
    preliminaryResearchFor?: PreliminaryResearchIdentifiers;
}

export interface VerificationResult {
    status: 'success' | 'failure' | 'skipped';
    details: string;
    verifiedAt?: string; // ISO string
}

export interface ConsultationRound {
    round: number;
    modificationsRequested: string[];
    analysis: AnalysisResult;
    verification?: VerificationResult | null;
    timestamp: string; // Typically ISO string
}

export type ConsultationHistory = ConsultationRound[];

export interface ConsultationRequestContext {
    currentToolRequest: ToolRequest;
    researchDepth?: ResearchDepth;
    userContext?: string;
    previousAnalysis?: ConsultationRound | null | undefined;
}

export interface UserFeedback {
    isHelpful: boolean;
    suggestedCorrection?: string;
    rating?: number; // e.g., 1-5
}

export interface StrategyAnalysis {
    id: string;
    consultationId: string;
    timestamp: Date;
    request: ConsultationRequestContext;
    analysis: AnalysisResult;
    verification?: VerificationResult | null;
    feedback?: UserFeedback | null;
    status: "pending" | "completed" | "failed";
    error?: string;
    version: string;
}

// --- Zod Schemas continued (for API validation, complementing manual types) ---

// Zod schema for AnalysisResult - useful for validating parts of the LLM output if generateObject uses it.
// It might be less comprehensive than the manual AnalysisResult interface.
const analysisResultZodSchema = z.object({
    recommendedType: z.nativeEnum(RecommendedImplementationType), // Now correctly uses the enum
    strategyDetails: z.string(),
    warnings: z.array(z.string()).optional(),
    requiredCredentialName: z.string().optional().nullable(),
    // Other fields like confidence, strategyTitle might be added by LLM_generateStrategySuggestion
    // and not strictly part of the generateObject schema.
});

const verificationResultZodSchema = z.object({
    status: z.enum(["success", "failure", "skipped"]), // Corrected quotes
    details: z.string()
});

const consultationRoundZodSchema = z.object({
    round: z.number().int().positive(),
    modificationsRequested: z.array(z.string()),
    analysis: analysisResultZodSchema, // Use the Zod version for analysis here
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
            extractedApiEndpoint: undefined,
            preliminaryFindings: undefined,
            preliminaryResearchFor: undefined,
            requiredCredentialName: undefined,
            exampleUsage: undefined,
        },
        verification: null,
        feedback: null,
        status: 'pending',
        version: '1.2.1', // Incremented version
    };
}

// Note: ModelProviderEnum should be correctly defined in or imported into @/src/lib/types
// If ToolRequest from @/src/lib/types is just an interface, toolRequestZodSchema here can serve as its validator.