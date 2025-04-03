'use server';

import { DYNAMIC_ACTION_addTool, DYNAMIC_ACTION_execute, DYNAMIC_ACTION_getTools } from "./dynamic-action-core";
import { DynamicToolConfig } from "@/src/lib/types";
import { z } from "zod";

/**
 * Implementation of dynamic tools for the agent
 */
export class DynamicTools {
  constructor() {
    this.registerDefaultTools();
  }

  /**
   * Register default tools for the agent
   */
  private async registerDefaultTools() {
    // Example tool: Search the web
    const searchTool: DynamicToolConfig = {
      name: "search_web",
      description: "Search the web for information",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query",
          },
        },
        required: ["query"],
      },
      handler: async (args: { query: string }) => {
        // This would normally call a search API
        console.log(`Searching for: ${args.query}`);
        return {
          results: [
            { title: "Example result 1", url: "https://example.com/1" },
            { title: "Example result 2", url: "https://example.com/2" },
          ]
        };
      }
    };

    await DYNAMIC_ACTION_addTool(searchTool);
  }

  /**
   * Get all registered tools
   */
  async getTools() {
    return await DYNAMIC_ACTION_getTools();
  }

  /**
   * Execute a query with the dynamic tools
   */
  async executeQuery(prompt: string) {
    return await DYNAMIC_ACTION_execute(prompt);
  }
} 