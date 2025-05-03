import { logger } from '@/src/lib/logger';
import { LanguageModel } from 'ai';
import { generateObject, generateText } from 'ai';
import { MODEL_JSON, UTILS_getModelArgsByName } from '@/src/lib/utils';
import { MODEL_getModel_ai } from '@/src/lib/vercelAI-model-switcher';
import { z } from 'zod';
// Import the global Puppeteer client/page getters
import { GLOBAL_getPuppeteerClient, GLOBAL_getPuppeteerPage } from '@/src/lib/puppeteer_client';
import { Page } from 'puppeteer-core'; // Import Page type
import { ModelArgs } from '../../types';

// Constants
const PUPPETEER_TIMEOUT = 30000; // Keep timeout consistent

// Schema for the final structured output (keep existing)
const StructuredDataSchema = z.record(
    z.string(), z.any()
).describe("A JSON object containing the structured data extracted based on the user's request.");


// Internal helper: Extract text using Vision LLM (Keep largely the same, ensure model selection is robust)
async function _extractTextWithVisualLLM(url: string, dataDescription: string, screenshotBase64: string): Promise<string | null> {
    logger.log(`[Visual Scraper] Extracting text for ${url} using Visual LLM.`);
    let visionModel: LanguageModel;
    try {
        // Ensure you have a vision-capable model configured in MODEL_JSON
        const modelConfig: ModelArgs = UTILS_getModelArgsByName(MODEL_JSON().OpenAI["gpt-4o"].name); // Example
        if (!modelConfig) {
            throw new Error("Vision model configuration not found in MODEL_JSON.");
        }
        visionModel = await MODEL_getModel_ai(modelConfig);
    } catch (modelError) {
        logger.error("[Visual Scraper] Failed to get vision model:", { modelError });
        return null;
    }

    const visionPrompt = `Analyze the attached screenshot of the webpage at ${url}. Based *only* on the visual information in the image, extract the text content relevant to the following request: "${dataDescription}". Output *only* the extracted text, without any formatting, explanations, or apologies if data is missing.`;

    try {
        logger.debug(`[Visual Scraper] Calling vision model ${visionModel.modelId} for text extraction...`);
        const response = await generateText({
            model: visionModel,
            messages: [
                {
                    role: 'user',
                    content: [
                         { type: 'text', text: visionPrompt },
                         { type: 'image', image: Buffer.from(screenshotBase64, 'base64') },
                    ]
                }
             ]
        });
        const extractedText = response?.text?.trim();
        if (!extractedText) {
            logger.warn(`[Visual Scraper] Vision model did not return text for ${url}.`);
            return null;
        }
        logger.log(`[Visual Scraper] Successfully extracted raw text (${extractedText.length} chars) for ${url}.`);
        return extractedText;
    } catch (error) {
        logger.error(`[Visual Scraper] Error calling vision model for ${url}:`, { error });
        return null;
    }
}

// Internal helper: Structure extracted text (Keep the same)
async function _structureExtractedText(rawText: string, dataDescription: string): Promise<Record<string, any> | null> {
     logger.log(`[Visual Scraper] Structuring raw text based on description: "${dataDescription}"`);
     let textModel: LanguageModel;
     try {
        const modelConfig: ModelArgs = UTILS_getModelArgsByName(MODEL_JSON().OpenAI["gpt-4.5-preview"].name); // Or other suitable model
        if (!modelConfig) throw new Error("Text structuring model configuration not found.");
        textModel = await MODEL_getModel_ai(modelConfig);
     } catch (modelError) {
        logger.error("[Visual Scraper] Failed to get text structuring model:", { modelError });
        return null;
     }

    const systemPrompt = `You are a data structuring assistant. Given raw text extracted from a webpage and an original user request, format the relevant information from the text into a clean JSON object according to the user's request. Only include data explicitly mentioned or clearly implied by the request. Ignore irrelevant text. Output *only* the valid JSON object.`;
    const userPrompt = `Original User Request: "${dataDescription}"\n\nRaw Extracted Text:\n---\n${rawText.substring(0, 10000)}${rawText.length > 10000 ? '... [Text Truncated]' : ''}\n---\n\nGenerate the structured JSON object:`;

     try {
        logger.debug(`[Visual Scraper] Calling model ${textModel.modelId} with generateObject for structuring...`);
        const { object: structuredData } = await generateObject({
            model: textModel, schema: StructuredDataSchema, system: systemPrompt, prompt: userPrompt, temperature: 0.1, maxRetries: 1,
        });
        logger.log(`[Visual Scraper] Successfully structured data:`, structuredData);
        return structuredData;
     } catch (error) {
        logger.error(`[Visual Scraper] Error structuring text with generateObject:`, { error });
        return null;
     }
}

