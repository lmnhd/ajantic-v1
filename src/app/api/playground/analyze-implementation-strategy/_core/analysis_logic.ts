import { z } from "zod";
import { generateObject } from 'ai';
import { logger } from "@/src/lib/logger";
import { ToolRequest, ModelArgs, ModelProviderEnum } from "@/src/lib/types";
import { PERPLEXITY_getResponse } from '@/src/lib/agent-tools/perplexity2/perplexity';
import { AnalysisResult, ConsultationHistory } from "../_types";
import { MODEL_getModel_ai } from '@/src/lib/vercelAI-model-switcher';
import { UTILS_getModelArgsByName, UTILS_getModelsJSON, MODEL_JSON } from '@/src/lib/utils';
import { summarizeHistory, mapProviderStringToEnum } from './helpers'; // Import helpers

// Define the Zod schema for the expected LLM output (matching AnalysisResult type)
const analysisResultSchema = z.object({
    recommendedType: z.enum(["api", "function", "undetermined"]).describe("Recommended implementation type ('api' or 'function', or 'undetermined' if unsure)."),
    strategyDetails: z.string().describe("Detailed explanation of the recommended strategy. If 'api', include potential endpoint URL(s). If 'function', outline logic, suggest helpers (e.g., fetch, firecrawl, cheerio, visual scrape)."),
    warnings: z.array(z.string()).describe("List potential issues, blockers, or reasons why other types were ruled out (e.g., 'No public API found', 'Scraping likely blocked', 'JS rendering required')."),
    requiredCredentialName: z.string().optional().nullable().describe("If 'api' is recommended and needs authentication, specify the credential name needed (e.g., 'SERVICE_API_KEY', 'OAUTH_TOKEN'). Use null or omit if none needed.")
});


/**
 * Performs the core analysis using LLM and Perplexity research.
 */
