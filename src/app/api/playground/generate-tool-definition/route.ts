import { NextResponse, NextRequest } from 'next/server';
import { logger } from '@/src/lib/logger';
import { CORE_generateCustomToolDefinition } from '@/src/lib/agent-tools/auto-gen-tool/auto-gen-tool_core';
import { ToolRequest } from '@/src/lib/types'; // Assuming ToolRequest is defined here
import { z } from 'zod';
import { ModelProviderEnum, ModelArgs } from "@/src/lib/types"; // Import ModelArgs related types
import { RecommendedImplementationType, PreliminaryResearchIdentifiers as PreliminaryResearchIdentifiersInterface, AnalysisResult, analysisResultSchemaInternal as strategyAnalysisZodSchema } from '@/src/app/api/playground/analyze-implementation-strategy/_types';

// --- Add Helper --- 
function mapStringToProviderEnum(providerString: string): ModelProviderEnum | undefined {
    const upperCaseProvider = providerString?.toUpperCase();
    const enumKey = Object.keys(ModelProviderEnum).find(key => ModelProviderEnum[key as keyof typeof ModelProviderEnum] === upperCaseProvider);
    return enumKey ? ModelProviderEnum[enumKey as keyof typeof ModelProviderEnum] : undefined;
}
// --- End Helper ---

// --- Get Enum Values as Uppercase Strings ---
const providerEnumValues = Object.values(ModelProviderEnum) as [string, ...string[]]; // Cast needed for z.enum

// --- Modify ModelArgs Schema ---
const modelArgsSchema = z.object({
    provider: z.enum(providerEnumValues),
    modelName: z.string(),
    temperature: z.number().optional().default(0.7),
    topP: z.number().optional(),
    maxTokens: z.number().optional(),
}).optional();
// --- End ModelArgs Schema Modification ---

// --- Schemas for Accepted Strategy (aligning with AnalysisResult from _types) ---
const preliminaryResearchIdentifiersSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  serviceName: z.string().optional(),
  targetUrl: z.string().optional(),
});

// This schema should now align with the AnalysisResult interface from _types/index.ts
const analysisResultAlignedSchema = z.object({
    consultationId: z.string().optional(),
    recommendedType: z.nativeEnum(RecommendedImplementationType), // Use the enum
    confidence: z.enum(["high", "medium", "low"]).optional(),
    strategyTitle: z.string().optional(),
    strategyDetails: z.string(),
    potentialIssues: z.array(z.string()).optional(),
    exampleUsage: z.string().optional(),
    requiredCredentialName: z.string().optional().nullable(),
    warnings: z.array(z.string()).optional(),
    extractedApiEndpoint: z.string().optional(),
    preliminaryFindings: z.string().optional(),
    preliminaryResearchFor: preliminaryResearchIdentifiersSchema.optional(), // This was already here
});
// --- End Schemas for Accepted Strategy ---

// Define a schema for the expected request body, matching ToolRequest structure
const toolRequestSchema = z.object({
    userId: z.string().optional(), // **** ADDED: Accept optional userId sent by frontend ****
    name: z.string().min(1, "Tool name is required"),
    description: z.string().min(1, "Description is required"),
    purpose: z.string().optional(),
    inputs: z.array(z.object({
        name: z.string(),
        type: z.enum(["string", "number", "boolean", "array", "object"]),
        description: z.string(),
        required: z.boolean().optional(),
        default: z.any().optional()
    })),
    expectedOutput: z.string().min(1, "Expected output is required"),
    category: z.string().optional(),
    additionalContext: z.string().optional(),
    examples: z.array(z.object({
        input: z.record(z.any()),
        output: z.any()
    })).optional(),
    modificationRequests: z.array(z.string()).optional(),
    implementation: z.string().optional(),
    modelArgs: modelArgsSchema,
    acceptedStrategy: strategyAnalysisZodSchema.optional().nullable(),
});

// Combined schema for the entire request body
const generateDefinitionRequestSchema = z.object({
    toolRequest: toolRequestSchema,
    modelArgs: modelArgsSchema,
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        logger.info("API: Received request to generate tool definition & implementation", { toolName: body?.toolRequest?.name });

        const validationResult = generateDefinitionRequestSchema.safeParse(body);

        if (!validationResult.success) {
            logger.warn("API: Invalid request format for generate tool definition", { errors: validationResult.error.flatten() });
            return NextResponse.json({ error: "Invalid request format.", details: validationResult.error.flatten() }, { status: 400 });
        }

        const { toolRequest, modelArgs } = validationResult.data;

        // --- Crucial: Pass acceptedStrategy to CORE_generateCustomToolDefinition ---
        // The toolRequest from the client payload now includes acceptedStrategy (if provided by client)
        // and its structure is validated by strategyAnalysisZodSchema.
        const refinedDefinition = await CORE_generateCustomToolDefinition(
            toolRequest as ToolRequest, // This toolRequest object now contains the (optional) acceptedStrategy
            modelArgs as ModelArgs,
            toolRequest.acceptedStrategy // Explicitly passing here for clarity, though it's part of toolRequest
        );

        // Ensure refinedDefinition is not null or undefined before sending
        if (!refinedDefinition) {
            logger.error("API: CORE_generateCustomToolDefinition returned undefined/null", { toolName: toolRequest.name });
            return NextResponse.json({ error: "Failed to generate tool definition: Core function returned empty." }, { status: 500 });
        }
        
        logger.info("API: Successfully generated tool definition & implementation", { toolName: refinedDefinition.name, type: refinedDefinition.implementationType });
        
        return NextResponse.json({
            success: true,
            definition: refinedDefinition
        });

    } catch (error) {
        const toolName = (await req.json().catch(() => ({})))?.toolRequest?.name || "Unknown tool";
        logger.error(`API Error generating tool definition for ${toolName}:`, { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json({ error: `Failed to generate tool definition: ${error instanceof Error ? error.message : "Unknown error"}` }, { status: 500 });
    }
} 