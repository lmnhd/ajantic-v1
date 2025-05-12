import { logger } from "@/src/lib/logger";
import { ModelProviderEnum, ToolRequest, ToolInputParameter } from "@/src/lib/types";
import { ConsultationHistory } from "../_types";
import { Document } from "@langchain/core/documents";

// Helper to summarize history (to manage token count)
export function summarizeHistory(history: ConsultationHistory, maxRounds = 2): string {
    if (history.length === 0) return "No previous consultation history.";
    const relevantHistory = history.slice(-maxRounds);
    // Consider making the summary more concise if needed
    return relevantHistory.map(round => `
--- Round ${round.round} ---
User Modifications: ${round.modificationsRequested.join(', ') || 'None'}
Recommendation: ${round.analysis.recommendedType}
Details: ${round.analysis.strategyDetails}
Warnings: ${(round.analysis.warnings || []).join('; ') || 'None'}
Verification: ${round.verification?.status || 'N/A'} - ${round.verification?.details || 'N/A'}
--- End Round ${round.round} ---`).join('\n');
}

// Helper function to map provider string from schema to ModelProviderEnum
export function mapProviderStringToEnum(providerString?: string): ModelProviderEnum | undefined {
    if (!providerString) return undefined;
    const upperCaseProvider = providerString.toUpperCase();
    const enumKey = Object.keys(ModelProviderEnum).find(key =>
        ModelProviderEnum[key as keyof typeof ModelProviderEnum].toUpperCase() === upperCaseProvider
    );
    return enumKey ? ModelProviderEnum[enumKey as keyof typeof ModelProviderEnum] : undefined;
}

// Helper to normalize domain/service name
export function normalizeAndExtractDomain(toolRequest: ToolRequest): string {
    // Placeholder: Extract from URL input or guess from name/description
    const urlInput = toolRequest.inputs.find((inp: ToolInputParameter) => inp.name.toLowerCase().includes('url'))?.default as string;
    if (urlInput) {
        try {
            const hostname = new URL(urlInput).hostname;
            return hostname.replace(/^www\./, '').toLowerCase(); // Normalize www. and case
        } catch { /* ignore error */ }
    }
    // Try extracting from description or purpose if it looks like a domain
    const textToCheck = toolRequest.description || toolRequest.purpose || '';
    const domainMatch = textToCheck.match(/([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/);
     if(domainMatch?.[0]) {
        return domainMatch[0].toLowerCase();
     }

    return toolRequest.name.split('_')[0]?.toLowerCase() || "generic_web"; // Fallback
}

// Helper to summarize the core task
export function summarizeCoreTask(toolRequest: ToolRequest): string {
    // Placeholder: Use tool name or first few words of description
    // TODO: Implement better summarization (keywords or LLM)
    const nameParts = toolRequest.name.toLowerCase().split('_');
    // Try to remove generic prefixes like 'get', 'fetch', 'scrape'
    const coreName = nameParts.length > 1 && ['get', 'fetch', 'scrape', 'search', 'analyze'].includes(nameParts[0])
        ? nameParts.slice(1).join('_')
        : nameParts.join('_');
    return coreName || toolRequest.description.substring(0, 30).toLowerCase().trim();
}

// Helper to format retrieved Pinecone records for the LLM prompt
export function formatRecordsForPrompt(records: Document[]): string {
    if (!records || records.length === 0) {
        return "No relevant past records found.";
    }
    // Format concisely
    return "Relevant Past Implementation Records:\n" + records.map((doc, i) => {
        const meta = doc.metadata || {}; // Ensure metadata exists
        let recordSummary = `Record ${i + 1}: [${meta.outcomeStatus || 'UNKNOWN'}] Type='${meta.recommendedType || 'N/A'}' for '${meta.targetServiceOrDomain || 'Unknown'} - ${meta.coreTaskSummary || 'Unknown Task'}'. Strategy: ${meta.strategyDetailsSummary || 'N/A'}.`;
        if (meta.finalWarningSummary) {
             recordSummary += ` Warnings: ${meta.finalWarningSummary}`;
        }
        recordSummary += ` (Last updated: ${meta.updatedAt ? new Date(meta.updatedAt).toLocaleDateString() : 'N/A'})`;
        return recordSummary;
    }).join('\n');
}

// Add any other small, reusable helper functions here later.
