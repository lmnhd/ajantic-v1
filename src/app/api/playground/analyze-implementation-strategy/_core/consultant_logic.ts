import { z } from "zod"; // Import Zod
import { generateObject } from 'ai'; // Import generateObject
import { logger } from "@/src/lib/logger";
import { ToolRequest, ModelArgs, ModelProviderEnum } from "@/src/lib/types"; // Import ModelArgs, ModelProviderEnum
import { PERPLEXITY_getResponse } from '@/src/lib/agent-tools/perplexity2/perplexity'; // Import perplexity helper
import {
    AnalysisResult,
    ConsultationHistory,
    ConsultationRound,
    VerificationResult,
    ApiConsultationRequest as ConsultationRequest,
    RecommendedImplementationType,
    ResearchDepth
} from "../_types";
// Import utility to get model (assuming this exists and works like in other files)
import { MODEL_getModel_ai } from '@/src/lib/vercelAI-model-switcher';
import { UTILS_getModelArgsByName, UTILS_getModelsJSON, MODEL_JSON } from '@/src/lib/utils';
// Import the specific functions from the new files
import { runAnalysisPhase } from "./analysis_logic";
import { performVerification as runVerificationPhase } from "./verification_logic"; // Rename import if needed
// --- Pinecone/Langchain Imports ---
import { Pinecone } from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
// Import helpers (ensure summarizeHistory is also imported if needed elsewhere or defined locally)
import { normalizeAndExtractDomain, summarizeCoreTask, formatRecordsForPrompt, summarizeHistory } from "./helpers"; // Correctly importing from helpers

// Define the Zod schema for the expected LLM output (matching AnalysisResult type)
const analysisResultSchema = z.object({
    recommendedType: z.enum(["api", "function"]).describe("Recommended implementation type ('api' or 'function', or 'undetermined' if unsure)."),
    strategyDetails: z.string().describe("Detailed explanation of the recommended strategy. If 'api', include potential endpoint URL(s). If 'function', outline logic, suggest helpers (e.g., fetch, firecrawl, cheerio, visual scrape)."),
    warnings: z.array(z.string()).describe("List potential issues, blockers, or reasons why other types were ruled out (e.g., 'No public API found', 'Scraping likely blocked', 'JS rendering required')."),
    requiredCredentialName: z.string().optional().describe("If 'api' is recommended and needs authentication, specify the credential name needed (e.g., 'SERVICE_API_KEY', 'OAUTH_TOKEN').")
});

// // Helper to summarize history (to manage token count)
// function summarizeHistory(history: ConsultationHistory, maxRounds = 2): string {
//     if (history.length === 0) return "No previous consultation history.";
//     const relevantHistory = history.slice(-maxRounds);
//     return relevantHistory.map(round => `
// --- Round ${round.round} ---
// User Modifications: ${round.modificationsRequested.join(', ') || 'None'}
// Recommendation: ${round.analysis.recommendedType}
// Details: ${round.analysis.strategyDetails}
// Warnings: ${round.analysis.warnings.join('; ')}
// Verification: ${round.verification.status} - ${round.verification.details}
// --- End Round ${round.round} ---`).join('\n');
// }

// Helper function to map provider string from schema to ModelProviderEnum
// (Ensure this handles potential case mismatches if necessary)
function mapProviderStringToEnum(providerString?: string): ModelProviderEnum | undefined {
    if (!providerString) return undefined;
    const upperCaseProvider = providerString.toUpperCase();
    // Find the key in ModelProviderEnum whose value matches the uppercase string
    const enumKey = Object.keys(ModelProviderEnum).find(key =>
        ModelProviderEnum[key as keyof typeof ModelProviderEnum].toUpperCase() === upperCaseProvider
    );
    return enumKey ? ModelProviderEnum[enumKey as keyof typeof ModelProviderEnum] : undefined;
}

// --- Constants ---
const MAX_ATTEMPTS = 3; // Ensure at least 2, 3 is safer for one retry after detailed
const PINECONE_NAMESPACE = "implementation-records"; // Define namespace
const PINECONE_TOP_K = 3; // Number of records to retrieve

// --- Placeholder Helper Implementations (Move to helpers.ts later) ---


/**
 * Orchestrates the analysis and verification phases, iterating on failure.
 * Includes querying Pinecone for relevant past records and potentially deepening research.
 */
