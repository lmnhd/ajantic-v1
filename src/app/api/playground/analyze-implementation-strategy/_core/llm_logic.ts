import { ToolRequest, ToolInputParameter } from "@/src/lib/types"; // Changed import
import { ConsultationHistory } from "../_types"; // StrategyAnalysis not directly used here
import { logger } from "@/src/lib/logger";
import { generateObject } from 'ai';
import { MODEL_getModel_ai } from '@/src/lib/vercelAI-model-switcher';
import { UTILS_getModelArgsByName, MODEL_JSON } from '@/src/lib/utils';
import { z } from 'zod';

// Define the Zod schema for the expected LLM output, now including more fields from AnalysisResult
const llmStrategySuggestionSchema = z.object({
    recommendedType: z.enum(["api", "function"]).describe("Recommended implementation type."),
    reasoning: z.string().describe("Detailed explanation of the recommended strategy."),
    warnings: z.array(z.string()).optional().describe("List potential issues or warnings."),
    requiredCredentialName: z.string().optional().nullable().describe("Credential name if API needs auth."),
    // Add missing fields to match how it's used in analysis_logic.ts (make them optional)
    confidence: z.enum(["high", "medium", "low"]).optional().describe("Confidence level in the recommendation."),
    strategyTitle: z.string().optional().describe("A concise title for the suggested strategy."),
    potentialIssues: z.array(z.string()).optional().describe("Synonym for warnings, specific issues to look out for."),
    exampleUsage: z.string().optional().describe("A brief example of how the tool might be used if implemented as suggested.")
});

// Type for the structured response from the LLM
type LLMStrategySuggestion = z.infer<typeof llmStrategySuggestionSchema>;

export async function LLM_generateStrategySuggestion(
  toolRequest: ToolRequest, // Changed type to ToolRequest
  preliminaryFindings: string,
  newStrategyModifications: string[],
  consultationHistory: ConsultationHistory,
  
): Promise<LLMStrategySuggestion> {
  logger.info("LLM_logic: Generating strategy suggestion...", { toolName: toolRequest.name });

  const historySummary = ""; // Placeholder for actual summarization logic if needed
  const parametersString = toolRequest.inputs.length > 0
    ? toolRequest.inputs.map((p: ToolInputParameter) => `- ${p.name} (${p.type}): ${p.description}${p.required === false ? ' (optional)' : ''}`).join('\n') // Typed p
    : '  (No input parameters defined)';

  const systemPrompt = `
You are an expert Software Implementation Consultant. Your task is to analyze a tool request and recommend the most viable implementation strategy: using an existing API ('api') or writing a custom function ('function').

<tool_request>
Name: ${toolRequest.name}
Description: ${toolRequest.description}
Purpose: ${toolRequest.purpose || toolRequest.description}
Inputs:
${parametersString}
Expected Output: ${toolRequest.expectedOutput}
Additional Context: ${toolRequest.additionalContext || 'None'}
</tool_request>

<preliminary_research_findings>
${preliminaryFindings}
</preliminary_research_findings>

<consultation_history_summary>
${historySummary}
</consultation_history_summary>

<user_refinement_requests>
${newStrategyModifications.length > 0 ? newStrategyModifications.map(m => `- ${m}`).join('\n') : 'None'}
</user_refinement_requests>

<instructions>
1.  **Analyze Feasibility:** Determine the best strategy ('api' or 'function'). Prioritize APIs if suitable.
2.  **Provide Strategy Details:** Explain your recommendation.
3.  **Identify Credentials:** If 'api', suggest credential name (e.g., 'SERVICE_API_KEY').
4.  **List Warnings:** Mention potential blockers or difficulties.
5.  **Output Format:** Respond ONLY with a valid JSON object matching the schema.
</instructions>

<output_schema>
${JSON.stringify(llmStrategySuggestionSchema.shape, null, 2)} 
</output_schema>
Generate ONLY the JSON object.`;

  // Determine ModelArgs (simplified, adapt from your analysis_logic)
  const modelArgs = UTILS_getModelArgsByName(MODEL_JSON().OpenAI['gpt-4.5-preview']?.name ?? "openai:gpt-4.5-preview");
  const model = await MODEL_getModel_ai(modelArgs);

  try {
    logger.debug("LLM_logic: Calling generateObject for strategy suggestion", { model: modelArgs.modelName });
    const { object } = await generateObject({
         model: model,
         schema: llmStrategySuggestionSchema,
         prompt: systemPrompt,
         temperature: modelArgs.temperature ?? 0.5,
    });
    
    if (!object || !object.recommendedType) {
         throw new Error("LLM failed to return a valid strategy suggestion structure.");
    }
    logger.info("LLM_logic: Strategy suggestion successful", { type: object.recommendedType });
    return object as LLMStrategySuggestion;

  } catch (error) {
    logger.error("LLM_logic: generateObject failed", { error: error instanceof Error ? error.message : String(error) });
    return {
         recommendedType: "function",
         reasoning: `Failed to get strategy suggestion from LLM: ${error instanceof Error ? error.message : String(error)}`,
         warnings: ["LLM strategy suggestion failed."],
         requiredCredentialName: undefined
     };
  }
}
