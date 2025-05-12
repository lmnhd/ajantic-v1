import { logger } from "@/src/lib/logger";
import { AnalysisResult, VerificationResult } from "../_types";
import { ToolRequest, ToolInputParameter } from "@/src/lib/types";

/**
 * Performs basic live verification based on the analysis result.
 */
export async function performVerification(
    analysis: AnalysisResult,
    toolRequest: ToolRequest
): Promise<VerificationResult> {
    logger.info("Verification Logic: Performing verification...", { recommendedType: analysis.recommendedType });
    let status: VerificationResult['status'] = 'skipped';
    let details: string = 'Verification skipped.';

    // Use a specific User-Agent
    const userAgent = 'Ajantic-Implementation-Consultant/1.0';

    try {
        if (analysis.recommendedType === "api") {
            // TODO: Improve endpoint extraction logic
            let endpoint = analysis.strategyDetails.match(/https?:\/\/[^\s'"]+/)?.[0]; // Basic URL extraction
            if(!endpoint && analysis.strategyDetails.toLowerCase().includes("endpoint")) {
                // Maybe add more sophisticated regex or parsing if needed
                endpoint = "https://placeholder.needs_better_extraction.com/api"; // Fallback placeholder
            }


            if (endpoint) {
                logger.debug(`Verification Logic: Checking API endpoint: ${endpoint}`);
                // Basic HEAD request (less data, checks reachability and headers)
                // Using timeout is important for external requests
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

                try {
                     const response = await fetch(endpoint, {
                         method: 'HEAD',
                         headers: {'User-Agent': userAgent},
                         signal: controller.signal // Add timeout signal
                     });
                     clearTimeout(timeoutId); // Clear timeout if fetch completes

                    if (response.ok || response.status === 401 || response.status === 403) { // Accept OK, Unauthorized, Forbidden as "reachable"
                        status = 'success';
                        details = `API Endpoint (${endpoint}) check successful (Status: ${response.status}). Server responded.`;
                    } else {
                        status = 'failure';
                        details = `API Endpoint (${endpoint}) check failed (Status: ${response.status}). Server responded with error.`;
                    }
                } catch (fetchError: any) {
                     clearTimeout(timeoutId); // Clear timeout on error too
                     status = 'failure';
                     if (fetchError.name === 'AbortError') {
                         details = `API Endpoint (${endpoint}) check failed (Request timed out after 5s).`;
                     } else {
                         details = `API Endpoint (${endpoint}) check failed (Network Error: ${fetchError.message}). Check DNS, CORS, or URL validity.`;
                     }
                }
            } else {
                // If API type but no endpoint found, consider it a verification failure to trigger detailed search.
                status = 'failure'; 
                details = 'Verification Failed: Could not determine a valid API endpoint from the current analysis details. A more detailed search may be required.';
                 logger.warn("Verification Logic: Could not extract endpoint for API verification, marking as failure.", { details: analysis.strategyDetails });
            }
        } else if (analysis.recommendedType === "function") {
            // TODO: Improve scraping detection logic
            const isScraping = analysis.strategyDetails.toLowerCase().includes("scrape") ||
                               analysis.strategyDetails.toLowerCase().includes("fetch") ||
                               analysis.strategyDetails.toLowerCase().includes("cheerio") ||
                               analysis.strategyDetails.toLowerCase().includes("firecrawl") ||
                               analysis.strategyDetails.toLowerCase().includes("visual");

             // TODO: Improve target URL extraction logic
            let targetUrl = toolRequest.inputs.find((inp: ToolInputParameter) => inp.name.toLowerCase().includes('url'))?.default as string;
            if (!targetUrl) {
                 targetUrl = analysis.strategyDetails.match(/https?:\/\/[^\s'"]+/)?.[0] || ""; // Try extracting from details
            }
            if(!targetUrl && isScraping){
                 targetUrl = "https://placeholder.needs_url_extraction.com"; // Fallback placeholder
            }


            if (isScraping && targetUrl) {
                 logger.debug(`Verification Logic: Checking target URL for scraping: ${targetUrl}`);
                 const controller = new AbortController();
                 const timeoutId = setTimeout(() => controller.abort(), 8000); // Slightly longer timeout for scraping targets

                 try {
                    const response = await fetch(targetUrl, {
                        headers: {'User-Agent': userAgent}, // Basic User-Agent
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);

                    if (response.ok) {
                        status = 'success';
                        details = `Target URL (${targetUrl}) basic check successful (Status: ${response.status}).`;
                        // TODO: Add basic block page detection by checking response text/title
                    } else {
                        status = 'failure';
                        details = `Target URL (${targetUrl}) check failed (Status: ${response.status}). Might be blocked or incorrect.`;
                    }
                 } catch (fetchError: any) {
                     clearTimeout(timeoutId);
                     status = 'failure';
                     if (fetchError.name === 'AbortError') {
                         details = `Target URL (${targetUrl}) check failed (Request timed out after 8s).`;
                     } else {
                         details = `Target URL (${targetUrl}) check failed (Network Error: ${fetchError.message}). Check DNS or URL validity.`;
                     }
                 }
            } else {
                 status = 'skipped';
                 details = 'Verification skipped for non-scraping function or missing/unextractable URL.';
            }
        }
    } catch (error) {
        logger.error("Verification Logic: Error during verification process", { error });
        status = 'failure';
        details = `Verification process failed with error: ${error instanceof Error ? error.message : String(error)}`;
    }

    logger.info("Verification Logic: Verification complete", { status, details });
    return { status, details };
}

export async function TOOLS_performBasicVerification(
    analysis: AnalysisResult,
    toolRequest: ToolRequest
): Promise<VerificationResult | null> {
  return performVerification(analysis, toolRequest);
}
