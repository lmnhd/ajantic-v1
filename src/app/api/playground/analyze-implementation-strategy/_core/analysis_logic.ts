import { z } from "zod";
import { generateObject } from 'ai';
import { logger } from "@/src/lib/logger";
import { ToolRequest, ModelArgs, ModelProviderEnum, ToolInputParameter } from "@/src/lib/types";
import { PERPLEXITY_getResponse } from '@/src/lib/agent-tools/perplexity2/perplexity';
import { AnalysisResult, ConsultationHistory, ConsultationRequestContext, ConsultationRound, StrategyAnalysis, VerificationResult, ResearchDepth, PreliminaryResearchIdentifiers, RecommendedImplementationType } from "../_types";
import { MODEL_getModel_ai } from '@/src/lib/vercelAI-model-switcher';
import { UTILS_getModelArgsByName, UTILS_getModelsJSON, MODEL_JSON } from '@/src/lib/utils';
import { summarizeHistory, mapProviderStringToEnum } from './helpers'; // Import helpers
import { TOOLS_performBasicVerification } from './verification_logic';
import { LLM_generateStrategySuggestion } from './llm_logic';



// Define the Zod schema for the expected LLM output (matching part of AnalysisResult type)
const analysisResultSchema = z.object({
    recommendedType: z.nativeEnum(RecommendedImplementationType).describe("Recommended implementation type ('api', 'function', 'unknown', or 'error')."),
    strategyDetails: z.string().describe("Detailed explanation of the recommended strategy. If 'api', include potential endpoint URL(s). If 'function', outline logic, suggest helpers (e.g., fetch, firecrawl, cheerio, visual scrape)."),
    warnings: z.array(z.string()).optional().describe("List potential issues, blockers, or reasons why other types were ruled out (e.g., 'No public API found', 'Scraping likely blocked', 'JS rendering required')."),
    requiredCredentialName: z.string().optional().nullable().describe("If 'api' is recommended and needs authentication, specify the credential name needed (e.g., 'SERVICE_API_KEY', 'OAUTH_TOKEN'). Use null or omit if none needed.")
});

// Helper to extract key identifiers from a ToolRequest for comparison
const getKeyIdentifiers = (toolRequest: ToolRequest): PreliminaryResearchIdentifiers => {
  const serviceName = toolRequest.name.split('_')[0] || toolRequest.name;
  const targetUrlInput = toolRequest.inputs.find((inp: ToolInputParameter) => inp.name.toLowerCase().includes('url'));
  let targetUrlValue = targetUrlInput?.default as string || targetUrlInput?.description || toolRequest.purpose || toolRequest.description;
  if (typeof targetUrlValue !== 'string' || !targetUrlValue.startsWith('http')) {
    targetUrlValue = '';
  }
  return {
    name: toolRequest.name,
    description: toolRequest.description,
    serviceName: serviceName,
    targetUrl: targetUrlValue,
  };
};

/**
 * Performs the core analysis using LLM and Perplexity research.
 */
