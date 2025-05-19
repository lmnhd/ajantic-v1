import { NextResponse, NextRequest } from 'next/server';
import { logger } from '@/src/lib/logger';
import { CORE_generateCustomToolDefinition } from '@/src/lib/agent-tools/auto-gen-tool/auto-gen-tool_core';
import { ToolRegistry } from '@/src/lib/agent-tools/tool-registry/registry';
import { ToolRequest } from '@/src/lib/types';
import { z } from 'zod';
import { getCustomToolId, isCustomToolReference } from '@/src/lib/agent-tools/tool-registry/custom-tool-ref';
import { ModelProviderEnum, ModelArgs } from "@/src/lib/types"; // Import ModelArgs related types
import { MODEL_JSON, UTILS_getModelArgsByName } from '@/src/lib/utils';

// --- Schemas for Accepted Strategy (copied from generate-tool-definition/route.ts) ---
const preliminaryResearchIdentifiersSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  serviceName: z.string().optional(),
  targetUrl: z.string().optional(),
});

const strategyAnalysisSchema = z.object({
    recommendedType: z.enum(["api", "function"]),
    strategyDetails: z.string(),
    warnings: z.array(z.string()),
    requiredCredentialName: z.string().optional().nullable(),
    preliminaryFindings: z.string().optional(),
    preliminaryResearchFor: preliminaryResearchIdentifiersSchema.optional(),
});
// --- End Schemas for Accepted Strategy ---

// --- Get Enum Values as Uppercase Strings ---
const providerEnumValues = Object.values(ModelProviderEnum) as [string, ...string[]]; // Cast needed for z.enum

// --- Modify ModelArgs Schema ---
const modelArgsSchema = z.object({
    provider: z.enum(providerEnumValues).describe("The model provider."), // Use z.enum
    modelName: z.string().describe("The specific model name."),
    temperature: z.number().optional().default(0.7).describe("Model temperature."),
    topP: z.number().optional().describe("Model top P."),
    maxTokens: z.number().optional().describe("Model max tokens."),
    // Add other fields from ModelArgs if necessary
}).optional().describe("Optional model arguments for generation.");
// --- End ModelArgs Schema Modification ---

// Update schema to include userId and modelArgs
const toolUpdateRequestSchema = z.object({
    userId: z.string().min(1, "User ID is required for update."),
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
    modelArgs: modelArgsSchema,
    implementation: z.string().optional(),
    implementationType: z.enum(["api", "function", "scraping"]).optional(),
    requiredCredentialNames: z.array(z.object({
        name: z.string().min(1),
        label: z.string().min(1)
    })).optional().describe("Optional array of required credential names and labels."),
    acceptedStrategy: strategyAnalysisSchema.optional().nullable(),
});

export async function PUT(req: NextRequest) {
    // Removed placeholder userId/agentName

    const { searchParams } = new URL(req.url);
    const toolRef = searchParams.get('ref');

    if (!toolRef || !isCustomToolReference(toolRef)) {
        return NextResponse.json({ error: "Valid tool reference (e.g., CUSTOM_TOOL:id) is required as query parameter 'ref'." }, { status: 400 });
    }
    const toolId = getCustomToolId(toolRef);
    if (!toolId) { // Add check for toolId extraction
        return NextResponse.json({ error: "Could not extract tool ID from reference." }, { status: 400 });
    }

    try {
        const body = await req.json();
        logger.info(`API: Received request to update tool ${toolRef}`, { userId: body?.userId });

        // Validate the incoming update request body
        const validationResult = toolUpdateRequestSchema.safeParse(body);
        if (!validationResult.success) {
            logger.warn("API: Invalid request format for tool update", { errors: validationResult.error.flatten() });
            return NextResponse.json({ error: "Invalid request format.", details: validationResult.error.flatten() }, { status: 400 });
        }

        const validatedData = validationResult.data;
        const requestingUserId = validatedData.userId;

        // **** ADDED: Ownership Check ****
        const existingTool = await ToolRegistry.getToolById(toolId);
        if (!existingTool) {
            logger.warn(`API: Tool not found for update`, { toolId, requestingUserId });
            return NextResponse.json({ error: `Tool with ID '${toolId}' not found.` }, { status: 404 });
        }
        if (existingTool.userId !== requestingUserId) {
            logger.error(`API: Unauthorized attempt to update tool`, { toolId, owner: existingTool.userId, requester: requestingUserId });
            return NextResponse.json({ error: "Unauthorized: You do not own this tool." }, { status: 403 });
        }
        // **** END: Ownership Check ****

        // Prepare update payload for registry directly from validated client data
        const updatePayload: any = {
            name: validatedData.name,
            description: validatedData.description,
            parameters: validatedData.inputs, 
            metadata: {
                 ...(existingTool.metadata ? JSON.parse(existingTool.metadata) : {}), // Preserve existing metadata
                 category: validatedData.category,
                 additionalContext: validatedData.additionalContext,
                 purpose: validatedData.purpose,
                 expectedOutput: validatedData.expectedOutput, 
                 userId: existingTool.userId, // CRITICAL: Keep the original owner
                 updatedAt: new Date().toISOString(),
            }
        };

        // Conditionally add implementation and implementationType if provided
        if (validatedData.implementation !== undefined) {
            updatePayload.implementation = validatedData.implementation;
        }
        if (validatedData.implementationType !== undefined) {
            updatePayload.implementationType = validatedData.implementationType;
        }

        // Handle acceptedStrategy
        if (validatedData.acceptedStrategy !== undefined) {
            if (validatedData.acceptedStrategy === null) {
                updatePayload.acceptedStrategyJson = null;
            } else {
                updatePayload.acceptedStrategyJson = JSON.stringify(validatedData.acceptedStrategy);
            }
        }
        
        // Handle requiredCredentialNames (ensure it's passed if present in schema/validatedData)
        if (validatedData.requiredCredentialNames !== undefined) {
            updatePayload.requiredCredentialNames = validatedData.requiredCredentialNames;
        }

        logger.info(`API: Updating tool ${toolId} in registry with client data for user ${requestingUserId}`, { updates: Object.keys(updatePayload) });
        const updatedToolRef = await ToolRegistry.updateTool(toolId, updatePayload);

        logger.info("API: Successfully updated tool with client data", { toolName: validatedData.name, toolId, toolRef: updatedToolRef, userId: requestingUserId });

        return NextResponse.json({
            success: true,
            message: `Tool "${validatedData.name}" updated successfully with current data!`, // Adjusted message
            toolId: toolId,
            toolRef: updatedToolRef,
            definition: { // Send back the data that was saved
                name: validatedData.name,
                description: validatedData.description,
                inputs: validatedData.inputs,
                expectedOutput: validatedData.expectedOutput,
                implementation: validatedData.implementation,
                implementationType: validatedData.implementationType,
                requiredCredentialNames: validatedData.requiredCredentialNames,
            }
        });

    } catch (error) {
        logger.error(`API Error updating tool ${toolRef}:`, { error: error instanceof Error ? error.message : String(error) });
        // Handle potential errors from ToolRegistry.updateTool (e.g., not found)
        if (error instanceof Error && error.message.includes("not found")) {
             return NextResponse.json({ error: `Tool with ID '${toolId}' not found for update.` }, { status: 404 });
        }
        return NextResponse.json({ error: "Internal server error updating tool." }, { status: 500 });
    }
} 