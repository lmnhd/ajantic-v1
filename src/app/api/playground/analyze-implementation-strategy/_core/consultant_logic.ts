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
    recommendedType: z.enum(["api", "function", "undetermined"]).describe("Recommended implementation type ('api' or 'function', or 'undetermined' if unsure)."),
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
const MAX_ATTEMPTS = 3;
const PINECONE_NAMESPACE = "implementation-records"; // Define namespace
const PINECONE_TOP_K = 3; // Number of records to retrieve

// --- Placeholder Helper Implementations (Move to helpers.ts later) ---


/**
 * Orchestrates the analysis and verification phases, iterating on failure.
 * Includes querying Pinecone for relevant past records.
 */
export async function analyzeAndVerifyStrategy(
     toolRequest: ToolRequest,
     initialHistory: ConsultationHistory,
     initialModifications: string[],
     modelArgsFromRequest?: { /* ... */ } | null
): Promise<{ finalAnalysisResult: AnalysisResult; finalVerificationResult: VerificationResult; attemptHistory: ConsultationHistory }> {
    logger.info("Consultant Orchestrator: Starting iterative analysis...", { toolName: toolRequest.name });

    // --- Query Pinecone for Relevant Records ---
    let previousRecordsSummary = "Could not query past records.";
    try {
        const normalizedDomain = normalizeAndExtractDomain(toolRequest);
        const normalizedTaskSummary = summarizeCoreTask(toolRequest);
        const queryText = `${normalizedDomain} ${normalizedTaskSummary} ${toolRequest.description}`; // Simple query text

        logger.debug("Consultant Orchestrator: Querying Pinecone", { namespace: PINECONE_NAMESPACE, domain: normalizedDomain, task: normalizedTaskSummary });

        // Initialize Pinecone client and index
        const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY!, fetchApi: fetch }); // Ensure fetchApi is passed if needed
        const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX!);

        const vectorStore = await PineconeStore.fromExistingIndex(
            new OpenAIEmbeddings(), // Use your standard embeddings
            { pineconeIndex, namespace: PINECONE_NAMESPACE }
        );

        // Perform similarity search with metadata filter (optional but recommended)
        const relevantRecords = await vectorStore.similaritySearch(
            queryText,
            PINECONE_TOP_K
            // Example filter - adjust as needed
            // { targetServiceOrDomain: normalizedDomain }
        );
        logger.debug(`Consultant Orchestrator: Found ${relevantRecords.length} relevant records in Pinecone.`);

        previousRecordsSummary = formatRecordsForPrompt(relevantRecords);

    } catch (error) {
        logger.error("Consultant Orchestrator: Error querying Pinecone", { error: error instanceof Error ? error.message : String(error) });
        // Continue without past records if Pinecone fails
        previousRecordsSummary = "Error querying past records.";
    }
    // --- End Pinecone Query ---


    let attemptCounter = 0;
    let currentHistory = [...initialHistory];
    let currentModifications = [...initialModifications];
    let analysisResult: AnalysisResult | undefined; // Initialize as undefined
    let verificationResult: VerificationResult | undefined; // Initialize as undefined
    let internalAttemptHistory: ConsultationHistory = [];

    while (attemptCounter < MAX_ATTEMPTS) {
        attemptCounter++;
        logger.info(`Consultant Orchestrator: Attempt ${attemptCounter}/${MAX_ATTEMPTS}`);

        // 1. Run Analysis Phase - PASS PINEONE RESULTS
        analysisResult = await runAnalysisPhase(
            toolRequest,
            currentHistory,
            currentModifications,
            previousRecordsSummary, // Pass the retrieved records summary
            modelArgsFromRequest
        );

        // 2. Run Verification Phase
        verificationResult = await runVerificationPhase(
            analysisResult,
            toolRequest
        );

        // 3. Record this attempt internally
        const { latestRound: attemptRound, updatedHistory: historyAfterAttempt } = updateConsultationHistory(
            // Decide if internalAttemptHistory or currentHistory should determine round number
             internalAttemptHistory, // Using internal history ensures rounds start from 1 for this *call*
            currentModifications,
            analysisResult,
            verificationResult
        );
        internalAttemptHistory.push(attemptRound);

        // 4. Check Verification Status
        if (verificationResult.status !== 'failure') {
            logger.info(`Consultant Orchestrator: Verification successful/skipped on attempt ${attemptCounter}.`);
            break;
        }

        // --- Verification Failed ---
        logger.warn(`Consultant Orchestrator: Verification failed on attempt ${attemptCounter}.`, { details: verificationResult.details });

        if (attemptCounter >= MAX_ATTEMPTS) {
             logger.warn(`Consultant Orchestrator: Max attempts (${MAX_ATTEMPTS}) reached.`);
            break;
        }

        // 5. Prepare for Next Attempt
        const failureFeedback = `Attempt ${attemptCounter} (Strategy: ${analysisResult.recommendedType}) failed verification: ${verificationResult.details}. Please propose an alternative strategy, considering past records and original request.`;
        currentModifications = [failureFeedback]; // Set mods for next loop
        currentHistory = historyAfterAttempt; // Use history including failed attempt for context
        // Reset previousRecordsSummary for next LLM call? Probably not needed, LLM should use history now.

        logger.info(`Consultant Orchestrator: Preparing for attempt ${attemptCounter + 1}`);
    } // End while loop

    // Ensure results are defined before returning
    if (!analysisResult || !verificationResult) {
        logger.error("Consultant Orchestrator: Failed to get analysis/verification results within loop.", { attemptCounter });
        // Provide a default error state if something went fundamentally wrong
        analysisResult = analysisResult ?? { recommendedType: 'undetermined', strategyDetails: 'Orchestration loop failed unexpectedly.', warnings: ['Internal error'], requiredCredentialName: undefined };
        verificationResult = verificationResult ?? { status: 'failure', details: 'Orchestration loop failed unexpectedly.' };
    }

    logger.info("Consultant Orchestrator: Iteration complete.", { /* ... */ });

    // --- TODO: Add Pinecone Saving Logic Here (after loop) ---
    // await saveImplementationRecord(toolRequest, analysisResult, verificationResult, internalAttemptHistory);


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
