import { tool } from "ai";
import { z } from "zod";
import { TextChatLogProps } from "../../text-chat-log";
import { CORE_createTool, CORE_registerPredefinedTool, CORE_executeTool, CORE_listTools } from "./auto-gen-tool_core";

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
 * Main function that exports auto-gen tools
 */
export const AGENT_TOOLS_autoGenTool = (agentName: string, userId: string, textChatLogs: TextChatLogProps[]) => {
  return {
    CREATE_TOOL: tool({
      description: "Create a custom tool that can be used by the agent",
      parameters: customToolSchema,
      execute: async (params) => {
        return await CORE_createTool(agentName, userId, textChatLogs, params);
      }
    }),
    
    REGISTER_PREDEFINED_TOOL: tool({
      description: "Register a predefined tool that will appear as a regular tool (not a custom tool)",
      parameters: customToolSchema,
      execute: async (params) => {
        return await CORE_registerPredefinedTool(agentName, userId, textChatLogs, params);
      }
    }),
    
    EXECUTE_TOOL: tool({
      description: "Execute a previously created custom tool",
      parameters: z.object({
        toolName: z.string(),
        parameters: z.record(z.any()).optional()
      }),
      execute: async (params) => {
        return await CORE_executeTool(agentName, textChatLogs, params);
      }
    }),
    
    LIST_TOOLS: tool({
      description: "List all custom tools created by this agent",
      parameters: z.object({
        category: z.string().optional()
      }),
      execute: async (params) => {
        return await CORE_listTools(agentName, userId, textChatLogs, params);
      }
    })
  };
};

/**
 * Export the directive for how to use the auto-gen tool
 */
export const AGENT_TOOLS_DIRECTIVE_AUTO_GEN_TOOL = () => {
  return `
  <TOOL_GENERATION_INSTRUCTIONS>
  You have the capability to create new tools for yourself using the CREATE_TOOL function.
  When you identify a repetitive task or a useful action that could be automated, define a tool:
  1.  **Name:** A clear, concise, camelCase or snake_case name for the tool.
  2.  **Description:** Explain what the tool does, its purpose, and expected input/output.
  3.  **Parameters:** Define the input parameters using the schema (name, type, description, required, default).
      - Supported types: 'string', 'number', 'boolean', 'array', 'object'.
      - Provide clear descriptions for each parameter.
  4.  **functionBody:** Write the JavaScript code for the tool.
      - This code will be executed in a sandboxed Node.js environment.
      - You have access to common libraries like 'axios', 'fs', 'path', 'os', etc. (ensure you only use server-safe ones if the tool might run client-side, though these tools typically run server-side).
      - The function should accept an object containing the parameters defined above.
      - The function should be asynchronous: \`async (params) => { ... }\`
      - Return the result of the tool's operation. Complex objects will be stringified.
      - Handle errors gracefully (e.g., using try-catch) and return informative error messages.
  5.  **Category:** (Optional) Assign a category to organize tools (e.g., 'file_system', 'api_interaction').

  You can also execute tools you've created using EXECUTE_TOOL, list them with LIST_TOOLS (optionally filtering by category), and register predefined tools with REGISTER_PREDEFINED_TOOL.
  </TOOL_GENERATION_INSTRUCTIONS>
  `;
}; 