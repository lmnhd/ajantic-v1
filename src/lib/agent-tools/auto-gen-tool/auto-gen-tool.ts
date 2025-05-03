import { tool } from "ai";
import { z } from "zod";
import { TextChatLogProps } from "../../text-chat-log";
import {
  CORE_createTool, // Keep for now, but marked deprecated
  CORE_executeTool,
  CORE_listTools,
  // CORE_createToolFromRequest // Not directly exposed as an agent tool, called internally
} from "./auto-gen-tool_core";
import { getCustomToolId, isCustomToolReference } from "../tool-registry/custom-tool-ref";
import { ToolRegistry } from "../tool-registry/registry";
import { ToolFactory } from "../tool-registry/factory";
import { logger } from "@/src/lib/logger";

// Schema for the tool parameters
const toolParameterSchema = z.array(z.object({
  name: z.string(),
  type: z.enum(["string", "number", "boolean", "array", "object"]),
  description: z.string(),
  required: z.boolean().optional(),
  default: z.any().optional()
}));

// Schema for creating a custom tool
const customToolSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: toolParameterSchema,
  functionBody: z.string(),
  category: z.string().optional()
});

/**
 * Main function that exports auto-gen tools, now scoped by user ID.
 */
export const AGENT_TOOLS_autoGenTool = (
    // removed agentName
    userId: string,
    textChatLogs: TextChatLogProps[] | null // Allow null for logs
) => {
  if (!userId) {
      // Prevent initialization if userId is missing
      logger.error("AGENT_TOOLS_autoGenTool initialized without userId.");
      // Depending on strictness, you could throw an error or return an empty object
      // throw new Error("Cannot initialize auto-gen tools without a user ID.");
      return {}; // Return empty object to avoid runtime errors if used without userId
  }

  return {
    /**
     * @deprecated Use AI capabilities to request tool generation via natural language,
     * which should internally call CORE_createToolFromRequest or similar logic.
     * This tool directly exposes CORE_createTool.
     */
    CREATE_TOOL: tool({
      description: "DEPRECATED: Use natural language to request tool creation. Creates a custom tool directly from parameters.",
      parameters: customToolSchema,
      execute: async (params) => {
        // Pass userId instead of agentName
        return await CORE_createTool(userId, textChatLogs, params);
      }
    }),

    /**
     * Registers a tool definition provided directly by the user or agent,
     * without AI generation/refinement involved.
     */
    REGISTER_PREDEFINED_TOOL: tool({
      description: "Register a predefined tool (code/implementation is provided directly).",
      parameters: customToolSchema, // Re-use schema for structure
      execute: async (params) => {
        try {
          const paramsValidation = toolParameterSchema.safeParse(params.parameters);
          if (!paramsValidation.success) {
              return { success: false, message: `Invalid parameters structure: ${paramsValidation.error.message}`};
          }

          // Prepare generic metadata, removing agentId
          const metadata = {
              // agentId: agentName, // REMOVED
              userId: userId, // Keep for reference
              source: "predefined-registered",
              createdAt: new Date().toISOString(),
              category: params.category,
          };

          // Register directly using userId
          const toolRef = await ToolRegistry.registerTool(
            userId, // Pass userId directly
            params.name,
            params.description,
            paramsValidation.data,
            params.functionBody,
            "function",
            metadata // Pass generic metadata
          );

          const toolId = getCustomToolId(toolRef);
          logger.tool("Registered predefined tool via agent tool", {
            toolRef, toolId, toolName: params.name, userId
          });

          return {
            success: true,
            toolRef: toolRef,
            toolId: toolId,
            message: `Predefined tool ${params.name} registered successfully with ID ${toolId}.`
          };

        } catch (error: any) {
          logger.error("Error registering predefined tool via agent tool", {
            error: error.message || "Unknown error", toolName: params.name, userId
          });
           if (error instanceof Error && error.message.includes("already exists for this user")) {
                return { success: false, message: error.message };
            }
          return {
            success: false,
            message: `Error registering predefined tool: ${error.message || "Unknown error"}`
          };
        }
      }
    }),

    /**
     * Executes a previously created custom tool owned by the current user.
     */
    EXECUTE_TOOL: tool({
      description: "Execute a previously created custom tool owned by the user.",
      parameters: z.object({
        toolRef: z.string().describe("The tool reference (CUSTOM_TOOL:id)"), // Only refs now
        parameters: z.record(z.any()).optional().describe("Arguments for the tool execution"),
      }),
      execute: async (params) => {
        // Ensure it's a custom tool reference before calling CORE_executeTool
        if (!isCustomToolReference(params.toolRef)) {
             return { success: false, error: `Invalid reference format: ${params.toolRef}. Must be 'CUSTOM_TOOL:id'.`};
        }
        // Call the refactored CORE_executeTool (which no longer needs agentName)
        const result = await CORE_executeTool(textChatLogs, {
          toolRef: params.toolRef,
          toolArgs: params.parameters
        });
        // CORE_executeTool now returns an object, return it directly
        return result;
      }
    }),

    /**
     * Lists all custom tools owned by the current user.
     */
    LIST_TOOLS: tool({
      description: "List all custom tools owned by the current user.",
      parameters: z.object({
        category: z.string().optional().describe("Optional category to filter by"),
      }),
      execute: async (params) => {
        // Call the refactored CORE_listTools, passing only userId
        const resultString = await CORE_listTools(userId, textChatLogs, params);
        try {
            // Parse the result string from CORE_listTools back into an object
            return JSON.parse(resultString);
        } catch (e) {
            logger.error("Failed to parse result from CORE_listTools", { resultString, error: e });
            return { success: false, error: "Failed to retrieve or parse tool list." };
        }
      }
    }),

    // --- Consider adding DELETE_TOOL ---
    DELETE_TOOL: tool({
        description: "Deletes a specific custom tool owned by the user.",
        parameters: z.object({
            toolRef: z.string().describe("The tool reference (CUSTOM_TOOL:id) of the tool to delete."),
        }),
        execute: async (params) => {
            if (!isCustomToolReference(params.toolRef)) {
                return { success: false, error: `Invalid reference format: ${params.toolRef}. Must be 'CUSTOM_TOOL:id'.`};
            }
            const toolId = getCustomToolId(params.toolRef);
            if (!toolId) {
                 return { success: false, error: `Could not extract ID from reference: ${params.toolRef}.`};
            }
            try {
                const success = await ToolRegistry.deleteTool(toolId, userId);
                if (success) {
                    logger.tool("Deleted custom tool via agent tool", { toolId, userId });
                    return { success: true, message: `Tool ${params.toolRef} deleted successfully.` };
                } else {
                    // deleteTool might return false if tool not found, handle it
                     logger.warn("Attempt to delete tool failed (possibly not found)", { toolId, userId });
                    return { success: false, message: `Tool ${params.toolRef} could not be deleted (may not exist).` };
                }
            } catch (error: any) {
                logger.error("Error deleting tool via agent tool", { toolId, userId, error: error.message });
                 // Handle specific errors like unauthorized if implemented in deleteTool
                if (error instanceof Error && error.message.startsWith("Unauthorized")) {
                     return { success: false, message: error.message };
                }
                return { success: false, message: `Error deleting tool ${params.toolRef}: ${error.message || "Unknown error"}`};
            }
        }
    })

  };
};