/**
 * Runtime helper function for generated tools to perform visual scraping
 * using the globally managed Puppeteer/Browserbase instance and a Visual LLM.
 * Intended as a last resort.
 *
 * @param params - An object containing the URL and data description.
 * @param params.url - The URL to scrape visually.
 * @param params.dataDescription - A description of the data to extract.
 * @returns The structured data extracted from the page, or null on failure.
 * @throws Throws error on critical issues like page navigation failure.
 */
export async function executeVisualScrape(params: {
    url: string;
    dataDescription: string;
}): Promise<Record<string, any> | null> {
    const { url, dataDescription } = params;
    logger.log(`[Visual Scraper] Starting visual scrape for: ${url}`);
    let page: Page | null = null;

    try {
        // --- Get Managed Page ---
        // Assumes GLOBAL_getPuppeteerClient has been called appropriately
        // elsewhere based on environment (e.g., during agent setup/request handling)
        // to initialize either local Puppeteer or Browserbase connection.
        logger.debug("[Visual Scraper] Getting managed Puppeteer page...");
        page = await GLOBAL_getPuppeteerPage();
        page.setDefaultNavigationTimeout(PUPPETEER_TIMEOUT);
        page.setDefaultTimeout(PUPPETEER_TIMEOUT);
        logger.debug("[Visual Scraper] Got managed page.");
        // --- End Get Managed Page ---

        // --- Navigate and Screenshot ---
        logger.log(`[Visual Scraper] Navigating managed page to ${url}...`);
        // Use try-catch specifically around navigation as it's a common failure point
        try {
            await page.goto(url, { waitUntil: 'networkidle0', timeout: PUPPETEER_TIMEOUT });
        } catch(navError) {
             logger.error(`[Visual Scraper] Navigation failed for ${url}:`, { navError });
             throw new Error(`Navigation to ${url} failed: ${navError instanceof Error ? navError.message : String(navError)}`);
        }
        logger.log(`[Visual Scraper] Navigation complete. Taking screenshot...`);
        await page.waitForTimeout(1000); // Small delay for rendering

        const screenshotResult = await page.screenshot({ encoding: 'base64' });

        // --- Linter Fix Start ---
        if (typeof screenshotResult !== 'string') {
            logger.error(`[Visual Scraper] Failed to get base64 screenshot for ${url}. Received type: ${typeof screenshotResult}`);
            return null; // Cannot proceed
        }
        const screenshotBase64: string = screenshotResult; // Now confirmed as string
        logger.debug(`[Visual Scraper] Screenshot taken (${screenshotBase64.length} base64 chars).`);
        // --- Linter Fix End ---

        // --- Process with AI ---
        const rawText = await _extractTextWithVisualLLM(url, dataDescription, screenshotBase64);
        if (!rawText) {
            logger.warn(`[Visual Scraper] Failed to extract raw text using vision model for ${url}.`);
            return null;
        }

        const structuredData = await _structureExtractedText(rawText, dataDescription);
        if (!structuredData) {
            logger.warn(`[Visual Scraper] Failed to structure extracted text for ${url}.`);
            return null;
        }
        // --- End Process with AI ---

        logger.log(`[Visual Scraper] Visual scrape completed successfully for ${url}.`);
        return structuredData;

    } catch (error: any) {
        // Catch errors from navigation or other issues
        logger.error(`[Visual Scraper] Critical error during visual scrape helper execution for ${url}:`, error);
        // Do NOT close the browser here, as it's managed globally.
        // Just return null to indicate failure to the calling tool.
        return null;
    }
    // NOTE: No browser.close() here - the lifecycle is managed by GLOBAL_getPuppeteerClient
}
