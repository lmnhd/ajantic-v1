import { AI_Agent_Tools } from "@/src/lib/types";

/**
 * Creates a custom tool reference in the format "CUSTOM_TOOL:toolId"
 * @param toolId The ID of the custom tool in the registry
 * @returns A string reference to the custom tool
 */
export function createCustomToolReference(toolId: string): string {
  return `${AI_Agent_Tools.CUSTOM_TOOL}:${toolId}`;
}

/**
 * Checks if a tool name represents a custom tool
 * @param toolName The tool name or reference to check
 * @returns True if this is a custom tool reference
 */
export function isCustomToolReference(toolName: string | AI_Agent_Tools): boolean {
  return typeof toolName === "string" && 
         toolName.startsWith(`${AI_Agent_Tools.CUSTOM_TOOL}:`);
}

/**
 * Extracts the custom tool ID from a reference
 * @param toolRef The custom tool reference
 * @returns The extracted tool ID
 */
export function getCustomToolId(toolRef: string): string {
  if (!isCustomToolReference(toolRef)) {
    throw new Error(`Not a valid custom tool reference: ${toolRef}`);
  }
  return toolRef.split(':')[1];
} 