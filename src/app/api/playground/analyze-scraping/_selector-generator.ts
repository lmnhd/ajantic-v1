import { LanguageModel, generateObject } from 'ai';
import { MODEL_JSON, UTILS_getModelArgsByName } from '@/src/lib/utils';
import { MODEL_getModel_ai } from '@/src/lib/vercelAI-model-switcher';
import { logger } from '@/src/lib/logger';
import { SelectorOutputSchema } from './_types'; // Import schema from local types file
import { ModelArgs } from '@/src/lib/types';

// Constants
const MAX_HTML_CHARS_FOR_AI = 30000; // Limit HTML characters sent to AI

// generateSelectors Helper
export async function generateSelectors(html: string, description: string): Promise<Record<string, string> | null> {
    logger.log("Generating selectors based on description:", {description});

    // --- Select Model (Simplified) ---
    let model: LanguageModel;
    try {
        const modelConfig: ModelArgs = UTILS_getModelArgsByName(MODEL_JSON().OpenAI["gpt-4.5-preview"].name); // Or gpt-4o etc.
        if (!modelConfig) {
            throw new Error("Model configuration for gpt-4-turbo-preview not found in MODEL_JSON.");
        }
        model = await MODEL_getModel_ai(modelConfig);
    } catch (modelError) {
        logger.error("Failed to get model for selector generation:", {modelError});
        return null;
    }
    // --- End Select Model ---

    // Truncate HTML if too long
    const truncatedHtml = html.length > MAX_HTML_CHARS_FOR_AI
        ? html.substring(0, MAX_HTML_CHARS_FOR_AI) + "\n... [HTML Truncated] ..."
        : html;

    const systemPrompt = `You are an expert web scraper assisting in generating selectors. Analyze the provided HTML structure and the user's data request. Identify the most robust Cheerio selectors (compatible with the Node.js 'cheerio' library) to extract the requested data. Output ONLY a valid JSON object mapping descriptive keys (camelCase, based on the requested data) to the CSS selector strings. Ensure keys are descriptive and values are valid CSS selectors. Do not include any explanation or surrounding text. If you cannot determine appropriate selectors based on the HTML and description, return an empty JSON object {}.`;

    const userPrompt = `User Request: "${description}"

HTML Content (potentially truncated):
\`\`\`html
${truncatedHtml}
\`\`\`

Generate the Cheerio selectors as a JSON object:`;

    try {
        logger.debug(`Calling ${model.modelId} with generateObject for selector generation...`);
        const { object: parsedSelectors, usage } = await generateObject({
            model: model,
            schema: SelectorOutputSchema,
            system: systemPrompt,
            prompt: userPrompt,
            temperature: 0.1,
            maxRetries: 1,
        });

        logger.debug("Selector generation AI usage:", usage);
        logger.log("Parsed selectors from AI:", parsedSelectors);

        if (Object.keys(parsedSelectors).length === 0) {
             logger.log("AI returned empty object, indicating no selectors found.");
             return {};
        }
        return parsedSelectors;

    } catch (error: any) {
        logger.error("Error during generateObject call for selectors:", { error });
        if (error.cause) { logger.error("generateObject Cause:", error.cause); }
        if (error.value) { logger.error("generateObject Invalid Value:", error.value); }
        return null;
    }
} 