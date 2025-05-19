'use server';

import { NextResponse, NextRequest } from 'next/server';
import { ToolRegistry } from '@/src/lib/agent-tools/tool-registry/registry';
import { logger } from '@/src/lib/logger';
import { ToolRegistryEntry } from '@/src/lib/agent-tools/tool-registry/ct-types';
import { createCustomToolReference } from '@/src/lib/agent-tools/tool-registry/custom-tool-ref';

// Define the shape of a single parameter's definition
interface ToolParameterDefinition {
    name: string;
    type: string; // e.g., 'string', 'number', 'boolean'
    description: string;
    required?: boolean;
    default?: any;
}

// Interface for the data structure we expect to return to the frontend
interface FrontendToolDetails {
    id: string;
    reference: string;
    name: string;
    description: string;
    parameters: ToolParameterDefinition[];
    implementation: string;
    implementationType: string;
    expectedOutput?: string;
    purpose?: string;
    category?: string;
    additionalContext?: string;
    examples?: any[];
    metadata?: Record<string, any>;
    requiredCredentialNames?: Array<{ name: string; label: string }>;
    acceptedStrategyJson?: Record<string, any> | null;
    version?: number | null;
    createdAt?: Date;
    updatedAt?: Date;
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const toolId = searchParams.get('id');
    // const userId = searchParams.get('userId'); // IMPORTANT: Get userId from authenticated session in production

    if (!toolId) {
        return NextResponse.json({ error: "Tool ID is required." }, { status: 400 });
    }

    // Placeholder for actual user ID from session
    // const sessionUserId = await getUserIdFromSession(req); 
    // if (!sessionUserId) { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

    try {
        logger.info(`API: Fetching details for tool ID: ${toolId}`);
        const toolEntry = await ToolRegistry.getToolById(toolId);

        if (!toolEntry /*|| toolEntry.userId !== sessionUserId */) { // Add userId check once session is integrated
            logger.warn(`API: Tool details not found for ID: ${toolId} or user not authorized.`);
            return NextResponse.json({ error: `Tool with ID '${toolId}' not found or not authorized.` }, { status: 404 });
        }

        // Cast toolEntry to 'any' for now to access potentially dynamic fields from Prisma model
        // Ideally, ToolRegistryEntry would be comprehensive or getToolById would return a typed Prisma model.
        const rawToolData = toolEntry as any;

        let parameters: ToolParameterDefinition[] = [];
        if (rawToolData.parameters && typeof rawToolData.parameters === 'string') {
            try {
                const parsed = JSON.parse(rawToolData.parameters);
                if (Array.isArray(parsed)) {
                    parameters = parsed.map((p: any): ToolParameterDefinition => ({
                        name: typeof p?.name === 'string' ? p.name : 'unknown_param',
                        type: typeof p?.type === 'string' ? p.type : 'string',
                        description: typeof p?.description === 'string' ? p.description : '',
                        required: typeof p?.required === 'boolean' ? p.required : true,
                        default: p?.default
                    }));
                } else { parameters = []; }
            } catch (e) { 
                logger.error(`API: Failed to parse parameters JSON for tool ${toolId}`, {e}); 
                parameters = []; 
            }
        } else if (Array.isArray(rawToolData.parameters)) {
             parameters = rawToolData.parameters;
        }

        let parsedMetadata: Record<string, any> = {};
        if (rawToolData.metadata && typeof rawToolData.metadata === 'string') {
            try {
                const parsed = JSON.parse(rawToolData.metadata);
                if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
                    parsedMetadata = parsed;
                } else { parsedMetadata = {}; }
            } catch (e) { 
                logger.error(`API: Failed to parse metadata JSON for tool ${toolId}`, {e}); 
                parsedMetadata = {}; 
            }
        } else if (typeof rawToolData.metadata === 'object' && rawToolData.metadata !== null) {
             parsedMetadata = rawToolData.metadata;
        }

        let parsedRequiredCredentialNames: Array<{ name: string; label: string }> = [];
        if (rawToolData.requiredCredentialNames && typeof rawToolData.requiredCredentialNames === 'string') {
            try {
                const parsed = JSON.parse(rawToolData.requiredCredentialNames);
                if (Array.isArray(parsed)) {
                     // Add a type check for each element to be safe
                    parsedRequiredCredentialNames = parsed.filter(
                        (item: any) => typeof item === 'object' && item !== null && 'name' in item && 'label' in item
                    );
                } else { parsedRequiredCredentialNames = []; }
            } catch (e) { 
                logger.error(`API: Failed to parse requiredCredentialNames for tool ${toolId}`, {e}); 
                parsedRequiredCredentialNames = []; 
            }
        } else if (Array.isArray(rawToolData.requiredCredentialNames)) { 
            // If it's already an array, filter for correct structure
            parsedRequiredCredentialNames = rawToolData.requiredCredentialNames.filter(
                (item: any) => typeof item === 'object' && item !== null && 'name' in item && 'label' in item
            );
        }
        
        let parsedAcceptedStrategyJson: Record<string, any> | null = null;
        if (rawToolData.acceptedStrategyJson && typeof rawToolData.acceptedStrategyJson === 'string') {
            try {
                parsedAcceptedStrategyJson = JSON.parse(rawToolData.acceptedStrategyJson);
                 if (typeof parsedAcceptedStrategyJson !== 'object' || parsedAcceptedStrategyJson === null || Array.isArray(parsedAcceptedStrategyJson)) {
                    parsedAcceptedStrategyJson = null; // Ensure it's an object or null
                }
            } catch (e) { 
                logger.error(`API: Failed to parse acceptedStrategyJson for tool ${toolId}`, {e}); 
                parsedAcceptedStrategyJson = null; 
            }
        }

        const responseData: FrontendToolDetails = {
            id: rawToolData.id,
            reference: createCustomToolReference(rawToolData.id), 
            name: rawToolData.name,
            description: rawToolData.description,
            parameters: parameters,
            implementation: rawToolData.implementation,
            implementationType: rawToolData.implementationType,
            expectedOutput: parsedMetadata?.expectedOutput,
            purpose: parsedMetadata?.purpose,
            category: parsedMetadata?.category,
            additionalContext: parsedMetadata?.additionalContext,
            examples: parsedMetadata?.examples,
            metadata: parsedMetadata,
            requiredCredentialNames: parsedRequiredCredentialNames,
            acceptedStrategyJson: parsedAcceptedStrategyJson,
            version: rawToolData.version !== undefined ? Number(rawToolData.version) : null, // Ensure version is number or null
            createdAt: rawToolData.createdAt ? new Date(rawToolData.createdAt) : undefined,
            updatedAt: rawToolData.updatedAt ? new Date(rawToolData.updatedAt) : undefined,
        };

        return NextResponse.json(responseData);

    } catch (error) {
        logger.error(`API Error fetching details for tool ${toolId}:`, { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json({ error: "Internal server error fetching tool details." }, { status: 500 });
    }
} 