export async function runAnalysisPhase(
    toolRequest: ToolRequest,
    history: ConsultationHistory,
    modifications: string[],
    previousRecordsSummary: string,
    modelArgsFromRequest?: {
        provider?: string;
        modelName?: string;
        temperature?: number;
        topP?: number;
        maxTokens?: number;
    } | null
): Promise<AnalysisResult> {
    logger.info("Analysis Logic: Running analysis phase...", { toolName: toolRequest.name, historyLength: history.length });

    // **** 1. Preliminary Perplexity Research ****
    let preliminaryFindings = "No preliminary research conducted.";
    try {
        logger.debug("Analysis Logic: Starting preliminary Perplexity research");
        const findings: string[] = [];
        // Extract potential service/URL (same logic as before)
        const serviceName = toolRequest.name.split('_')[0] || toolRequest.name;
        const targetUrlInput = toolRequest.inputs.find(inp => inp.name.toLowerCase().includes('url'));
        let targetUrl = targetUrlInput?.default as string || targetUrlInput?.description || toolRequest.purpose || toolRequest.description;
        if (!targetUrl?.startsWith('http')) {
             targetUrl = '';
        }

        // Query 1: API Docs check (run fairly broadly)
        const apiDocsQuery = `Existence and link for official developer API documentation for service related to '${serviceName}' or task '${toolRequest.description}'`;
        const apiDocsResult = await PERPLEXITY_getResponse(apiDocsQuery, "sonar");
        // Simple summary for prompt
        findings.push(`API Docs Check: ${apiDocsResult?.includes("http") ? 'Potential docs found.' : 'No obvious API docs found.'}`);
        logger.debug("Analysis Logic: Prelim API docs check result", { finding: findings[findings.length - 1] });


        // Query 2: Scraping difficulty (if it looks like a URL task)
        if (targetUrl) {
             const scrapingQuery = `Common scraping difficulties or bot protection mechanisms (like Cloudflare) for website ${targetUrl}`;
             const scrapingResult = await PERPLEXITY_getResponse(scrapingQuery, "sonar");
             // Simple summary
             findings.push(`Scraping Check (${targetUrl}): ${scrapingResult?.toLowerCase().includes('cloudflare') || scrapingResult?.toLowerCase().includes('difficult') ? 'Potential difficulties noted.' : 'No immediate blockers noted.'}`);
             logger.debug("Analysis Logic: Prelim scraping check result", { finding: findings[findings.length - 1] });
        }

        preliminaryFindings = findings.join(' | ');

    } catch (error) {
        logger.error("Analysis Logic: Error during preliminary Perplexity research", { error });
        preliminaryFindings = `Error during preliminary research: ${error instanceof Error ? error.message : String(error)}`;
    }

    // **** 2. Construct Prompt (Now includes preliminary findings AND previous records) ****
    const historySummary = summarizeHistory(history);
    const parametersString = toolRequest.inputs.length > 0
        ? toolRequest.inputs.map(p => `- ${p.name} (${p.type}): ${p.description}${p.required === false ? ' (optional)' : ''}`).join('\n')
        : '  (No input parameters defined)';

    const systemPrompt = `
You are an expert Software Implementation Consultant. Your task is to analyze a tool request and recommend the most viable implementation strategy: using an existing API ('api') or writing a custom function ('function'). Prioritize APIs if available and suitable. Base your recommendation on the tool's purpose, parameters, expected output, previous consultation history, and the user's latest refinement requests.

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

<previous_implementation_records>
${previousRecordsSummary}
</previous_implementation_records>

<consultation_history_summary>
${historySummary}
</consultation_history_summary>

<user_refinement_requests>
${modifications.length > 0 ? modifications.map(m => `- ${m}`).join('\n') : 'None'}
</user_refinement_requests>

<instructions>
1.  **Analyze Feasibility:** Based on the tool request, preliminary research, **past records**, history, determine the best strategy ('api' or 'function'). **Strongly consider the preliminary findings and past records.**
    *   API First: Prefer API if preliminary research, past records, or common knowledge suggests one exists.
    *   Function: Recommend 'function' for scraping (heed preliminary/past warnings), custom logic, etc.
    *   Undetermined: If still unclear.
2.  **Provide Strategy Details:** Explain your recommendation. For 'api', suggest endpoints or the type of API to look for. For 'function', outline the core logic steps and any required helper libraries/functions.
3.  **Identify Credentials:** If recommending 'api', specify the type of credential likely needed (e.g., 'API Key', 'OAuth Token') and formulate a generic credential name like 'SERVICE_API_KEY' or 'SERVICE_OAUTH_TOKEN' (replace SERVICE with the actual service name, e.g., CLICKBANK_API_KEY). Set to null/omit if no credentials seem required or type is 'function'.
4.  **List Warnings:** Mention potential blockers, difficulties (e.g., "No known public API", "Website uses heavy JS, recommend Firecrawl helper", "API requires paid plan"), or reasons for ruling out alternatives. **Include warnings from preliminary research AND relevant past records.**
5.  **Consider History & Modifications:** Adapt your recommendation based on previous rounds and the user's latest requests. If the user explicitly prefers one method, acknowledge it but still warn if it seems technically unviable.
6.  **Output Format:** Respond ONLY with a valid JSON object matching the required schema.
</instructions>

<output_schema>
${/* Use JSON.stringify on the schema definition itself if possible, or manually describe */ ''}
{
    "recommendedType": "'api' | 'function' | 'undetermined'",
    "strategyDetails": "string explanation",
    "warnings": ["string"],
    "requiredCredentialName": "string | null | undefined"
}
</output_schema>
Generate ONLY the JSON object containing the analysis result.
`;


    // **** 3. Determine ModelArgs ****
    let analysisModelArgs: ModelArgs;
    const defaultModelName = MODEL_JSON().OpenAI['gpt-4.5-preview']?.name ?? "openai:gpt-4.5-preview";
    try {
        if (modelArgsFromRequest?.modelName && modelArgsFromRequest?.provider) {
            const providerEnum = mapProviderStringToEnum(modelArgsFromRequest.provider);
            if (providerEnum) {
                try {
                    analysisModelArgs = UTILS_getModelArgsByName(modelArgsFromRequest.modelName);
                    if (modelArgsFromRequest.temperature !== undefined) analysisModelArgs.temperature = modelArgsFromRequest.temperature;
                    if (modelArgsFromRequest.topP !== undefined) analysisModelArgs.topP = modelArgsFromRequest.topP;
                    if (modelArgsFromRequest.maxTokens !== undefined) analysisModelArgs.maxOutputTokens = modelArgsFromRequest.maxTokens;
                } catch (modelLookupError) {
                    logger.warn(`Analysis Logic: Failed lookup for requested model '${modelArgsFromRequest.modelName}'. Falling back.`, { error: modelLookupError });
                    analysisModelArgs = UTILS_getModelArgsByName(defaultModelName);
                }
            } else {
                logger.warn(`Analysis Logic: Invalid provider '${modelArgsFromRequest.provider}'. Falling back.`);
                analysisModelArgs = UTILS_getModelArgsByName(defaultModelName);
            }
        } else {
            logger.info(`Analysis Logic: Using default model: ${defaultModelName}`);
            analysisModelArgs = UTILS_getModelArgsByName(defaultModelName);
        }
    } catch (e) {
        logger.error(`Analysis Logic: Critical failure getting model args. Using safest fallback.`, { error: e });
        analysisModelArgs = { provider: ModelProviderEnum.OPENAI, modelName: "openai:gpt-4o", temperature: 0.5 };
    }
    const model = await MODEL_getModel_ai(analysisModelArgs);


    // **** 4. Call LLM for Initial Analysis ****
    let initialAnalysisResult: AnalysisResult;
    try {
        logger.debug("Analysis Logic: Calling generateObject for initial analysis", { model: analysisModelArgs.modelName });
        const { object } = await generateObject({
             model: model,
             schema: analysisResultSchema,
             prompt: systemPrompt,
             temperature: analysisModelArgs.temperature ?? 0.5,
        });
        initialAnalysisResult = object as AnalysisResult;
         if (!initialAnalysisResult || !initialAnalysisResult.recommendedType) {
             throw new Error("LLM failed to return a valid initial analysis structure.");
         }
         logger.info("Analysis Logic: Initial LLM analysis successful", { type: initialAnalysisResult.recommendedType, cred: initialAnalysisResult.requiredCredentialName ?? 'None' });

    } catch (error) {
        logger.error("Analysis Logic: generateObject failed", {
             model: analysisModelArgs.modelName,
             error: error instanceof Error ? error.message : String(error),
        });
        initialAnalysisResult = {
             recommendedType: "undetermined",
             strategyDetails: `Failed to get analysis from LLM: ${error instanceof Error ? error.message : String(error)}`,
             warnings: ["LLM analysis failed."],
             requiredCredentialName: undefined
         };
    }

    // **** 5. Conditional Perplexity Research (Keep as placeholder for refinement) ****
    // This step might become less necessary or focus only on very specific follow-up
    // questions based on the LLM analysis *after* it saw the preliminary research.
    logger.info("Analysis Logic: Starting secondary Perplexity research phase (if needed)", { initialRecommendation: initialAnalysisResult.recommendedType });
    const secondaryFindings: string[] = [];
    try {
        if (initialAnalysisResult.recommendedType === 'api' && !initialAnalysisResult.requiredCredentialName) {
             // Maybe only check auth now if LLM didn't identify it despite prelim research?
             // const serviceName = ...
             // logger.debug(`Analysis Logic: Secondary Perplexity check for Auth method for ${serviceName}`);
             // const authQuery = ...
             // const authResult = await PERPLEXITY_getResponse(authQuery, "sonar");
             // secondaryFindings.push(`Secondary Auth Search: ${authResult.substring(0,100)}...`);
             // TODO: Parse authResult
        }
        // Add other conditional checks if the LLM analysis + prelim research still leaves gaps
    } catch (error) {
        logger.error("Analysis Logic: Error during secondary Perplexity research", { error });
        secondaryFindings.push(`Secondary Research Error: ${error instanceof Error ? error.message : String(error)}`);
    }

    // **** 6. Refine Analysis Based on Secondary Findings (If Any) ****
    const finalAnalysisResult: AnalysisResult = {
        ...initialAnalysisResult,
        // Add secondary findings to warnings if they occurred
        warnings: [
             ...(secondaryFindings.length > 0 ? [`Secondary Findings: ${secondaryFindings.join(' || ')}`] : []),
             ...initialAnalysisResult.warnings // Keep warnings from LLM analysis
            ].filter(Boolean),
        // TODO: Potentially refine details based on secondary findings
    };

    logger.info("Analysis Logic: Analysis phase complete", { finalResult: finalAnalysisResult.recommendedType });
    return finalAnalysisResult;
}