export async function analyzeAndVerifyStrategy(
     toolRequestInput: ConsultationRequest['currentToolRequest'],
     initialHistory: ConsultationHistory,
     initialModifications: string[],
     modelArgsFromRequest?: { /* ... */ } | null
): Promise<{ finalAnalysisResult: AnalysisResult; finalVerificationResult: VerificationResult; attemptHistory: ConsultationHistory }> {
    logger.info("Consultant Orchestrator: Starting iterative analysis...", { toolName: toolRequestInput.name });

    const toolRequest: ToolRequest = {
        ...toolRequestInput,
        examples: toolRequestInput.examples?.map(ex => ({
            input: ex.input,
            output: ex.output ?? null
        }))
    };

    let previousRecordsSummary = "Could not query past records."; // Placeholder for Pinecone logic

    let attemptCounter = 0;
    let currentHistory = [...initialHistory];
    let currentModifications = [...initialModifications];
    let analysisResult: AnalysisResult | undefined;
    let verificationResult: VerificationResult | undefined;
    let internalAttemptHistory: ConsultationHistory = [];
    let currentResearchDepth = ResearchDepth.BASIC; // Start with BASIC depth
    let detailedSearchPerformedThisCall = false; // Prevent multiple detailed searches in one call

    while (attemptCounter < MAX_ATTEMPTS) {
        attemptCounter++;
        logger.info(`Consultant Orchestrator: Attempt ${attemptCounter}/${MAX_ATTEMPTS} with research depth: ${currentResearchDepth}`);

        // 1. Run Analysis Phase
        const strategyAnalysisObj = await runAnalysisPhase(
            toolRequest,
            currentHistory, // Pass the history accumulated within this call for context
            currentModifications, // Pass modifications specific to this attempt
            previousRecordsSummary,
            currentResearchDepth, // Pass current research depth
            modelArgsFromRequest
        );

        if (!strategyAnalysisObj || !strategyAnalysisObj.analysis) {
            logger.error("Consultant Orchestrator: runAnalysisPhase did not return a valid analysis object.");
            analysisResult = {
                consultationId: `error-${Date.now()}-${attemptCounter}`,
                recommendedType: RecommendedImplementationType.ERROR,
                strategyDetails: "Critical error: Failed to get analysis object from analysis phase.",
                warnings: ["Internal error in analysis phase"],
                confidence: "low",
                strategyTitle: "Analysis Error",
                potentialIssues: ["Internal error in analysis phase"],
                preliminaryFindings: previousRecordsSummary,
                preliminaryResearchFor: undefined, // Or attempt to get from toolRequest if possible
            };
        } else {
            analysisResult = strategyAnalysisObj.analysis;
        }

        // 2. Run Verification Phase
        verificationResult = await runVerificationPhase(
            analysisResult,
            toolRequest
        );

        // 3. Record this attempt
        const { latestRound: attemptRound } = updateConsultationHistory(
            internalAttemptHistory, // Use internalAttemptHistory to correctly number rounds for *this call's* attempts
            currentModifications, 
            analysisResult,
            verificationResult
        );
        internalAttemptHistory.push(attemptRound);
        currentHistory = [...initialHistory, ...internalAttemptHistory]; // Update currentHistory for next *potential* loop iteration
                                                                     // or for final context if exiting.

        // 4. Check Verification Status
        if (verificationResult.status !== 'failure') {
            logger.info(`Consultant Orchestrator: Verification successful/skipped on attempt ${attemptCounter}.`);
            break; 
        }

        // --- Verification Failed --- (This block is reached if verification.status IS 'failure')
        logger.warn(`Consultant Orchestrator: Verification failed on attempt ${attemptCounter}.`, { details: verificationResult.details });
        // Default modification if no detailed search is triggered initially for the next loop, will be overwritten if detailed search is triggered.
        currentModifications = [`Attempt ${attemptCounter} (Strategy: ${analysisResult.recommendedType}, Depth: ${currentResearchDepth}) failed verification: ${verificationResult.details}. Please propose an alternative strategy or refine details.`];

        // 5. Decide if a DETAILED search is needed and hasn't been done yet in this call
        let triggerDetailedSearch = false;
        if (analysisResult.recommendedType === RecommendedImplementationType.API && 
            currentResearchDepth === ResearchDepth.BASIC && 
            !detailedSearchPerformedThisCall) {
            
            const endpointSeemsValid = analysisResult.extractedApiEndpoint && analysisResult.extractedApiEndpoint.startsWith('http');
            const essentialParams = toolRequest.inputs.filter(p => p.required !== false && !p.name.match(/instruction|format|context|user_input/i));
            let paramsSeemCovered = true; // Assume true if no essential params
            if (essentialParams.length > 0) {
                 paramsSeemCovered = essentialParams.every(param => {
                    return (analysisResult?.strategyDetails && analysisResult.strategyDetails.toLowerCase().includes(param.name.toLowerCase())) ||
                           param.name.match(/query|id|search|url|path|body|filter|term/i);
                });
            }

            if (!endpointSeemsValid || !paramsSeemCovered) {
                logger.info(`Consultant Orchestrator: API strategy from BASIC research is incomplete. Endpoint present: ${!!endpointSeemsValid}, Params covered: ${paramsSeemCovered}. Triggering DETAILED search.`);
                triggerDetailedSearch = true;
            }
        }

        if (triggerDetailedSearch) {
            currentResearchDepth = ResearchDepth.DETAILED;
            detailedSearchPerformedThisCall = true; // Mark that we are doing it now
            // Replace currentModifications to focus on the detailed search task
            currentModifications = ["Previous API analysis from basic research lacked a clear, usable endpoint or complete parameter coverage. A detailed API endpoint search has now been performed; use its new findings to refine the API strategy, including the exact endpoint and parameter mapping."];
            logger.info(`Consultant Orchestrator: Deepening research for attempt ${attemptCounter}. Next call to runAnalysisPhase will use DETAILED depth.`);
            // No 'continue' is strictly needed as the code flows to the loop's next iteration check.
            // The attemptCounter will increment at the start of the loop, and the while condition will be re-evaluated.
        } else {
            // Not triggering a detailed search (either not an API, or detailed already done, or conditions not met)
            // If verification failed and we're not doing a detailed search now, check max attempts before continuing the loop for a standard retry.
            if (attemptCounter >= MAX_ATTEMPTS) {
                logger.warn(`Consultant Orchestrator: Max attempts (${MAX_ATTEMPTS}) reached after verification failure and no detailed search triggered this round.`);
                break; // Exit loop if max attempts reached and not doing a new detailed search
            }
        }
        // Loop continues if attemptCounter < MAX_ATTEMPTS (and no break occurred)

    } // End while loop

    if (!analysisResult || !verificationResult) {
        logger.error("Consultant Orchestrator: Loop finished without analysis/verification results.", { attemptCounter });
        analysisResult = analysisResult ?? {
            consultationId: `error-${Date.now()}-fallback`,
            recommendedType: RecommendedImplementationType.ERROR,
            strategyDetails: 'Orchestration loop failed unexpectedly or exited early.',
            warnings: ['Internal error in consultant_logic fallback'],
            requiredCredentialName: undefined,
            confidence: "low",
            strategyTitle: "Orchestration Error",
            potentialIssues: ["Internal error in consultant_logic fallback"],
            preliminaryFindings: "N/A",
            preliminaryResearchFor: undefined,
        };
        verificationResult = verificationResult ?? { status: 'failure', details: 'Orchestration loop failed unexpectedly or exited early (fallback).' };
    }

    logger.info("Consultant Orchestrator: Iteration complete.", { finalRecommendedType: analysisResult.recommendedType, finalVerificationStatus: verificationResult.status, totalAttemptsThisCall: internalAttemptHistory.length });
    
    return {
        finalAnalysisResult: analysisResult,
        finalVerificationResult: verificationResult,
        attemptHistory: internalAttemptHistory 
     };
}

/**
 * Combines results into a consultation round and updates history.
 * (This function remains here as it deals with the overall round structure)
 */
export function updateConsultationHistory(
    history: ConsultationHistory,
    modifications: string[],
    analysis: AnalysisResult,
    verification: VerificationResult
): { latestRound: ConsultationRound; updatedHistory: ConsultationHistory } {
    const nextRoundNumber = (history[history.length - 1]?.round || 0) + 1;
    const latestRound: ConsultationRound = {
        round: nextRoundNumber,
        modificationsRequested: modifications,
        analysis: analysis,
        verification: verification,
        timestamp: new Date().toISOString(),
    };
    const updatedHistory = [...history, latestRound];
    logger.info("Consultant Orchestrator: History updated", { nextRound: nextRoundNumber });
    return { latestRound, updatedHistory };
}
