import { z } from "zod";
import { ToolRequest, ToolInputParameter, ModelArgs, ModelProviderEnum } from "@/src/lib/types"; // Assuming ToolRequest and others are here

// --- Schemas for Core Data ---

// Reuse existing ToolInputParameter schema if defined elsewhere, or define here
const inputParameterSchema = z.object({
    name: z.string(),
    type: z.enum(["string", "number", "boolean", "array", "object"]),
    description: z.string(),
    required: z.boolean().optional(),
    default: z.any().optional()
});

// Reuse existing ToolRequest schema if defined elsewhere, or define here
export const toolRequestSchema = z.object({
    name: z.string(),
    description: z.string(),
    purpose: z.string().optional(),
    inputs: z.array(inputParameterSchema),
    expectedOutput: z.string(),
    category: z.string().optional(),
    additionalContext: z.string().optional(),
    implementation: z.string().optional(), // May or may not be present
    modificationRequests: z.array(z.string()).optional(),
    examples: z.array(z.object({
        input: z.record(z.any()),
        output: z.any()
    })).optional(),
    // Add examples, etc. if part of your standard ToolRequest
}).passthrough(); // Allow other fields

// --- Schemas for Consultation Process ---

// Represents the result of one round of analysis and verification
const consultationRoundSchema = z.object({
    round: z.number().int().positive(),
    modificationsRequested: z.array(z.string()).describe("User modifications for this round"),
    analysis: z.object({
        recommendedType: z.enum(["api", "function", "undetermined"]), // Added undetermined
        strategyDetails: z.string().describe("Explanation of the strategy (e.g., API endpoint, function logic outline)"),
        warnings: z.array(z.string()).describe("Potential issues or blockers"),
        requiredCredentialName: z.string().optional().describe("Name of the credential needed, if any")
    }).describe("Analysis results from LLM/Perplexity"),
    verification: z.object({
        status: z.enum(["success", "failure", "skipped"]),
        details: z.string().describe("Outcome of the live verification test")
    }).describe("Verification results"),
    timestamp: z.string().datetime(),
});
export type ConsultationRound = z.infer<typeof consultationRoundSchema>;

// Represents the history of the consultation
const consultationHistorySchema = z.array(consultationRoundSchema);
export type ConsultationHistory = z.infer<typeof consultationHistorySchema>;

// --- ModelArgs Schema (copied from generate-tool-definition route for consistency) ---
const providerEnumValues = Object.values(ModelProviderEnum) as [string, ...string[]];
const modelArgsSchema = z.object({
    provider: z.enum(providerEnumValues), // Use the enum values directly
    modelName: z.string(),
    temperature: z.number().optional().default(0.7),
    topP: z.number().optional(),
    maxTokens: z.number().optional(), // Assuming maxTokens maps to maxOutputTokens if needed
}).optional();
// --- End ModelArgs Schema ---

// Schema for the incoming request to the API endpoint
export const consultationRequestSchema = z.object({
    userId: z.string().min(1),
    currentToolRequest: toolRequestSchema,
    consultationHistory: consultationHistorySchema.optional().default([]),
    newStrategyModifications: z.array(z.string()).optional().default([]),
    modelArgs: modelArgsSchema, // **** ADDED: Optional modelArgs ****
});
export type ConsultationRequest = z.infer<typeof consultationRequestSchema>;

// Schema for the response from the API endpoint
export const consultationResponseSchema = z.object({
    latestRound: consultationRoundSchema,
    updatedHistory: consultationHistorySchema,
});
export type ConsultationResponse = z.infer<typeof consultationResponseSchema>;

// Internal types (can be expanded in consultant_logic.ts)
export type AnalysisResult = z.infer<typeof consultationRoundSchema>['analysis'];
export type VerificationResult = z.infer<typeof consultationRoundSchema>['verification'];
