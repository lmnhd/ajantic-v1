import { NextResponse, NextRequest } from 'next/server';
import { z, ZodTypeAny } from 'zod';

// Assuming these are correctly exported from your ajantic-v1 project structure
// Adjust paths as necessary if this 'lyrical' app is separate
// If they are in the same monorepo, use appropriate workspace imports (e.g., '@ajantic/lib/...')
import { ToolRegistry } from '@/src/lib/agent-tools/tool-registry/registry';
import { isCustomToolReference, getCustomToolId, createCustomToolReference } from '@/src/lib/agent-tools/tool-registry/custom-tool-ref';
import { logger } from '@/src/lib/logger'; // Assuming logger is available
import { ToolListItem } from './types';
import { CORE_executeTool } from '@/src/lib/agent-tools/auto-gen-tool/auto-gen-tool_core'; // Use CORE_executeTool directly

// Removed replicated logic/helpers (parseZodSchemaFromToolParameters, createToolExecutor)
// We will rely on CORE_executeTool which uses ToolFactory internally

export async function POST(req: NextRequest) { // Use NextRequest
    try {
        const body = await req.json();
        // **** MODIFIED: Extract userId from body ****
        const { toolRef, toolArgs, userId } = body;

        // Validate required fields
        if (!userId) {
            logger.warn("API: Execute custom tool request missing userId.");
            return NextResponse.json({ error: "User ID is required to execute a tool." }, { status: 400 });
        }
        if (!toolRef || typeof toolRef !== 'string' || !isCustomToolReference(toolRef)) {
            logger.warn("API: Execute custom tool request with invalid toolRef.", { toolRef, userId });
            return NextResponse.json({ error: "Invalid or missing tool reference. Expected format 'CUSTOM_TOOL:id'." }, { status: 400 });
        }

        const toolId = getCustomToolId(toolRef);
        if (!toolId) {
            // Should not happen if isCustomToolReference passed, but good check
            logger.error("API: Failed to extract toolId from valid reference.", { toolRef, userId });
            return NextResponse.json({ error: "Could not extract tool ID from reference." }, { status: 400 });
        }

        // **** ADDED: Ownership/Access Check ****
        const toolEntry = await ToolRegistry.getToolById(toolId);
        if (!toolEntry) {
            logger.warn(`API: Execute attempt failed - Tool not found`, { toolId, userId });
            return NextResponse.json({ error: `Custom tool with ID '${toolId}' not found.` }, { status: 404 });
        }
        // Compare the userId from the request body with the tool's ownerId
        if (toolEntry.userId !== userId) {
            logger.error(`API: Execute attempt failed - Unauthorized`, { toolId, owner: toolEntry.userId, requester: userId });
            return NextResponse.json({ error: "Unauthorized: You do not own this tool." }, { status: 403 });
        }
        // **** END: Ownership/Access Check ****


        // Prepare parameters for CORE_executeTool
        const executeParams = {
            toolRef: toolRef, // Pass the validated reference
            toolArgs: toolArgs || {} // Pass arguments, default to empty object
        };

        logger.info(`API: Executing tool ${toolRef} for user ${userId} with args:`, executeParams.toolArgs);

        // Call the refactored core execution function (doesn't need agentName or textChatLogs from here)
        const result = await CORE_executeTool(null, executeParams); // Pass null for textChatLogs if not available/needed here

        logger.info(`API: Execution result for ${toolRef} (User: ${userId}):`, { success: result?.success, isError: result?._isToolError });

        // CORE_executeTool returns a structured object (either success data or error details)
        if (result?._isToolError === true || result?.success === false) {
            // If the core function returned a structured error, pass it through
            return NextResponse.json({ success: false, error: result.error || "Tool execution failed." }, { status: 400 }); // Use 400 for tool execution errors
        } else {
            // Return the successful result from the tool
            return NextResponse.json({ success: true, result: result });
        }

    } catch (error) {
        logger.error("API Error processing custom tool execution:", { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json({ success: false, error: "Internal server error processing custom tool execution." }, { status: 500 });
    }
}

// Removed GET handler - functionality moved to list-custom-tools/route.ts
// export async function GET(req: Request) { ... }

// Placeholder type for the expected return value of listAllTools (adjust as needed)
// declare module '@/lib/agent-tools/tool-registry/registry' { // Use module augmentation
//   interface ToolRegistry {
//     listAllTools?(): Promise<{ id: string; name: string; description?: string }[] | null>;
//     // Add getToolsForUser if that's the alternative
//     // getToolsForUser?(userId: string): Promise<{ id: string; name: string; description?: string }[] | null>;
//   }
// }