/**
 * Export the directive for how to use the auto-gen tool
 * Updated to remove agent-specific language.
 */
export const AGENT_TOOLS_DIRECTIVE_AUTO_GEN_TOOL = () => {
  return `
  <TOOL_GENERATION_INSTRUCTIONS>
  You have the capability to create new tools for yourself (scoped to your user account) using AI or by providing the definition directly.

  **Requesting AI Generation:**
  Describe the tool you need (name, purpose, inputs, expected output) in natural language. The system will attempt to generate and register it using AI.

  **Registering Predefined Tools (REGISTER_PREDEFINED_TOOL):**
  If you have the complete definition, use REGISTER_PREDEFINED_TOOL:
  1.  **name:** A clear, concise, unique (per user) camelCase or snake_case name.
  2.  **description:** Explain what the tool does.
  3.  **parameters:** Define input parameters (name, type ['string', 'number', 'boolean', 'array', 'object'], description, required, default).
  4.  **functionBody:** Provide the complete, standalone asynchronous JavaScript function body (\`async (params) => { ... }\`).
      - Use standard Node.js modules sparingly. Avoid external libraries unless essential.
      - Handle errors gracefully (try/catch) and return informative results or errors.
      - Ensure the function accepts a single object argument containing the parameters.
  5.  **category:** (Optional) Assign a category (e.g., 'text_manipulation', 'api_call').

  **Using Tools:**
  - **EXECUTE_TOOL:** Execute a tool using its reference ('CUSTOM_TOOL:id') and provide necessary parameters.
  - **LIST_TOOLS:** List all custom tools available to you (optionally filter by category).
  - **DELETE_TOOL:** Delete a tool using its reference ('CUSTOM_TOOL:id').
  </TOOL_GENERATION_INSTRUCTIONS>
  `;
}; 