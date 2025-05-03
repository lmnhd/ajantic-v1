import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/src/lib/logger';
import {
    analyzeRequestSchema,
    AnalysisResult,
    PreliminaryCheckResult,
    FirecrawlCheckResult
} from './_types'; // Import types
import { readStreamChunk } from './_stream-utils'; // Import stream util
import { executeFirecrawlScrape } from '../../../../lib/agent-tools/helpers/_firecrawl-helper'; // Import firecrawl helper
import { generateSelectors } from './_selector-generator'; // Import selector generator

// Constants
const MAX_HTML_SIZE_BYTES = 2 * 1024 * 1024; // 2MB limit for HTML processing (Keep here or move to a config file)


export async function POST(req: NextRequest) {
    logger.log("Received request for /api/playground/analyze-scraping"); // Use logger

    // 1. Auth and Validation
    let requestBody: any;
    try {
        requestBody = await req.json();
    } catch (error: any) {
        logger.error("Failed to parse request body:", {error}); // Use logger
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const validationResult = analyzeRequestSchema.safeParse(requestBody);
    if (!validationResult.success) {
        logger.error("Request validation failed:", validationResult.error.flatten()); // Use logger
        return NextResponse.json(
            { error: 'Invalid request body', details: validationResult.error.flatten() },
            { status: 400 }
        );
    }
    const { userId, targetUrl, dataDescription } = validationResult.data;
    // TODO: Add proper user auth validation here
    logger.log(`Starting analysis for URL: ${targetUrl} by User: ${userId}`); // Use logger


    // 2. Perform Initial Fetch Test
    let preliminaryResult: PreliminaryCheckResult = { accessible: false, htmlProcessed: false };
    let responseClone: Response | null = null;

    try {
        const response = await fetch(targetUrl, {
             method: 'GET',
             headers: { /* ... keep headers ... */
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
             },
             redirect: 'follow',
             signal: AbortSignal.timeout(10000), // 10 seconds timeout
        });
        responseClone = response.clone();

        logger.log(`Initial fetch status for ${targetUrl}: ${response.status}`); // Use logger
        const contentType = response.headers.get('content-type');
        const contentLengthHeader = response.headers.get('content-length');
        const contentLength = contentLengthHeader ? parseInt(contentLengthHeader, 10) : null;

        preliminaryResult = {
            accessible: response.ok,
            statusCode: response.status,
            contentType: contentType,
            isLikelyBlockPage: false,
            htmlProcessed: false,
        };

        if (response.ok && contentType && contentType.toLowerCase().includes('html')) {
            const bodyExcerpt = await readStreamChunk(response.body, 4096); // Use imported helper
            preliminaryResult.bodyExcerpt = bodyExcerpt;

            // Block Page Checks
            const bodyLower = bodyExcerpt.toLowerCase();
             if (bodyLower.includes('<title>just a moment...</title>') || bodyLower.includes('checking your browser') || bodyLower.includes('cloudflare')) {
                 preliminaryResult.isLikelyBlockPage = true;
                 preliminaryResult.blockReason = "Cloudflare or similar JS/Browser challenge detected";
             } else if (bodyLower.includes('access denied') || bodyLower.includes('forbidden')) {
                 preliminaryResult.isLikelyBlockPage = true;
                 preliminaryResult.blockReason = "Access Denied/Forbidden page detected";
             } else if (bodyLower.includes('captcha')) {
                 preliminaryResult.isLikelyBlockPage = true;
                 preliminaryResult.blockReason = "CAPTCHA challenge detected";
             }

            // Get Full HTML
            if (!preliminaryResult.isLikelyBlockPage) {
                if (contentLength !== null && contentLength > MAX_HTML_SIZE_BYTES) {
                    logger.warn(`HTML content length (${contentLength} bytes) exceeds limit. Skipping full read.`); // Use logger
                    preliminaryResult.error = `HTML content too large (${contentLength} bytes) for analysis.`;
                    preliminaryResult.htmlProcessed = true;
                } else {
                    try {
                        logger.log(`Attempting to read full HTML for ${targetUrl}...`); // Use logger
                        preliminaryResult.htmlContent = await responseClone.text();
                        preliminaryResult.htmlProcessed = true;
                        logger.log(`Successfully read full HTML content (${preliminaryResult.htmlContent.length} chars).`); // Use logger
                    } catch (readError: any) {
                        logger.error(`Error reading full HTML body for ${targetUrl}:`, readError); // Use logger
                        preliminaryResult.error = `Failed to read full HTML body: ${readError.message}`;
                        preliminaryResult.htmlProcessed = true;
                    }
                }
            } else {
                preliminaryResult.htmlProcessed = true;
            }
        } else if (!response.ok) {
            preliminaryResult.error = `Request failed with status ${response.status}`;
            preliminaryResult.htmlProcessed = true;
            if (contentLength !== null && contentLength < 1024) {
                try { preliminaryResult.error += `: ${await responseClone.text()}`; } catch { /* ignore */ }
            }
        } else {
            preliminaryResult.htmlProcessed = true;
        }
    } catch (error: any) {
        logger.error(`Initial fetch failed for ${targetUrl}:`, error); // Use logger
        preliminaryResult = {
            accessible: false,
            error: error.message || 'Unknown fetch error',
            statusCode: error.cause?.code || undefined,
            isLikelyBlockPage: false,
            htmlProcessed: true,
        };
        if (error.name === 'AbortError' || error.message.includes('timed out')) {
            preliminaryResult.error = 'Fetch timed out (10s)';
        }
    }


    // 3. Perform Firecrawl Check
    let firecrawlCheck: FirecrawlCheckResult = { attempted: false };
    const shouldAttemptFirecrawl = preliminaryResult.isLikelyBlockPage || preliminaryResult.error?.includes('timed out') || (preliminaryResult.accessible && !preliminaryResult.htmlContent);
    if (shouldAttemptFirecrawl) {
        firecrawlCheck.attempted = true;
        const firecrawlApiKey = process.env.FIRECRAWL_API_KEY; // Ensure this is set in your env
        const fcResult = await executeFirecrawlScrape(targetUrl, firecrawlApiKey); // Use imported helper
        firecrawlCheck = { ...firecrawlCheck, ...fcResult };
    }


    // 4. Generate Selectors
    let suggestedSelectors: AnalysisResult['suggestedSelectors'] = null;
    let potentialIssues: AnalysisResult['potentialIssues'] = []; // Initialize issues array

    if (preliminaryResult.htmlContent && dataDescription) {
        logger.log(`Attempting to generate selectors for ${targetUrl}...`); // Use logger
        try {
           suggestedSelectors = await generateSelectors(preliminaryResult.htmlContent, dataDescription); // Use imported helper
           if (suggestedSelectors === null) {
                logger.warn("Selector generation failed."); // Use logger
                potentialIssues.push("An error occurred during selector generation.");
           } else if (Object.keys(suggestedSelectors).length === 0) {
               logger.log("Selector generation returned empty object."); // Use logger
               potentialIssues.push("Could not automatically determine specific selectors.");
           } else {
               logger.log("Successfully generated selectors."); // Use logger
           }
        } catch (selectorError: any) {
           logger.error("Error calling generateSelectors function:", selectorError); // Use logger
           potentialIssues.push(`Error during selector generation: ${selectorError.message}`);
           suggestedSelectors = null;
        }
    } else if (preliminaryResult.htmlProcessed && !preliminaryResult.htmlContent && dataDescription && !preliminaryResult.error?.includes('HTML content too large')) {
         potentialIssues.push("Could not generate selectors because full HTML failed to load.");
    } else if (preliminaryResult.accessible && !preliminaryResult.isLikelyBlockPage && !dataDescription) {
        // Only add this issue if simple fetch worked and HTML *could* have been processed
         potentialIssues.push("Provide a data description to attempt selector generation.");
    }


    // 5. Determine Final Analysis and Suggestions
    let finalMessage: string = '';
    let suggestedMethod: AnalysisResult['suggestedMethod'] = 'Undetermined';

    // Consolidate potential issues from preliminary check if error occurred
    if (preliminaryResult.error && !preliminaryResult.accessible) {
        potentialIssues.push(`Initial Check Failed: ${preliminaryResult.error}`);
    }
     if (preliminaryResult.isLikelyBlockPage && preliminaryResult.blockReason) {
        potentialIssues.push(`Initial Check Blocked: ${preliminaryResult.blockReason}`);
     }


    if (firecrawlCheck.attempted && firecrawlCheck.success) {
        finalMessage = `Analysis complete. Firecrawl successfully scraped the page.`;
        suggestedMethod = 'Firecrawl Helper Function';
        potentialIssues.push("Site requires JS rendering or advanced anti-bot handling.");
         if (suggestedSelectors && Object.keys(suggestedSelectors).length > 0) {
             finalMessage += ` (Selectors generated from initial HTML as fallback).`;
         }
    } else if (preliminaryResult.accessible && !preliminaryResult.isLikelyBlockPage && preliminaryResult.htmlContent) {
        finalMessage = `Analysis complete. Preliminary check suggests site is accessible via simple fetch.`;
        suggestedMethod = 'Standard Fetch / Cheerio';
        potentialIssues.push("Verify JS rendering not needed for critical content."); // Add this potential issue
        if (suggestedSelectors && Object.keys(suggestedSelectors).length > 0) {
            finalMessage += ` Suggested Cheerio selectors generated.`;
            suggestedMethod = 'Standard Fetch / Cheerio with Provided Selectors';
        } else if (dataDescription) {
             finalMessage += ` Could not auto-generate selectors.`;
             // Issue already added
        } else {
            finalMessage += ` HTML accessible, but no description provided for selector generation.`;
            // Issue already added
        }
    } else if (firecrawlCheck.attempted && !firecrawlCheck.success) {
        finalMessage = `Analysis complete. Firecrawl failed to scrape (${firecrawlCheck.error}).`;
        suggestedMethod = 'Manual Investigation / Advanced Techniques';
        potentialIssues.push(`Firecrawl Failed: ${firecrawlCheck.error}`);
        finalMessage += ` Manual investigation or advanced techniques (e.g., Puppeteer/visual analysis) recommended.`;
    } else { // Catch-all for initial failure where Firecrawl wasn't attempted or also failed implicitly
        finalMessage = `Analysis failed. Could not access or process the target URL effectively.`;
        suggestedMethod = 'Manual Investigation / Verify URL';
        // Issues should already be in the array from preliminary checks
    }

    // Add a summary of potential issues to the main message
    if (potentialIssues.length > 0) {
        finalMessage += ` Potential Issues: ${potentialIssues.join('; ')}.`;
    } else if (suggestedMethod !== 'Manual Investigation / Verify URL') {
         finalMessage += ` No immediate issues detected, proceed with suggested method carefully.`
    }


    // 6. Construct Final Response
    const analysisResponse: AnalysisResult = {
        status: (preliminaryResult.accessible || (firecrawlCheck.attempted && firecrawlCheck.success)) ? 'success' : 'error',
        message: finalMessage,
        // Omit large HTML content from final response sent to client
        preliminaryCheck: preliminaryResult ? { ...preliminaryResult, htmlContent: undefined } : undefined,
        firecrawlCheck: firecrawlCheck.attempted ? firecrawlCheck : undefined,
        suggestedMethod: suggestedMethod,
        potentialIssues: potentialIssues,
        suggestedSelectors: suggestedSelectors,
    };

    logger.log(`Analysis complete for ${targetUrl}. Final Result:`, {analysisResponse}); // Use logger

    return NextResponse.json(analysisResponse, { status: 200 });
}