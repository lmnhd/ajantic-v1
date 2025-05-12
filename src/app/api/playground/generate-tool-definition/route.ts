import { NextResponse, NextRequest } from 'next/server';
import { logger } from '@/src/lib/logger';
import { CORE_generateCustomToolDefinition } from '@/src/lib/agent-tools/auto-gen-tool/auto-gen-tool_core';
import { ToolRequest } from '@/src/lib/types'; // Assuming ToolRequest is defined here
import { z } from 'zod';
import { ModelProviderEnum, ModelArgs } from "@/src/lib/types"; // Import ModelArgs related types
import { RecommendedImplementationType, PreliminaryResearchIdentifiers as PreliminaryResearchIdentifiersInterface, AnalysisResult } from '@/src/app/api/playground/analyze-implementation-strategy/_types';

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
    acceptedStrategy: analysisResultAlignedSchema.optional().nullable(), // Use the new aligned schema
});


export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        // Log userId if present for context
        logger.info("API: Received request to generate tool definition", { 
            userId: body?.userId, 
            toolName: body?.name,
            hasModelArgs: !!body?.modelArgs,
            hasAcceptedStrategy: !!body?.acceptedStrategy
        });

        const validationResult = toolRequestSchema.safeParse(body);
        if (!validationResult.success) {
            logger.warn("API: Invalid request format for tool definition generation", { 
                errors: validationResult.error.flatten(),
                receivedBody: {
                    name: body?.name,
                    description: body?.description,
                    inputsCount: body?.inputs?.length,
                    hasExpectedOutput: !!body?.expectedOutput,
                    hasModelArgs: !!body?.modelArgs,
                    modelArgsProvider: body?.modelArgs?.provider,
                    hasAcceptedStrategy: !!body?.acceptedStrategy
                }
            });
            return NextResponse.json({ 
                error: "Invalid request format.", 
                details: validationResult.error.flatten(),
                receivedBody: {
                    name: body?.name,
                    description: body?.description,
                    inputsCount: body?.inputs?.length,
                    hasExpectedOutput: !!body?.expectedOutput,
                    hasModelArgs: !!body?.modelArgs,
                    modelArgsProvider: body?.modelArgs?.provider,
                    hasAcceptedStrategy: !!body?.acceptedStrategy
                }
            }, { status: 400 });
        }

        const validatedData = validationResult.data;
        const userId = validatedData.userId; // Extracted but not used by the core function here
        
        let acceptedStrategyForCore: AnalysisResult | undefined | null = validatedData.acceptedStrategy === null 
            ? null 
            : (validatedData.acceptedStrategy ? validatedData.acceptedStrategy as AnalysisResult : undefined);

        // Prepare modelArgs separately, converting provider string to enum
        const validatedModelArgsData = validatedData.modelArgs;
        let modelArgsForCore: ModelArgs;
        if (validatedModelArgsData && validatedModelArgsData.provider) {
            const providerEnum = mapStringToProviderEnum(validatedModelArgsData.provider);
            if (providerEnum) {
                modelArgsForCore = {
                    provider: providerEnum,
                    modelName: validatedModelArgsData.modelName,
                    temperature: validatedModelArgsData.temperature ?? 0.7,
                    maxInputTokens: validatedModelArgsData.maxTokens,
                    maxOutputTokens: validatedModelArgsData.maxTokens,
                    topP: validatedModelArgsData.topP
                };
                if (validatedModelArgsData.topP !== undefined) modelArgsForCore.topP = validatedModelArgsData.topP;
            } else {
                console.warn(`Invalid provider string '${validatedModelArgsData.provider}' received, using default.`);
                modelArgsForCore = { modelName: "gpt-4o", provider: ModelProviderEnum.OPENAI, temperature: 0.7 }; // Default
            }
        } else {
            modelArgsForCore = { modelName: "gpt-4o", provider: ModelProviderEnum.OPENAI, temperature: 0.7 }; // Default
        }

        // Construct the ToolRequest object for the core function
        // Ensure all required fields for ToolRequest are included from validatedData
        const toolRequestForCore: ToolRequest = {
            name: validatedData.name,
            description: validatedData.description,
            purpose: validatedData.purpose,
            inputs: validatedData.inputs,
            expectedOutput: validatedData.expectedOutput,
            category: validatedData.category,
            additionalContext: validatedData.additionalContext,
            examples: validatedData.examples?.map(ex => ({
                input: ex.input,
                output: ex.output ?? null // Provide default if somehow missing to satisfy ToolRequest type
            })) || undefined,
            modificationRequests: validatedData.modificationRequests,
            implementation: validatedData.implementation,
        };

        // Call the core function with the correctly typed arguments
        const generatedDefinition = await CORE_generateCustomToolDefinition(toolRequestForCore, modelArgsForCore, acceptedStrategyForCore);

        logger.info("API: Successfully generated/modified tool definition", { toolName: generatedDefinition.name, requestingUserId: userId });

        // Return the full generated definition, including the implementation
        return NextResponse.json({ definition: generatedDefinition });

    } catch (error) {
        logger.error("API Error generating tool definition:", { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json({ error: "Internal server error generating tool definition." }, { status: 500 });
    }
} 