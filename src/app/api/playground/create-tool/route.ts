import { NextResponse, NextRequest } from 'next/server';
import { logger } from '@/src/lib/logger';
import { ToolRegistry } from '@/src/lib/agent-tools/tool-registry/registry';
import { getCustomToolId } from '@/src/lib/agent-tools/tool-registry/custom-tool-ref'; // Import helper
import { z } from 'zod';
import { Prisma } from '@prisma/client'; // Import Prisma for specific error handling

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

// Schema for the expected DIRECT registration request body
const toolCreateRequestSchema = z.object({
    userId: z.string().min(1, "User ID is required."), // Need userId to associate the tool
    name: z.string().min(1, "Tool name is required"),
    description: z.string().min(1, "Description is required"),
    inputs: z.array(z.object({ // Validate inputs structure
        name: z.string(),
        type: z.enum(["string", "number", "boolean", "array", "object"]),
        description: z.string(),
        required: z.boolean().optional(),
        default: z.any().optional()
    })),
    implementation: z.string().min(1, "Function implementation body is required"), // Must have implementation
    implementationType: z.enum(["api", "function"]).optional().default("function"), // Added, defaults to function
    // Optional fields for metadata
    purpose: z.string().optional(),
    expectedOutput: z.string().optional(),
    category: z.string().optional(),
    additionalContext: z.string().optional(),
    // Examples are often stored in metadata, accept optional JSON string or object array
    examples: z.union([z.string(), z.array(z.object({
        input: z.record(z.any()),
        output: z.any()
    }))]).optional(),
    acceptedStrategy: strategyAnalysisSchema.optional(),
});

export async function POST(req: NextRequest) {
    let body: any; // Declare body outside the try block

    try {
        body = await req.json(); // Assign inside the try block
        logger.info("API: Received request to create tool directly", { userId: body?.userId, toolName: body?.name });

        // Validate request body against the new schema
        const validationResult = toolCreateRequestSchema.safeParse(body);
        if (!validationResult.success) {
            logger.warn("API: Invalid request format for direct tool creation", { errors: validationResult.error.flatten() });
            return NextResponse.json({ error: "Invalid request format.", details: validationResult.error.flatten() }, { status: 400 });
        }

        const {
            userId,
            name,
            description,
            inputs,
            implementation,
            implementationType,
            purpose,
            expectedOutput,
            category,
            additionalContext,
            examples, // Extract examples
            acceptedStrategy, // Extract acceptedStrategy
        } = validationResult.data;

        // --- Optional: Basic validation for API implementation string ---
        if (implementationType === "api") {
            try {
                JSON.parse(implementation); // Check if it's valid JSON
            } catch (e) {
                logger.warn("API: Invalid JSON for API implementation string", { toolName: name, error: e });
                return NextResponse.json({ error: "Implementation for 'api' type tools must be a valid JSON string." }, { status: 400 });
            }
        }
        // --- End Optional Validation ---

        // Prepare metadata object
        const metadata: Record<string, any> = {
            userId: userId, // Store userId in metadata for consistency/reference if needed
            source: "playground-created-direct", // Indicate direct creation
            createdAt: new Date().toISOString(),
            purpose: purpose,
            expectedOutput: expectedOutput,
            category: category,
            additionalContext: additionalContext,
        };

        // Handle examples - store them in metadata (assuming JSON array)
        if (examples) {
            if (typeof examples === 'string') {
                try {
                    metadata.examples = JSON.parse(examples);
                    if (!Array.isArray(metadata.examples)) metadata.examples = undefined; // Clear if not array
                } catch (e) {
                    logger.warn("Failed to parse examples JSON string during direct create", { error: e });
                    metadata.examples = undefined; // Don't store invalid JSON
                }
            } else if (Array.isArray(examples)) {
                metadata.examples = examples;
            }
        }

        // Prepare acceptedStrategyJson
        let acceptedStrategyJson: string | undefined = undefined;
        if (acceptedStrategy) {
            try {
                // Validate the structure matches our schema
                const validationResult = strategyAnalysisSchema.safeParse(acceptedStrategy);
                if (!validationResult.success) {
                    logger.warn("API: Invalid acceptedStrategy structure", { errors: validationResult.error.flatten() });
                    return NextResponse.json({ error: "Invalid acceptedStrategy structure.", details: validationResult.error.flatten() }, { status: 400 });
                }
                acceptedStrategyJson = JSON.stringify(validationResult.data);
                logger.info("API: Validated and prepared acceptedStrategy", { 
                    recommendedType: validationResult.data.recommendedType,
                    hasWarnings: validationResult.data.warnings.length > 0
                });
            } catch (error) {
                logger.error("API: Failed to process acceptedStrategy", { error: error instanceof Error ? error.message : String(error) });
                return NextResponse.json({ error: "Failed to process acceptedStrategy." }, { status: 400 });
            }
        }

        // Call ToolRegistry.registerTool directly
        const toolRef = await ToolRegistry.registerTool(
            userId,
            name,
            description,
            inputs, // Pass validated inputs directly
            implementation,
            implementationType, // Pass the implementationType
            metadata,
            acceptedStrategyJson
        );

        const toolId = getCustomToolId(toolRef); // Use helper to extract ID

        logger.info("API: Successfully created tool directly", { toolName: name, toolId, toolRef, userId });

        // Return success response
        return NextResponse.json({
            success: true,
            message: `Tool "${name}" created and registered successfully.`,
            toolRef: toolRef,
            toolId: toolId,
            // Optionally return parts of the definition if needed by the client
            definition: {
                name: name,
                description: description,
                parameters: inputs,
                implementation: implementation,
                implementationType: implementationType, // Include in response
                expectedOutput: expectedOutput,
                acceptedStrategy: acceptedStrategy // Include in response if present
            }
        });

    } catch (error) {
        logger.error("API Error processing direct create tool request:", { error: error instanceof Error ? error.message : String(error) });

        // Handle specific Prisma unique constraint error for tool name per user
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
             // Now 'body' is accessible here
            logger.warn("API Create: Tool name already exists for this user", { toolName: body?.name, userId: body?.userId });
            return NextResponse.json({ error: `A tool named "${body?.name}" already exists for this user.` }, { status: 409 }); // 409 Conflict
        }

        return NextResponse.json({ error: "Internal server error creating tool." }, { status: 500 });
    }
}