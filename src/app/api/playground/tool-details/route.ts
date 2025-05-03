import { NextResponse, NextRequest } from 'next/server';
import { ToolRegistry } from '@/src/lib/agent-tools/tool-registry/registry';
import { logger } from '@/src/lib/logger';
import { ToolRegistryEntry } from '@/src/lib/agent-tools/tool-registry/ct-types';

// Define the shape of a single parameter's definition
interface ToolParameterDefinition {
    name: string;
    type: string; // e.g., 'string', 'number', 'boolean'
    description: string;
    required?: boolean;
    default?: any;
}

// --- Define structure for parsed metadata ---
interface ParsedMetadata {
    expectedOutput?: string;
    purpose?: string;
    category?: string;
    additionalContext?: string;
    examples?: any[];
    [key: string]: any; // Allow other properties
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const toolId = searchParams.get('id');

    if (!toolId) {
        return NextResponse.json({ error: "Tool ID is required." }, { status: 400 });
    }

    try {
        logger.info(`API: Fetching details for tool ID: ${toolId}`);

        const toolEntry: ToolRegistryEntry | null = await ToolRegistry.getToolById(toolId);

        if (!toolEntry) {
            logger.warn(`API: Tool details not found for ID: ${toolId}`);
            return NextResponse.json({ error: `Tool with ID '${toolId}' not found.` }, { status: 404 });
        }

        // --- Parameters Parsing (Improved) ---
        let parameters: ToolParameterDefinition[] = [];
        if (toolEntry.parameters && typeof toolEntry.parameters === 'string') {
            try {
                const parsed = JSON.parse(toolEntry.parameters);
                if (Array.isArray(parsed)) {
                    // Basic structure validation/defaults for each parameter
                    parameters = parsed.map((p: any): ToolParameterDefinition => ({
                        name: typeof p?.name === 'string' ? p.name : 'unknown_param',
                        type: typeof p?.type === 'string' ? p.type : 'string',
                        description: typeof p?.description === 'string' ? p.description : '',
                        required: typeof p?.required === 'boolean' ? p.required : true,
                        default: p?.default // Include default if present
                    }));
                } else {
                     logger.warn(`Parsed parameters for tool ${toolId} is not an array.`);
                     parameters = []; // Reset to empty if not an array
                }
            } catch (parseError) {
                logger.error(`API: Failed to parse parameters JSON for tool ID ${toolId}`, { jsonString: toolEntry.parameters, error: parseError });
                parameters = []; // Return empty on parse error
            }
        } else if (Array.isArray(toolEntry.parameters)) {
             logger.warn(`Parameters for tool ${toolId} were already an array, not a JSON string.`);
             parameters = toolEntry.parameters as ToolParameterDefinition[]; // Assume structure is correct if already array
        }
        // --- End Parameters Parsing ---

        // --- Metadata Parsing (Improved) ---
        let parsedMetadata: ParsedMetadata | undefined = undefined;
        if (toolEntry.metadata && typeof toolEntry.metadata === 'string') {
            try {
                const parsed = JSON.parse(toolEntry.metadata);
                // Check if it's a valid object
                if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                    parsedMetadata = parsed as ParsedMetadata;
                } else {
                    logger.warn(`Parsed metadata for tool ${toolId} is not a valid object.`);
                    parsedMetadata = { parseWarning: 'Parsed metadata was not an object' };
                }
            } catch (parseError) {
                 logger.error(`API: Failed to parse metadata JSON for tool ID ${toolId}`, { jsonString: toolEntry.metadata, error: parseError });
                 parsedMetadata = { parseError: 'Failed to parse metadata string' }; // Indicate error in metadata
            }
        } else if (typeof toolEntry.metadata === 'object' && toolEntry.metadata !== null) {
             // If metadata is somehow already an object in the DB entry
             parsedMetadata = toolEntry.metadata as ParsedMetadata;
        }
        // --- End Metadata Parsing ---

        logger.info(`API: Found ${parameters.length} parameters for tool ${toolEntry.name}`);

        // Return the necessary details for the frontend
        // Access properties safely via the parsedMetadata object
        return NextResponse.json({
            id: toolEntry.id,
            reference: toolEntry.reference, // Included reference
            name: toolEntry.name,
            description: toolEntry.description,
            parameters: parameters, // The parsed array
            implementation: toolEntry.implementation, // Add the implementation string
            // --- CORRECTED ACCESS TO METADATA PROPERTIES ---
            expectedOutput: parsedMetadata?.expectedOutput, // Access via parsed object
            purpose: parsedMetadata?.purpose, // Access via parsed object
            metadata: parsedMetadata // Add the fully parsed metadata object
            // --- END CORRECTION ---
         });

    } catch (error) {
        logger.error(`API Error fetching details for tool ${toolId}:`, { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json({ error: "Internal server error fetching tool details." }, { status: 500 });
    }
} 