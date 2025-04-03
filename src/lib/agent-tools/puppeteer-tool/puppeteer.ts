import { tool } from "ai";
import { z } from "zod";
import { TextChatLogProps } from "@/src/lib/text-chat-log";
import { MemoryVectorStore } from "langchain/vectorstores/memory"; // Keep if type is needed client-side
import {
    CORE_navigate,
    CORE_interact,
    CORE_extract,
    CORE_query,
    TOOLFUNCTION_puppeteer
} from "@/src/lib/agent-tools/puppeteer-tool/puppeteer_core"; // Import CORE functions from future core file
import { TOOLFUNCTION_queryHTML } from "../parsers/html-vectorstore";
import { AGENT_TOOLS_EMULATOR } from "../../types";

// Schema definitions (client-safe)
const navigateParams = z.object({
  url: z.string().url().describe("The URL to navigate to."),
});

const interactParams = z.object({
  action: z.enum(["click", "type", "select", "focus", "goBack", "goForward", "reload"])
           .describe("The interaction action to perform."),
  selector: z.string().optional().describe("CSS selector for the target element (required for click, type, select, focus)."),
  value: z.string().optional().describe("Value to type or select (required for type, select)."),
});

const extractParams = z.object({
    mode: z.enum(["text", "html"]).default("text").describe("Extraction mode: 'text' for clean text, 'html' for raw HTML."),
    selector: z.string().optional().describe("Optional CSS selector to extract content from a specific element."),
});

const queryParams = z.object({
    query: z.string().describe("The question to ask about the current page content."),
    selector: z.string().optional().describe("Optional CSS selector to focus the query on a specific part of the page."),
});


export const AGENT_TOOLS_puppeteer = (
  browserBaseOrLocal: "browserbase" | "local",
  vc: MemoryVectorStore, // Pass vector store if needed by CORE functions
  textChatLogs: TextChatLogProps[]
) => {
  // Shared execution wrapper (optional, can put logic directly in each execute)
  const executeCore = async (coreFunction: Function, params: any) => {
    try {
        // Pass necessary context like browserBaseOrLocal, vc to core function
        const resultString = await coreFunction(params, browserBaseOrLocal, vc, textChatLogs);
        // Simple check if result is JSON and indicates error
        try {
            const parsed = JSON.parse(resultString);
            if (parsed && parsed.success === false) {
                // Log or handle specific error from core
            }
        } catch { /* Not JSON or not error structure */ }
        return resultString;
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown Puppeteer tool error";
        // Log error
        return JSON.stringify({ success: false, error: errorMsg });
    }
  };

  return {
    PUPPETEER_navigate: tool({
      description: "Navigates the browser to a specified URL.",
      parameters: navigateParams,
      execute: async (params) => executeCore(CORE_navigate, params)
    }),
    PUPPETEER_interact: tool({
      description: "Performs an interaction on the current page (click, type, select, focus, goBack, goForward, reload).",
      parameters: interactParams,
      execute: async (params) => executeCore(CORE_interact, params)
    }),
    PUPPETEER_extract: tool({
      description: "Extracts content (text or HTML) from the current page, optionally from a specific element.",
      parameters: extractParams,
      execute: async (params) => executeCore(CORE_extract, params)
    }),
    PUPPETEER_query: tool({
        description: "Answers a question about the content of the current page, optionally focusing on a specific element.",
        parameters: queryParams,
        execute: async (params) => executeCore(CORE_query, params)
    }),
  };
}; 

export const AGENT_TOOLS_EMULATOR_browserbase = (
  browserBaseOrLocal: "browserbase" | "local",
  vc: MemoryVectorStore
): AGENT_TOOLS_EMULATOR[] => {
  return [
    {
      name: "puppeteer",
      description: "Use puppeteer to navigate the web through automation",
      parameters: [
        {
          name: "url",
          type: "string",
          description: "The URL to navigate to",
        },
        {
          name: "action",
          type: "string",
          description:
            "The action to perform (e.g. page.goto, page.content, page.click)",
        },
        {
          name: "mode",
          type: "string",
          description: "Return mode - 'html' or 'text'",
        },
        {
          name: "selector",
          type: "string",
          description: "CSS selector for elements to interact with",
        },
        {
          name: "value",
          type: "string",
          description: "Value to use for input actions",
        },
        {
          name: "waitForSelector",
          type: "number",
          description: "Time to wait for selector in milliseconds",
        },
      ],
      execute: async (parameters: Record<string, string>) => {
        return await TOOLFUNCTION_puppeteer(
          {
            url: parameters.url,
            action: parameters.action as any,
            mode: parameters.mode as "html" | "text",
            selector: parameters.selector,
            value: parameters.value,
            waitFor: Number(parameters.waitForSelector),
          },
          browserBaseOrLocal,
          vc
        );
      },
    },
    {
      name: "queryHTML",
      description: "Query the HTML content that was previously loaded",
      parameters: [
        {
          name: "query",
          type: "string",
          description: "The query to search for in the HTML content",
        },
      ],
      execute: async (parameters: Record<string, string>) => {
        return await TOOLFUNCTION_queryHTML(
          { query: parameters.query },
          vc
        );
      },
    },
  ];
};
