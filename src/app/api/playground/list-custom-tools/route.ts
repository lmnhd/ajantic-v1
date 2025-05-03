import { NextResponse, NextRequest } from 'next/server';
// Remove ToolRegistry import if no longer needed here
// import { ToolRegistry } from '@/lib/agent-tools/tool-registry/registry';
import { createCustomToolReference } from '@/src/lib/agent-tools/tool-registry/custom-tool-ref';
import { logger } from '@/src/lib/logger';
import { ToolRegistryEntry } from '@/src/lib/agent-tools/tool-registry/ct-types';
// Import the specific action function directly
import { CUSTOM_TOOL_listAllTools } from '@/src/lib/agent-tools/tool-registry/ct-actions';

// Define the expected shape of the tool data we want to return to the frontend
interface ToolListItem {
    id: string;
    name: string;
    reference: string; // e.g., CUSTOM_TOOL:id
    description?: string;
}

// Use NextRequest to access URL parameters
export async function GET(req: NextRequest) {
    try {
        // **** MODIFIED: Extract userId from query parameters ****
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');

        // Validate userId
        if (!userId) {
            logger.warn("API: list-custom-tools request missing userId query parameter.");
            return NextResponse.json({ error: "User ID is required to list tools." }, { status: 400 });
        }

        logger.info(`API: Fetching list of custom tools for user ${userId}`);

        // Call the action function directly, passing the extracted userId
        const allToolsRaw: ToolRegistryEntry[] = await CUSTOM_TOOL_listAllTools(userId);

        if (!allToolsRaw) {
             logger.warn("API: CUSTOM_TOOL_listAllTools returned null or undefined.", { userId });
             // It's more likely to return an empty array than null/undefined
             return NextResponse.json({ tools: [] }); // Return empty list if action returns null/undefined
        }

        // Format the tools for the frontend API response
        const toolList: ToolListItem[] = allToolsRaw.map((tool: ToolRegistryEntry) => ({
            id: tool.id,
            name: tool.name,
            reference: createCustomToolReference(tool.id),
            description: tool.description || undefined // Include description if it exists
        }));

        logger.info(`API: Found ${toolList.length} custom tools for user ${userId}.`);
        return NextResponse.json({ tools: toolList });

    } catch (error) {
        logger.error("API Error fetching custom tool list:", { error: error instanceof Error ? error.message : String(error) });
        // Check if the error message indicates the action is missing (though less likely now with direct import)
        if (error instanceof Error && error.message.includes('CUSTOM_TOOL_listAllTools is not a function')) {
             return NextResponse.json({ error: "Internal server error: Tool listing action not implemented." }, { status: 501 }); // 501 Not Implemented
        }
        return NextResponse.json({ error: "Internal server error fetching tool list." }, { status: 500 });
    }
}