export async function runAnalysisPhase(
    toolRequest: ToolRequest,
    history: ConsultationHistory,
    modifications: string[],
    previousRecordsSummary: string,
    researchDepth: ResearchDepth = ResearchDepth.BASIC,
    modelArgsFromRequest?: {
        provider?: string;
        modelName?: string;
        temperature?: number;
        topP?: number;
        maxTokens?: number;
    } | null
): Promise<StrategyAnalysis> {
    logger.info("Analysis Logic: Running analysis phase...", {
        toolName: toolRequest.name,
        historyLength: history.length,
        researchDepth
    });

    let preliminaryFindings = "No preliminary research conducted.";
    let reusedFindings = false;
    const currentIdentifiers = getKeyIdentifiers(toolRequest);
    let extractedApiEndpointFromDetailedSearch: string | null = null;
    let extractedApiUrlBasic: string | null = null;

    // **** 0. Check History for Reusable Preliminary Findings ****
    if (history && history.length > 0) {
        const lastRound = history[history.length - 1];
        if (lastRound?.analysis?.preliminaryFindings && lastRound.analysis.preliminaryResearchFor) {
            const previousIdentifiers = lastRound.analysis.preliminaryResearchFor;
            if (
                previousIdentifiers.name === currentIdentifiers.name &&
                previousIdentifiers.description === currentIdentifiers.description &&
                previousIdentifiers.serviceName === currentIdentifiers.serviceName &&
                previousIdentifiers.targetUrl === currentIdentifiers.targetUrl
            ) {
                if (typeof lastRound.analysis.preliminaryFindings === 'string' && !lastRound.analysis.preliminaryFindings.startsWith("Error during preliminary research:")) {
                    preliminaryFindings = lastRound.analysis.preliminaryFindings;
                    reusedFindings = true;
                    logger.info("Analysis Logic: Reusing preliminary findings from previous round.");
                    if (lastRound.analysis.extractedApiEndpoint) { // Check if this field exists
                        extractedApiEndpointFromDetailedSearch = lastRound.analysis.extractedApiEndpoint;
                         logger.info("Analysis Logic: Reusing extracted API endpoint from detailed search in previous round.", { endpoint: extractedApiEndpointFromDetailedSearch });
                    }
                } else {
                    logger.info("Analysis Logic: Previous preliminary findings were an error or invalid, will re-fetch.");
                }
            } else {
                logger.info("Analysis Logic: Current tool request differs from previous, will re-fetch preliminary findings.", {currentIdentifiers, previousIdentifiers});
            }
        } else {
            logger.info("Analysis Logic: No preliminary findings or identifiers found in the last round.");
        }
    } else {
        logger.info("Analysis Logic: Consultation history is empty. Proceeding with new research.");
    }

    // **** 1. Preliminary Perplexity Research (if not reused or if new depth requires it) ****
    if (!reusedFindings) {
        let apiDocsFullResult: string | null = null;
        let apiDocsNote: string = "API Docs Check: Research not performed or no result.";
        let scrapingFullResult: string | null = null;
        let scrapingNote: string = "Scraping Check: Research not performed or no relevant URL.";
        let detailedApiResearchLog = "";

        try {
            logger.debug("Analysis Logic: Starting new preliminary Perplexity research", { researchDepth });
            const serviceName = currentIdentifiers.serviceName;
            const targetUrl = currentIdentifiers.targetUrl;

            try {
                const apiDocsQuery = `Existence and link for official developer API documentation for service related to \'${serviceName}\' or task \'${toolRequest.description}\'`;
                apiDocsFullResult = await PERPLEXITY_getResponse(apiDocsQuery, "sonar-pro");
                if (apiDocsFullResult) {
                    const urlMatch = apiDocsFullResult.match(/https?:\/\/[^\s\'\"()<>]+/);
                    extractedApiUrlBasic = urlMatch ? urlMatch[0] : null;
                    apiDocsNote = `API Docs Check: ${extractedApiUrlBasic ? 'Potential docs/URL found.' : 'No specific URL extracted, but research was run.'}`;
                } else {
                    apiDocsNote = "API Docs Check: No direct response from Perplexity.";
                }
                logger.debug("Analysis Logic: Prelim API docs check result", { note: apiDocsNote, extractedUrl: extractedApiUrlBasic, fullResultLength: apiDocsFullResult?.length });
            } catch (e: any) {
                logger.error("Analysis Logic: Error during API docs Perplexity query", { error: e.message });
                apiDocsNote = "API Docs Check: Error during research.";
            }

            if (targetUrl) {
                try {
                    const scrapingQuery = `Common scraping difficulties or bot protection mechanisms (like Cloudflare) for website ${targetUrl}`;
                    scrapingFullResult = await PERPLEXITY_getResponse(scrapingQuery, "sonar");
                    if (scrapingFullResult) {
                        scrapingNote = `Scraping Check (${targetUrl}): ${scrapingFullResult.toLowerCase().includes('cloudflare') || scrapingFullResult.toLowerCase().includes('difficult') ? 'Potential difficulties noted.' : 'No immediate blockers noted in summary.'}`;
                    } else {
                        scrapingNote = `Scraping Check (${targetUrl}): No direct response from Perplexity for scraping.`;
                    }
                    logger.debug("Analysis Logic: Prelim scraping check result", { note: scrapingNote, fullResultLength: scrapingFullResult?.length });
                } catch (e: any) {
                    logger.error("Analysis Logic: Error during scraping Perplexity query", { error: e.message });
                    scrapingNote = `Scraping Check (${targetUrl}): Error during research.`;
                }
            } else {
                scrapingNote = "Scraping Check: No target URL identified for scraping analysis.";
            }

            if (researchDepth === ResearchDepth.DETAILED) {
                logger.info("Analysis Logic: Performing DETAILED API endpoint search.");
                const seemsApiRelated = toolRequest.purpose?.toLowerCase().includes("api") ||
                                      toolRequest.description?.toLowerCase().includes("api") ||
                                      toolRequest.name?.toLowerCase().includes("api") ||
                                      (apiDocsFullResult && !apiDocsFullResult.toLowerCase().includes("no api documentation found") && !apiDocsFullResult.toLowerCase().includes("does not seem to have an api"));

                if (seemsApiRelated) {
                    try {
                        const detailedApiQuery = `Critical API Endpoint Search: For a tool named \'${toolRequest.name}\' described as \'${toolRequest.description}\' (related to service/domain \'${serviceName}\'), what is the precise base URL and primary API endpoint for any relevant public API? Include common path parameters if known. Focus on accuracy and specificity.`;
                        const detailedApiResultText = await PERPLEXITY_getResponse(detailedApiQuery, "sonar-pro");

                        if (detailedApiResultText) {
                            logger.debug("Analysis Logic: DETAILED API search raw result", { resultLength: detailedApiResultText.length, first200Chars: detailedApiResultText.substring(0,200) });
                            const urlMatches = detailedApiResultText.match(/https?:\/\/[^\s\'\"()<>]+/g);
                            if (urlMatches && urlMatches.length > 0) {
                                let bestMatch: string | null = null;
                                for (const match of urlMatches) {
                                    if (match.includes("/api") || match.includes("/v1") || match.includes("/v2") || match.includes("/rest")) {
                                        bestMatch = match;
                                        break;
                                    }
                                }
                                extractedApiEndpointFromDetailedSearch = bestMatch || urlMatches[0];
                                logger.info("Analysis Logic: Extracted API endpoint from DETAILED search", { endpoint: extractedApiEndpointFromDetailedSearch });
                                detailedApiResearchLog = `Detailed API Search: Extracted potential endpoint: ${extractedApiEndpointFromDetailedSearch}. Full detailed response excerpt: ${detailedApiResultText.substring(0, 300)}...`;
                            } else {
                                logger.warn("Analysis Logic: DETAILED API search ran but no specific endpoint URL was extracted from its response.", { responseSubstring: detailedApiResultText.substring(0, 200) });
                                detailedApiResearchLog = `Detailed API Search: Ran, but no specific URL found in response. Response excerpt: ${detailedApiResultText.substring(0, 300)}...`;
                            }
                        } else {
                            logger.warn("Analysis Logic: DETAILED API search returned no result.");
                            detailedApiResearchLog = "Detailed API Search: No result returned from Perplexity.";
                        }
                    } catch (e: any) {
                        logger.error("Analysis Logic: Error during DETAILED API Perplexity query", { error: e.message });
                        detailedApiResearchLog = `Detailed API Search: Error during query: ${e.message}`;
                    }
                } else {
                     logger.info("Analysis Logic: Skipping DETAILED API endpoint search as basic research or tool description does not strongly suggest an API.");
                     detailedApiResearchLog = "Detailed API Search: Skipped (basic research didn't strongly suggest an API).";
                }
            }

            const findingsSummary = `Summary of Basic Research:\n- ${apiDocsNote}\n- ${scrapingNote}`;
            const apiDetailsBasic = `Basic API Documentation Details (from Perplexity):\n${apiDocsFullResult || "No detailed results for API documentation."}\n${extractedApiUrlBasic ? `Potentially relevant URL from basic search: ${extractedApiUrlBasic}` : ""}`.trim();
            const scrapingDetailsText = `Scraping Analysis Details for ${targetUrl || 'N/A'} (from Perplexity):\n${scrapingFullResult || "No detailed results for scraping analysis."}`.trim();
            
            preliminaryFindings = `
--- Preliminary Research Findings ---
${findingsSummary}

${apiDetailsBasic}

${scrapingDetailsText}
${researchDepth === ResearchDepth.DETAILED ? `\n--- Detailed API Endpoint Research Log ---\n${detailedApiResearchLog}\n--- End Detailed API Endpoint Research Log ---` : ""}
--- End Preliminary Research Findings ---`.trim();
            
            logger.info("Analysis Logic: New preliminary findings generated.", { length: preliminaryFindings.length });

        } catch (error) {
            logger.error("Analysis Logic: Error during preliminary Perplexity research block", { error: error instanceof Error ? error.message : String(error) });
            preliminaryFindings = `Error during preliminary research: ${error instanceof Error ? error.message : String(error)}`;
        }
    } else {
        logger.debug("Analysis Logic: Skipping new Perplexity research, using stored findings.", {
            reusedFindingsContent: preliminaryFindings.substring(0, 200) + "...",
            reusedExtractedEndpoint: extractedApiEndpointFromDetailedSearch
        });
    }

    const systemPrompt = `
You are an expert Software Implementation Consultant. Your task is to analyze a tool request and recommend the most viable implementation strategy: using an existing API ('api') or writing a custom function ('function'). Prioritize APIs if available and suitable. Base your recommendation on the tool's purpose, parameters, expected output, previous consultation history, and the user's latest refinement requests.

<tool_request>
Name: ${toolRequest.name}
Description: ${toolRequest.description}
Purpose: ${toolRequest.purpose || toolRequest.description}
Inputs:
${toolRequest.inputs.map((p: ToolInputParameter) => `- ${p.name} (${p.type}): ${p.description}${p.required === false ? ' (optional)' : ''}`).join('\n') || '  (No input parameters defined)'}
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
${summarizeHistory(history)}
</consultation_history_summary>

<user_refinement_requests>
${modifications.length > 0 ? modifications.map(m => `- ${m}`).join('\n') : 'None'}
</user_refinement_requests>

<instructions>
1.  **Analyze Feasibility:** Based on the tool request, preliminary research (pay close attention to any 'Detailed API Endpoint Research Log' or extracted endpoints like '${extractedApiUrlBasic ? extractedApiUrlBasic : 'any URL found in research'}' mentioned therein), **past records**, and history, determine the best strategy ('api' or 'function', or 'unknown' if truly unclear, 'error' if analysis itself fails).
    *   API First: Prefer API if research, records, or common knowledge suggests one exists. If a specific endpoint was found in detailed research ('extractedApiEndpointFromDetailedSearch' in the logs) or a general API documentation URL was found (like '${extractedApiUrlBasic ? extractedApiUrlBasic : 'any relevant URL'}'), prioritize its evaluation.
    *   Function: Recommend 'function' for scraping (heed research warnings), custom logic, etc.
2.  **Provide Strategy Details:** Explain your recommendation.
    *   **For 'api' type:** If a potential API endpoint URL (e.g., a base URL, a specific endpoint from detailed search, or a documentation link like '${extractedApiUrlBasic ? extractedApiUrlBasic : 'any promising URL from research'}') was found in \`<preliminary_research_findings>\`, you **MUST** include that **exact URL** directly and prominently in your \`strategyDetails\` text. If multiple are found, pick the most relevant one. Also, briefly describe how to find specific endpoints if only a base/docs URL is available.
    *   For 'function' type: Outline the core logic.
3.  **Identify Credentials:** If recommending 'api', specify credential type and a generic name (e.g., 'SERVICE_API_KEY'). Set to null/omit if none or type is 'function'.
4.  **List Warnings:** Mention potential blockers, difficulties (e.g., "No known public API", "Website uses heavy JS, recommend Firecrawl helper", "API requires paid plan"), or reasons for ruling out alternatives. Include warnings from research AND relevant past records.
5.  **Consider History & Modifications:** Adapt based on previous rounds and user's latest requests.
6.  **Output Format:** Respond ONLY with a valid JSON object matching the required schema.
</instructions>

<output_schema>
${JSON.stringify(analysisResultSchema.shape, null, 2)}
</output_schema>
Generate ONLY the JSON object containing the analysis result.
`;

    let analysisModelArgs: ModelArgs;
    const defaultModelNameForCatch = MODEL_JSON().OpenAI['gpt-4.5-preview']?.name ?? "openai:gpt-4.5-preview"; // Ensure MODEL_JSON() is correct
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
                    logger.warn(`Analysis Logic: Failed lookup for requested model \'${modelArgsFromRequest.modelName}\'. Falling back.`, { error: modelLookupError });
                    analysisModelArgs = UTILS_getModelArgsByName(defaultModelNameForCatch);
                }
            } else {
                logger.warn(`Analysis Logic: Invalid provider \'${modelArgsFromRequest.provider}\'. Falling back.`);
                analysisModelArgs = UTILS_getModelArgsByName(defaultModelNameForCatch);
            }
        } else {
            logger.info(`Analysis Logic: Using default model for generateObject.`);
            analysisModelArgs = UTILS_getModelArgsByName(defaultModelNameForCatch);
        }
    } catch (e) {
        logger.error(`Analysis Logic: Critical failure getting model args for generateObject. Using safest fallback.`, { error: e });
        analysisModelArgs = { provider: ModelProviderEnum.OPENAI, modelName: "openai:gpt-4o", temperature: 0.5 }; // Ensure gpt-4o is a valid name if used
    }
    const modelForGenerateObject = await MODEL_getModel_ai(analysisModelArgs);

    let structuredAnalysisFromLLM: Partial<AnalysisResult> = {};
    try {
        logger.debug("Analysis Logic: Calling generateObject for structured analysis", { model: analysisModelArgs.modelName });
        const { object } = await generateObject({
             model: modelForGenerateObject,
             schema: analysisResultSchema,
             prompt: systemPrompt,
             temperature: analysisModelArgs.temperature ?? 0.5,
        });
        structuredAnalysisFromLLM = object as Partial<AnalysisResult>;
         if (!structuredAnalysisFromLLM || !structuredAnalysisFromLLM.recommendedType) {
             throw new Error("LLM (generateObject) failed to return a valid analysis structure.");
         }
         logger.info("Analysis Logic: Structured LLM analysis (generateObject) successful", { type: structuredAnalysisFromLLM.recommendedType });
    } catch (error) {
        logger.error("Analysis Logic: generateObject failed", {
             model: analysisModelArgs.modelName,
             error: error instanceof Error ? error.message : String(error),
        });
        structuredAnalysisFromLLM = {
             recommendedType: RecommendedImplementationType.ERROR,
             strategyDetails: `Failed to get structured analysis from LLM (generateObject): ${error instanceof Error ? error.message : String(error)}`,
             warnings: ["LLM structured analysis (generateObject) failed."],
         };
    }
    
    // Fallback for LLM_generateStrategySuggestion if it's not defined or we want to simplify
    // For now, we'll assume llmSuggestionResponse is similar to structuredAnalysisFromLLM
    // and prioritize structuredAnalysisFromLLM if LLM_generateStrategySuggestion isn't the main driver.
    // The original code relied on LLM_generateStrategySuggestion for the final content.
    // Let's assume LLM_generateStrategySuggestion is primary for content, and structuredAnalysisFromLLM is a fallback or input.

    const llmSuggestionResponse = await LLM_generateStrategySuggestion(
        toolRequest,
        preliminaryFindings,
        modifications,
        history
    );

    // Helper to map string literal to enum
    const mapStringToRecommendedType = (typeStr: string | undefined): RecommendedImplementationType => {
        if (typeStr === "api") return RecommendedImplementationType.API;
        if (typeStr === "function") return RecommendedImplementationType.FUNCTION;
        if (typeStr === "unknown") return RecommendedImplementationType.UNKNOWN;
        if (typeStr === "error") return RecommendedImplementationType.ERROR;
        return RecommendedImplementationType.UNKNOWN; // Default fallback
    };

    const llmRecommendedType = mapStringToRecommendedType(llmSuggestionResponse.recommendedType);
    // structuredAnalysisFromLLM.recommendedType is already an enum type or undefined
    const structuredRecommendedType = structuredAnalysisFromLLM.recommendedType;

    // Construct the primary AnalysisResult object for this round
    const consultationIdForRound = `session-${Date.now()}-${Math.random().toString(36).substring(2,7)}`;
    const analysisResultData: AnalysisResult = {
        consultationId: consultationIdForRound,
        recommendedType: llmRecommendedType || structuredRecommendedType || RecommendedImplementationType.UNKNOWN,
        confidence: llmSuggestionResponse.confidence || "medium",
        strategyTitle: llmSuggestionResponse.strategyTitle || `Strategy for ${toolRequest.name}`,
        strategyDetails: llmSuggestionResponse.reasoning || structuredAnalysisFromLLM.strategyDetails || "No specific reasoning provided.",
        potentialIssues: llmSuggestionResponse.potentialIssues || structuredAnalysisFromLLM.warnings || [],
        exampleUsage: llmSuggestionResponse.exampleUsage || undefined,
        requiredCredentialName: llmSuggestionResponse.requiredCredentialName || structuredAnalysisFromLLM.requiredCredentialName || undefined,
        extractedApiEndpoint: extractedApiEndpointFromDetailedSearch === null ? undefined : extractedApiEndpointFromDetailedSearch,
        preliminaryFindings: preliminaryFindings,
        preliminaryResearchFor: currentIdentifiers,
        warnings: llmSuggestionResponse.warnings || structuredAnalysisFromLLM.warnings || [],
    };
    
    logger.info("Analysis Logic: Constructed analysisResultData", { type: analysisResultData.recommendedType, extractedEndpoint: analysisResultData.extractedApiEndpoint });

    const verificationResult = await TOOLS_performBasicVerification(
        analysisResultData,
        toolRequest
    );

    const currentRoundNumber = history.length + 1;
    const currentRound: ConsultationRound = {
        round: currentRoundNumber,
        modificationsRequested: modifications,
        analysis: analysisResultData,
        verification: verificationResult,
        timestamp: new Date().toISOString(),
    };

    const updatedHistory = [...history, currentRound];
    logger.info(`Analysis Logic: Analysis complete for round ${currentRoundNumber}. Preparing StrategyAnalysis object.`);

    const finalStrategyAnalysis: StrategyAnalysis = {
        id: `consult-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        consultationId: consultationIdForRound,
        timestamp: new Date(),
        request: {
            currentToolRequest: toolRequest,
            researchDepth: researchDepth,
            userContext: toolRequest.additionalContext || undefined,
            previousAnalysis: history.length > 0 ? history[history.length-1] : undefined,
        },
        analysis: analysisResultData,
        verification: verificationResult,
        feedback: undefined, 
        status: analysisResultData.recommendedType === RecommendedImplementationType.ERROR ? "failed" : "completed", // Use enum for comparison
        error: analysisResultData.recommendedType === RecommendedImplementationType.ERROR ? analysisResultData.strategyDetails : undefined, // Use enum
        version: "1.1",
    };

    return finalStrategyAnalysis;
}
