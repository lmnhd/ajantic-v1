// src/app/api/playground/analyze-implementation-strategy/_core/utils/site_analyzer.ts
import { logger } from "@/src/lib/logger";

/**
 * Performs a quick, lightweight analysis of a target URL to detect common
 * scraping blockers or patterns like login forms.
 * This is used by the analysis_logic to provide hints to the main LLM consultant.
 *
 * @param url The URL to analyze.
 * @returns An object containing analysis results.
 */
export async function quickSiteAnalysis(url: string): Promise<{
    isLikelyBlockPage: boolean;
    blockReason?: string;
    suggestedScrapingMethodHint?: 'firecrawl' | 'visual' | 'directHttpFetch';
    authDetected?: boolean; // Basic detection, e.g., keywords in forms
}> {
    if (!url || !url.startsWith('http')) {
         logger.debug(`Site Analyzer: Skipping analysis for invalid or missing URL: ${url}`);
         return { isLikelyBlockPage: false };
    }
    logger.debug(`Site Analyzer: Performing quick analysis for ${url}`);
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                // Use a common, non-bot-like user agent
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'en-US,en;q=0.9',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1',
            },
            redirect: 'follow',
            signal: AbortSignal.timeout(7000), // 7 seconds timeout
        });

        const contentType = response.headers.get('content-type');
        if (!response.ok || !contentType || !contentType.toLowerCase().includes('html')) {
            logger.warn(`Site Analyzer: Non-HTML or error response for ${url}`, { status: response.status, contentType });
            // Don't assume it's blocked, just that we can't analyze the HTML
            return { isLikelyBlockPage: false, blockReason: `Non-HTML/Error Response (Status: ${response.status})` };
        }

        // Read a chunk to check for obvious blockers/patterns
        // Reading up to ~100KB might catch more patterns without being excessive
        const maxRead = 100 * 1024;
        const reader = response.body?.getReader();
        let receivedLength = 0;
        const chunks: Uint8Array[] = [];

        if (reader) {
            try {
                while (receivedLength < maxRead) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    chunks.push(value);
                    receivedLength += value.length;
                }
            } finally {
                reader.releaseLock(); // Ensure lock is released even if loop exits early
            }
        } else {
            logger.warn(`Site Analyzer: Could not get reader for response body of ${url}`);
            return { isLikelyBlockPage: false, blockReason: "Could not read response body." };
        }


        const buffer = new Uint8Array(receivedLength);
        let position = 0;
        for (const chunk of chunks) {
            buffer.set(chunk, position);
            position += chunk.length;
        }
        // Use try-catch for decoding as it might fail with partial multibyte chars at the boundary
        let bodyExcerpt = '';
        try {
            bodyExcerpt = new TextDecoder("utf-8", { fatal: false }).decode(buffer); // Use non-fatal decode
        } catch (decodeError) {
             logger.warn(`Site Analyzer: Decoding error for ${url}`, { error: decodeError });
             // Attempt latin1 as a fallback for simple keyword checks if needed
             try { bodyExcerpt = new TextDecoder("latin1").decode(buffer); } catch { /* ignore secondary decode error */ }
        }

        const bodyLower = bodyExcerpt.toLowerCase();

        // Cloudflare / JS Challenge Checks
        if (bodyLower.includes('<title>just a moment...</title>') ||
            bodyLower.includes('checking your browser before accessing') ||
            bodyLower.includes('data-cf-settings') || // Common Cloudflare marker
            bodyLower.includes('cdn-cgi/challenge-platform')) {
            logger.debug(`Site Analyzer: Detected Cloudflare/JS challenge for ${url}`);
            return { isLikelyBlockPage: true, blockReason: "Cloudflare or JS challenge", suggestedScrapingMethodHint: 'firecrawl' };
        }
        // Access Denied / Forbidden Checks
        if (bodyLower.includes('access denied') || bodyLower.includes('forbidden') || bodyLower.includes('<title>403 forbidden</title>')) {
            logger.debug(`Site Analyzer: Detected Access Denied/Forbidden for ${url}`);
            return { isLikelyBlockPage: true, blockReason: "Access Denied/Forbidden page" };
        }
        // CAPTCHA Checks
        if (bodyLower.includes('captcha') || bodyLower.includes('recaptcha') || bodyLower.includes('hcaptcha') || bodyLower.includes('turnstile')) {
            logger.debug(`Site Analyzer: Detected CAPTCHA for ${url}`);
            return { isLikelyBlockPage: true, blockReason: "CAPTCHA detected", suggestedScrapingMethodHint: 'visual' };
        }
        // Basic Login Form Detection
        const authDetected = (bodyLower.includes('<form') && (
                                bodyLower.includes('login') ||
                                bodyLower.includes('signin') ||
                                bodyLower.includes('sign in') ||
                                bodyLower.includes('password') ||
                                bodyLower.includes('username') ||
                                bodyLower.includes('user_name') ||
                                bodyLower.includes('email')
                             )) ||
                             bodyLower.includes('sign in with google') || // Common OAuth prompt
                             bodyLower.includes('log in with facebook'); // Common OAuth prompt


        if (authDetected) {
             logger.debug(`Site Analyzer: Detected potential Auth Form for ${url}`);
        }

        // If no specific blockers found, suggest direct fetch might work
        return { isLikelyBlockPage: false, authDetected, suggestedScrapingMethodHint: 'directHttpFetch' };

    } catch (error: any) {
        logger.warn(`Site Analyzer: Fetch error during quick analysis for ${url}`, { message: error.message });
        let reason = `Fetch error: ${error.message}`;
        if (error.name === 'AbortError') {
            reason = 'Fetch timed out (7s)';
        }
        // Don't assume blockage on fetch error, just note the error
        return { isLikelyBlockPage: false, blockReason: reason };
    }
}