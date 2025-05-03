import { NextResponse, NextRequest } from 'next/server';
import { logger } from '@/src/lib/logger';
import { CORE_generateCustomToolDefinition } from '@/src/lib/agent-tools/auto-gen-tool/auto-gen-tool_core';
import { ToolRegistry } from '@/src/lib/agent-tools/tool-registry/registry';
import { ToolRequest } from '@/src/lib/types';
import { z } from 'zod';
import { getCustomToolId, isCustomToolReference } from '@/src/lib/agent-tools/tool-registry/custom-tool-ref';
import { ModelProviderEnum, ModelArgs } from "@/src/lib/types"; // Import ModelArgs related types
import { MODEL_JSON, UTILS_getModelArgsByName } from '@/src/lib/utils';

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
    userId: z.string().min(1, "User ID is required for update."), // **** ADDED: Required userId ****
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
    modelArgs: modelArgsSchema, // **** ADDED: Optional modelArgs ****
    // Removed modificationRequests/examples if not needed for update payload itself
    // modelArgs: modelArgsSchema // modelArgs might not be needed for update payload validation
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
        const requestingUserId = validatedData.userId; // Get userId from body
        const clientModelArgs = validatedData.modelArgs; // **** ADDED: Extract client modelArgs ****

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

        // **** ADDED: Get existing implementation ****
        const existingImplementation = existingTool.implementation;
        if (!existingImplementation) {
            logger.error(`API Update: Existing implementation not found for tool ${toolId}. Cannot proceed with update.`);
            return NextResponse.json({ error: `Existing implementation for tool '${toolId}' could not be found. Update requires existing code.` }, { status: 404 });
        }
        // **** END ADDED ****

        // Construct ToolRequest for regeneration (as before)
        // **** MODIFIED: Include existing implementation ****
        const toolRequestForRegen: ToolRequest = {
             name: validatedData.name,
             description: validatedData.description,
             purpose: validatedData.purpose,
             inputs: validatedData.inputs,
             expectedOutput: validatedData.expectedOutput,
             category: validatedData.category,
             additionalContext: validatedData.additionalContext,
             implementation: existingImplementation, // Pass the existing implementation
             // examples/modificationRequests are not typically part of an update payload's *direct* fields
             // but might be in metadata if needed by CORE_generate...
        };
        // **** END MODIFIED ****

        // Get model args (using default for now, could make configurable)
        // --- Updated model fetching ---
        let modelArgsForGeneration: ModelArgs;
        const defaultModelName = MODEL_JSON().OpenAI['gpt-4o']?.name ?? "openai:gpt-4o"; // More robust default

        try {
            if (clientModelArgs && clientModelArgs.modelName) {
                // Try using client-provided model args
                logger.info(`API Update: Using client-provided model: ${clientModelArgs.modelName}`);
                // Use UTILS_getModelArgsByName to ensure consistency and handle potential lookup errors
                modelArgsForGeneration = UTILS_getModelArgsByName(clientModelArgs.modelName);
                // Optionally merge other client-provided args like temperature if needed
                if (clientModelArgs.temperature !== undefined) {
                    modelArgsForGeneration.temperature = clientModelArgs.temperature;
                }
                // Add other optional args (topP, maxTokens) similarly if desired
            } else {
                // Fallback to default if client didn't provide modelArgs or modelName
                logger.info(`API Update: Client did not provide modelArgs, using default: ${defaultModelName}`);
                modelArgsForGeneration = UTILS_getModelArgsByName(defaultModelName);
            }
        } catch (e) {
            logger.error(`API Update: Failed to get model args (Client: ${clientModelArgs?.modelName}, Default: ${defaultModelName}). Falling back to safe default.`, { error: e });
            // Final fallback in case UTILS_getModelArgsByName throws for both client and default
            modelArgsForGeneration = {
                provider: ModelProviderEnum.OPENAI,
                modelName: "openai:gpt-4o", // Use a known safe string literal
                temperature: 0.7
            };
        }
        // --- End Updated model fetching ---

        // Regenerate definition/implementation
        const refinedDefinition = await CORE_generateCustomToolDefinition(toolRequestForRegen, modelArgsForGeneration);

        if (!refinedDefinition.implementation || refinedDefinition.implementation.startsWith("// Error")) {
             logger.error("API: Failed to regenerate valid implementation for tool update", { name: refinedDefinition.name, toolId });
             return NextResponse.json({ error: "Failed to regenerate tool implementation code for update.", definition: refinedDefinition }, { status: 500 });
        }

        // Prepare update payload for registry
        // IMPORTANT: DO NOT PASS userId IN METADATA HERE - ToolRegistry.updateTool doesn't change it
        const updatePayload = {
            name: refinedDefinition.name,
            description: refinedDefinition.description,
            parameters: refinedDefinition.inputs,
            implementation: refinedDefinition.implementation,
            metadata: { // Reconstruct metadata carefully
                 // Start with existing metadata to preserve fields
                 ...(existingTool.metadata ? JSON.parse(existingTool.metadata) : {}),
                 // Overwrite fields from the update request/regeneration
                 category: validatedData.category,
                 additionalContext: validatedData.additionalContext,
                 purpose: validatedData.purpose,
                 expectedOutput: refinedDefinition.expectedOutput,
                 // Ensure userId remains the original owner's ID from existingTool.metadata
                 userId: existingTool.userId, // Explicitly set original userId
                 updatedAt: new Date().toISOString(), // Add update timestamp
            }
        };

        // Call registry update (ownership already checked)
        logger.info(`API: Updating tool ${toolId} in registry for user ${requestingUserId}`, { updates: Object.keys(updatePayload) });
        const updatedToolRef = await ToolRegistry.updateTool(toolId, updatePayload);

        logger.info("API: Successfully updated tool", { toolName: refinedDefinition.name, toolId, toolRef: updatedToolRef, userId: requestingUserId });

        return NextResponse.json({
            success: true,
            message: `Tool "${refinedDefinition.name}" updated successfully!`,
            toolId: toolId,
            toolRef: updatedToolRef,
            definition: refinedDefinition
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