"use server";

import { ToolRequest } from "@/src/lib/types";
import { logger } from "@/src/lib/logger";

/**
 * Adapter to convert from the legacy tool request format to the unified format
 * This helps maintain backward compatibility with existing code
 */
export async function adaptLegacyToolRequest(legacyRequest: {
  toolName: string;
  toolDescription: string;
  suggestedInputs: string[];
  suggestedOutputs: string[];
}): Promise<ToolRequest> {
  logger.debug("Adapting legacy tool request", { name: legacyRequest.toolName });
  
  // Convert simple input strings to full input objects
  const inputs = legacyRequest.suggestedInputs.map(inputName => ({
    name: inputName,
    type: "string" as const, // Default to string type
    description: `Input: ${inputName}`,
    required: true
  }));
  
  return {
    // Use the new field names with the legacy values
    name: legacyRequest.toolName,
    description: legacyRequest.toolDescription,
    inputs,
    expectedOutput: legacyRequest.suggestedOutputs.join(", "),
    
    // Keep the legacy fields for backward compatibility
    toolName: legacyRequest.toolName,
    toolDescription: legacyRequest.toolDescription,
    suggestedInputs: legacyRequest.suggestedInputs,
    suggestedOutputs: legacyRequest.suggestedOutputs
  };
}

/**
 * Adapter to ensure a tool request is in the unified format
 * Use this when you're not sure if you're getting a legacy or unified format
 */
export async function ensureUnifiedToolRequest(request: any): Promise<ToolRequest> {
  // If it's already in the new format (has 'name' property)
  if (request.name && Array.isArray(request.inputs)) {
    // It's already in the new format or close to it
    return {
      ...request,
      // Ensure these are defined if they weren't
      purpose: request.purpose || request.description,
      expectedOutput: request.expectedOutput || 
        (Array.isArray(request.suggestedOutputs) ? request.suggestedOutputs.join(", ") : "Output value")
    };
  }
  
  // If it's in the legacy format (has 'toolName' property)
  if (request.toolName && Array.isArray(request.suggestedInputs)) {
    return await adaptLegacyToolRequest(request);
  }
  
  // If it's in neither format, try to make the best of what we have
  logger.warn("Unknown tool request format", { request });
  
  const name = request.name || request.toolName || "unnamed_tool";
  const description = request.description || request.toolDescription || "No description provided";
  
  return {
    name,
    description,
    inputs: Array.isArray(request.inputs) ? request.inputs : 
      (Array.isArray(request.suggestedInputs) ? 
        request.suggestedInputs.map((input: string) => ({
          name: input,
          type: "string" as const,
          description: `Input: ${input}`,
          required: true
        })) : 
        []),
    expectedOutput: request.expectedOutput || 
      (Array.isArray(request.suggestedOutputs) ? request.suggestedOutputs.join(", ") : "Output value"),
    purpose: request.purpose || description
  };
} 