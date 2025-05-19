import { ToolInputParameter } from "@/src/lib/types"; // Import the parameter type

export interface ToolListItem {
    id: string;
    name: string;
    reference: string; // e.g., CUSTOM_TOOL:id
    description?: string; // Optional: include description if helpful
}

// --- ADD NEW TYPES START ---

// Extended details fetched for a specific tool
export interface ToolDetails extends ToolListItem {
    // Parameters should always be returned as an array by the API
    parameters: ToolInputParameter[];
    purpose?: string;
    expectedOutput?: string;
    implementation?: string;
    implementationType?: string;
    metadata?: {
        category?: string;
        additionalContext?: string;
        examples?: { input: Record<string, any>; output: any }[];
        [key: string]: any; // Allow other metadata
    };
    requiredCredentialNames?: Array<{ name: string; label: string }>;
}

// Response from the tool execution endpoint
export interface ToolExecutionResponse {
    result?: any; // The actual result from the tool
    error?: string;
    details?: any; // Optional validation details on error
}

// Type for the full definition returned by generate-tool-definition endpoint
export interface GeneratedToolDefinition {
    name: string;
    description: string;
    parameters: ToolInputParameter[]; // Use the consistent type
    expectedOutput?: string;
    implementation: string;
    requiredCredentialNames?: Array<{ name: string; label: string }>;
    parametersSchema?: string; // Keep this if it's part of the response
    implementationType?: string;
    category?: string;
    metadata?: Record<string, any>;
}

// Response from the generate-tool-definition endpoint
export interface ToolDefinitionResponse {
    definition?: GeneratedToolDefinition;
    error?: string;
    details?: any; // Optional validation details on error
}

// Response from the create-tool and update-tool endpoints
export interface ToolCreationResponse {
    success?: boolean;
    message?: string;
    toolId?: string;
    toolRef?: string;
    definition?: GeneratedToolDefinition; // Include the created/updated def
    error?: string;
    details?: any; // Optional validation details on error
}

// --- ADD NEW TYPES END ---