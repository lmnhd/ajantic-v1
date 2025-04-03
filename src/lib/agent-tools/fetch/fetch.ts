import { tool } from "ai";
import { z } from "zod";
import { TextChatLogProps } from "@/src/lib/text-chat-log"; // Adjusted path
import { logger } from '@/src/lib/logger';
import { TOOLFUNCTION_fetch } from "./fetch_core"; // Import core function

export const AGENT_TOOLS_fetch = (textChatLogs: TextChatLogProps[]) => {
  return {
    URL_fetch: tool({
      description:
        "Fetch the text content of a given URL. Returns the raw text content or an error message.",
      parameters: z.object({
        url: z.string().describe("The URL to fetch content from."),
        // Note: RequestInit is complex for AI. Keeping options minimal or abstracting further might be better.
        options: z.object({
          method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"])
                  .describe("The HTTP method.").optional().default("GET"),
          headers: z.record(z.string()).describe("Optional HTTP headers as key-value pairs.").optional(),
          // Body is complex to represent reliably with Zod for all cases (string, Buffer, FormData etc.)
          // Consider a separate tool or simplified approach if POSTing data is needed.
          body: z.string().describe("Optional request body (e.g., for POST requests).").optional(), 
        }).describe("Optional request options.").optional(),
      }),
      execute: async ({ url, options }) => {
        logger.tool("Fetch Tool - Execute Called", { 
          url,
          method: options?.method || 'GET',
          hasHeaders: !!options?.headers,
          hasBody: !!options?.body
        });

        // Prepare RequestInit options
        const requestOptions: RequestInit = {
          method: options?.method,
          headers: options?.headers,
          body: options?.body
        };
        // Filter out undefined values
        Object.keys(requestOptions).forEach(key => requestOptions[key as keyof RequestInit] === undefined && delete requestOptions[key as keyof RequestInit]);

        textChatLogs.push({
          role: "function",
          message: `Fetching URL: ${url} with method ${requestOptions.method || 'GET'}`,
          agentName: "URL_fetch", // Match tool name
          timestamp: new Date(),
        });

        try {
          // Call the server-side function
          const result = await TOOLFUNCTION_fetch(url, requestOptions);
          logger.tool("Fetch Tool - Core Function Result", {
            url,
            responseLength: result?.length ?? 0
          });
          
          textChatLogs.push({
            role: "function",
            message: `Fetch successful for ${url}. Content length: ${result?.length ?? 0}`,
            agentName: "URL_fetch",
            timestamp: new Date(),
          });
          return result || "No content received."; // Return result or placeholder
        } catch (error) {
          const errorMessage = (error as Error).message;
          logger.tool("Fetch Tool - Execute Error", {
            url,
            error: errorMessage
          });
          textChatLogs.push({
            role: "function",
            message: `Fetch failed for ${url}: ${errorMessage}`,
            agentName: "URL_fetch",
            timestamp: new Date(),
          });
          // Return a user-friendly error message
          return `Failed to fetch ${url}: ${errorMessage}`;
        }
      },
    }),
  };
}; 