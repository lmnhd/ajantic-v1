import { tool } from "ai";
import { z } from "zod";
import { PERPLEXITY_getResponse } from "./perplexity";
import { logger } from "@/src/lib/logger";

export const AGENT_TOOLS_perplexity2 = () => {
    return {
        PERPLEXITY_Basic: tool({
            description: "cost efficient model designed to retrieve and synthesize information efficiently.",
            parameters: z.object({
                query: z.string().describe("The query to search Perplexity with"),
            }),
            execute: async ({ query }) => {
                try {
                    logger.tool("PERPLEXITY_Basic", { query });
                    const result = await PERPLEXITY_getResponse(query, "sonar");
                    logger.tool("PERPLEXITY_Basic", { result });
                    return result;
                } catch (error) {
                    logger.error("PERPLEXITY_Basic", { error });
                    return `{"There was an error with the perplexity basic model": "Error: ${error}"}`;
                }
            }
        }),
        PERPLEXITY_Advanced: tool({
            description: "Advanced search offering with grounding, supporting complex queries and follow-ups.",
            parameters: z.object({
                query: z.string().describe("The query to search Perplexity with"),
            }),
            execute: async ({ query }) => {
                try {
                    logger.tool("PERPLEXITY_Advanced", { query });
                    const result = await PERPLEXITY_getResponse(query, "sonar-pro");
                    logger.tool("PERPLEXITY_Advanced", { result });
                    return result;
                } catch (error) {
                    logger.error("PERPLEXITY_Advanced", { error });
                    return `{"There was an error with the perplexity advanced model": "Error: ${error}"}`;
                }
            }
        }),
        PERPLEXITY_DeepResearch: tool({
            description: "Expert-level research model conducting exhaustive searches and generating comprehensive reports.",
            parameters: z.object({
                query: z.string().describe("The query to search Perplexity with"),
            }),
            execute: async ({ query }) => {
                try {
                    logger.tool("PERPLEXITY_DeepResearch", { query });
                    const result = await PERPLEXITY_getResponse(query, "sonar-deep-research");
                    logger.tool("PERPLEXITY_DeepResearch", { result });
                    return result;
                } catch (error) {
                    logger.error("PERPLEXITY_DeepResearch", { error });
                    return `{"There was an error with the perplexity deep research model": "Error: ${error}"}`;
                }
            }
        }),
        PERPLEXITY_Reasoning: tool({
            description: "Fast, real-time reasoning model designed for quick problem-solving with search.",
            parameters: z.object({
                query: z.string().describe("The query to search Perplexity with"),
            }),
            execute: async ({ query }) => {
                try {
                    logger.tool("PERPLEXITY_Reasoning", { query });
                    const result = await PERPLEXITY_getResponse(query, "sonar-reasoning");
                    logger.tool("PERPLEXITY_Reasoning", { result });
                    return result;
                } catch (error) {
                    logger.error("PERPLEXITY_Reasoning", { error });
                    return `{"There was an error with the perplexity reasoning model": "Error: ${error}"}`;
                }
            }
        }),
        PERPLEXITY_Reasoning_Advanced: tool({
            description: "Premier reasoning offering powered by DeepSeek R1 with Chain of Thought (CoT).",
            parameters: z.object({
                query: z.string().describe("The query to search Perplexity with"),
            }),
            execute: async ({ query }) => {
                try {
                    logger.tool("PERPLEXITY_Reasoning_Advanced", { query });
                    const result = await PERPLEXITY_getResponse(query, "sonar-reasoning-pro");
                    logger.tool("PERPLEXITY_Reasoning_Advanced", { result });
                    return result;
                } catch (error) {
                    logger.error("PERPLEXITY_Reasoning_Advanced", { error });
                    return `{"There was an error with the perplexity reasoning advanced model": "Error: ${error}"}`;
                }
            }
        }),
        PERPLEXITY_R1: tool({
            description: "A version of DeepSeek R1 post-trained for uncensored, unbiased, and factual information.",
            parameters: z.object({
                query: z.string().describe("The query to search Perplexity with"),
            }),
            execute: async ({ query }) => {
                try {
                    logger.tool("PERPLEXITY_R1", { query });
                    const result = await PERPLEXITY_getResponse(query, "r1-1776");
                    logger.tool("PERPLEXITY_R1", { result });
                    return result;
                } catch (error) {
                    logger.error("PERPLEXITY_R1", { error });
                    return `{"There was an error with the perplexity r1 model": "Error: ${error}"}`;
                }
            }
        })
    }
}

export const AGENT_TOOLS_DIRECTIVE_PERPLEXITY = () => {
    return `
    <INSTRUCTIONS>
     Use for realtime, up-to-date, accurate answers.
    </INSTRUCTIONS>
    <PERPLEXITY-TOOL>
        <BASIC-SEARCH>
            Designed to retrieve and synthesize information efficiently.
        </BASIC-SEARCH>
        <ADVANCED-SEARCH>
            Offering with grounding, supporting complex queries and follow-ups.
        </ADVANCED-SEARCH>
        <DEEP-RESEARCH>
            Expert-level research model conducting exhaustive searches and generating comprehensive reports.
        </DEEP-RESEARCH>
        <REASONING>
            Fast, real-time reasoning model designed for quick problem-solving with search.
        </REASONING>
        <REASONING-ADVANCED>
            Premier reasoning offering powered by DeepSeek R1 with Chain of Thought (CoT).
        </REASONING-ADVANCED>
        <R1>
            A version of DeepSeek R1 post-trained for uncensored, unbiased, and factual information.
        </R1>
        
    </PERPLEXITY-TOOL>
    `;
  };