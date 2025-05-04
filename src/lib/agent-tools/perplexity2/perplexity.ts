"use server";
import { OpenAI } from "openai";

import z from "zod";


// Define an enum for Perplexity model types
const PerplexityModelEnum = z.enum([
  "sonar",           // Basic model for general queries
  "sonar-pro",       // Enhanced model for more detailed responses
  "sonar-deep-research", // For in-depth analysis and detailed reports
  "sonar-reasoning", // Fast, real-time reasoning model designed for quick problem-solving with search.
  "sonar-reasoning-pro",  // For complex, multi-step reasoning tasks
  "r1-1776" // DeepSeek R1 model
]);

// Type for TypeScript
export type PerplexityModel = z.infer<typeof PerplexityModelEnum>;

export const PERPLEXITY_getResponse = async (question: string, modelName: PerplexityModel) => {
  const perplexity = new OpenAI({
    apiKey: process.env.PERPLEXITY_API_KEY,
    baseURL: "https://api.perplexity.ai",
  });
  
  const response = await perplexity.chat.completions.create({
    model: modelName,
    messages: [{ role: "user", content: question }],
  });
  return response.choices[0].message.content;
};

// export const AGENT_TOOLS_perplexity = (textChatLogs: TextChatLogProps[]) => {
//   return {
//     perplexity: tool({
//       description: `
// <PERPLEXITY_TOOL>
//   <DESCRIPTION>Get realtime, up-to-date, accurate answers to questions using Perplexity AI</DESCRIPTION>
  
//   <MODELS>
//     <MODEL name="sonar" use-case="Basic information retrieval and synthesis">Best for simple factual queries and general information</MODEL>
//     <MODEL name="sonar-pro" use-case="Enhanced information retrieval">Best for more detailed responses and broader context understanding</MODEL>
//     <MODEL name="sonar-deep-research" use-case="In-depth analysis">Best for comprehensive research requiring detailed reports</MODEL>
//     <MODEL name="sonar-reasoning-pro" use-case="Complex reasoning">Best for multi-step reasoning tasks and complex problem solving</MODEL>
//   </MODELS>
  
//   <USAGE>
//     <GUIDELINE>Select the most appropriate model based on the complexity of your query</GUIDELINE>
//     <GUIDELINE>Provide clear, specific questions for best results</GUIDELINE>
//     <GUIDELINE>For time-sensitive topics, include relevant time frames in your question</GUIDELINE>
//   </USAGE>
// </PERPLEXITY_TOOL>`,
//       parameters: z.object({
//         question: z.string().describe("The question to ask Perplexity"),
//         modelName: PerplexityModelEnum.describe("The Perplexity model to use for this query")
//       }),
//       execute: async ({ question, modelName }) => {
//         logger.tool("Querying Perplexity AI", { 
//           action: "PERPLEXITY_QUERY",
//           question,
//           model: modelName
//         });

//         textChatLogs.push({
//           role: "function",
//           message: `Asking Perplexity (model: ${modelName}): ${question}`,
//           agentName: "PERPLEXITY_ask",
//           timestamp: new Date(),
//         });

//         try {
//           const response = await PERPLEXITY_getResponse(question, modelName);
//           logger.tool("Received response from Perplexity", { 
//             action: "PERPLEXITY_RESPONSE",
//             responseLength: response?.length || 0,
//             model: modelName
//           });
//           return response || "No response from Perplexity. This could be due to a temporary outage or a problem with your Perplexity API key.";
//         } catch (error) {
//           logger.error("Failed to get response from Perplexity", {
//             action: "PERPLEXITY_ERROR",
//             error: error instanceof Error ? error.message : String(error),
//             question,
//             model: modelName,
//           });
//           return `There was an error with your Perplexity request. Please try again. Error: ${error instanceof Error ? error.message : String(error)}`;
//         }
//       },
//     }),
//   };
// };




