"use server";

import { createToolFromRequest, createToolsFromRequests } from "./tool-generator-service";
import { ToolRequest } from "@/src/lib/types";

/**
 * Example of how to use the tool generator service in a team auto-generation process
 */
async function exampleTeamAutoGenUsage(agentName: string, userId: string) {
  // Example of a simple tool request
  const simpleToolRequest: ToolRequest = {
    name: "extractEmailAddresses",
    description: "Extracts email addresses from a given text",
    purpose: "Parse text content to identify and extract valid email addresses",
    inputs: [
      {
        name: "text",
        type: "string",
        description: "The text content to search for email addresses",
        required: true
      },
      {
        name: "validateFormat",
        type: "boolean",
        description: "Whether to validate the format of found emails",
        required: false,
        default: true
      }
    ],
    expectedOutput: "An array of valid email addresses found in the text, or an empty array if none found",
    examples: [
      {
        input: {
          text: "Contact us at support@example.com or sales@example.com for more information.",
          validateFormat: true
        },
        output: ["support@example.com", "sales@example.com"]
      }
    ]
  };

  // Example of multiple tool requests for a data processing agent
  const dataProcessingTools: ToolRequest[] = [
    {
      name: "validateJsonSchema",
      description: "Validates JSON data against a specified schema",
      purpose: "Ensure that JSON data conforms to a required structure before processing",
      inputs: [
        {
          name: "jsonData",
          type: "object",
          description: "The JSON data to validate",
          required: true
        },
        {
          name: "schema",
          type: "object",
          description: "The schema to validate against",
          required: true
        }
      ],
      expectedOutput: "An object with 'valid' boolean and 'errors' array if invalid",
      examples: [
        {
          input: {
            jsonData: { name: "John", age: 30 },
            schema: { 
              type: "object", 
              required: ["name", "age"], 
              properties: { 
                name: { type: "string" }, 
                age: { type: "number" } 
              } 
            }
          },
          output: { valid: true, errors: [] }
        }
      ]
    },
    {
      name: "formatCsvData",
      description: "Formats raw CSV data with headers and options",
      purpose: "Convert data into correctly formatted CSV with proper escaping and formatting",
      inputs: [
        {
          name: "data",
          type: "array",
          description: "Array of objects representing rows of data",
          required: true
        },
        {
          name: "headers",
          type: "array",
          description: "Array of column headers (optional, will use object keys if not provided)",
          required: false
        },
        {
          name: "delimiter",
          type: "string",
          description: "The delimiter to use between values",
          required: false,
          default: ","
        }
      ],
      expectedOutput: "A properly formatted CSV string with headers",
      additionalContext: "The tool should handle special characters in the data, including commas and quotes within values."
    }
  ];

  try {
    // Example 1: Create a single tool
    console.log("Creating a single tool...");
    const singleTool = await createToolFromRequest(simpleToolRequest, agentName, userId);
    console.log(`Created '${simpleToolRequest.name}' tool`);

    // Example 2: Create multiple tools for a data processing agent
    console.log("Creating multiple data processing tools...");
    const dataTools = await createToolsFromRequests(dataProcessingTools, agentName, userId);
    console.log(`Created ${dataProcessingTools.length} data processing tools`);

    // In a real team auto-gen process, you would combine these with other tools
    const allTools = {
      ...singleTool,
      ...dataTools,
      // ...standardTools,
      // ...otherDynamicTools
    };

    return allTools;
  } catch (error) {
    console.error("Error in tool generation:", error);
    throw error;
  }
}

/**
 * Example integration with team auto-generation process
 */
export async function integrateWithTeamAutoGen(
  teamConfig: any,
  agentName: string,
  userId: string
) {
  // Extract tool requests from team configuration
  const toolRequests: ToolRequest[] = teamConfig.toolRequests || [];
  
  // Generate and load all requested tools
  const generatedTools = await createToolsFromRequests(toolRequests, agentName, userId);
  
  // Here you would continue with the team auto-gen process,
  // adding these tools to the agent's configuration
  
  return {
    generatedTools,
    // Other team configuration...
  };
} 