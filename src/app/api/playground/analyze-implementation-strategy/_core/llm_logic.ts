import { ToolRequest, ToolInputParameter } from "@/src/lib/types";
import { ConsultationHistory } from "../_types";
import { logger } from "@/src/lib/logger";
import { generateObject } from 'ai';
import { MODEL_getModel_ai } from '@/src/lib/vercelAI-model-switcher';
import { UTILS_getModelArgsByName, MODEL_JSON } from '@/src/lib/utils';
import { z } from 'zod';

// --- Start MINIMAL Refactored Schema for testing discriminated union application ---
const baseStrategySchemaMinimal = z.object({
    reasoning: z.string().describe("Detailed explanation."),
    warnings: z.array(z.string()).optional().describe("Potential issues."),
});

const apiStrategySchemaMinimal = baseStrategySchemaMinimal.extend({
    recommendedType: z.literal("api").describe("API strategy."),
    apiEndpointUrl: z.string().describe("API URL. If a specific endpoint for the exact operation isn't known, provide the base URL for the API service or the main API documentation page."),
    requiredCredentialName: z.string().optional().nullable().describe("If the API call itself requires a direct credential (like an API key in a header or a basic auth username/password to be encoded for the API service itself), specify the single credential name here (e.g., 'SERVICE_API_KEY'). This is NOT for OAuth or complex multi-step auth flows, nor for website form logins."),
});

const functionStrategySchemaMinimal = baseStrategySchemaMinimal.extend({
    recommendedType: z.literal("function").describe("Function strategy."),
    coreLogicOutline: z.string().optional().describe("Core logic outline."),
    // If a function needs to call an API that requires a simple key, it can also have requiredCredentialName.
    requiredCredentialName: z.string().optional().nullable().describe("If the function internally calls an API that needs a simple key, specify it here."),
});

const scrapingStrategySchemaMinimal = baseStrategySchemaMinimal.extend({
    recommendedType: z.literal("scraping").describe("Scraping strategy."),
    suggestedBaseDomain: z.string().optional().describe("Suggested base domain for scraping."),
    scrapingMethodHint: z.enum(["firecrawl", "visual", "directHttpFetch"]).optional().describe("Scraping method hint."),
    authRequiresPuppeteer: z.boolean().optional().describe("If scraping requires login, especially form-based login that needs browser automation, set this to true. This often implies the need for username/password type credentials specified in 'suggestedScrapingCredentialPairs'."),
    exampleTargetPageUrl: z.string().url().optional().describe("If scraping, an example URL (e.g., from a logged-in session) where target data is found. This strongly hints at authentication needs and structure."),
    requiredCredentialName: z.string().optional().nullable().describe("Use this ONLY if a scraping *service* (like Firecrawl if it had its own key separate from environment, or another 3rd party scraper) requires a direct API key for THAT SERVICE. Do NOT use for target website credentials."),
    suggestedScrapingCredentialPairs: z.array(z.object({ name: z.string(), label: z.string() })).optional().describe("If scraping requires login via a website form (e.g., username & password), provide an array of suggested credential names and labels. Example: [{name: 'TARGETSITE_USERNAME', label: 'Target Site Username'}, {name: 'TARGETSITE_PASSWORD', label: 'Target Site Password'}]. This is typical if 'authRequiresPuppeteer' is true."),
});

const unknownStrategySchemaMinimal = baseStrategySchemaMinimal.extend({
    recommendedType: z.literal("unknown").describe("Unknown strategy."),
});

const errorStrategySchemaMinimal = baseStrategySchemaMinimal.extend({
    recommendedType: z.literal("error").describe("Error during analysis."),
});

const llmStrategySuggestionSchema = z.discriminatedUnion("recommendedType", [
    apiStrategySchemaMinimal,
    functionStrategySchemaMinimal,
    scrapingStrategySchemaMinimal,
    unknownStrategySchemaMinimal,
    errorStrategySchemaMinimal,
]).describe("Overall recommended strategy.");
// --- End MINIMAL Refactored Schema ---

// --- Define a wrapper schema for the LLM output ---
const LlmOutputSchema = z.object({
  strategyDecision: llmStrategySuggestionSchema,
}).describe("Wrapper for the LLM's structured output, ensuring the root is an object.");
// --- End wrapper schema ---

// Type for the structured response from the LLM (this remains the type of the actual strategy decision)
type LLMStrategySuggestion = z.infer<typeof llmStrategySuggestionSchema>;

export async function LLM_generateStrategySuggestion(
  toolRequest: ToolRequest,
  preliminaryFindings: string,
  newStrategyModifications: string[],
  consultationHistory: ConsultationHistory,
): Promise<LLMStrategySuggestion> {
  logger.info("LLM_logic: Generating strategy suggestion...", { toolName: toolRequest.name });

  const historySummary = ""; // Placeholder for actual summarization logic if needed
  const parametersString = toolRequest.inputs.length > 0
    ? toolRequest.inputs.map((p: ToolInputParameter) => `- ${p.name} (${p.type}): ${p.description}${p.required === false ? ' (optional)' : ''}`).join('\n')
    : '  (No input parameters defined)';

  const systemPrompt = `
<purpose>
    You are an expert at analyzing tool implementation strategies.
    Your goal is to recommend the most appropriate implementation type (api, function, or scraping) based on the tool request and research findings.
</purpose>

<instructions>
    <instruction>Analyze the tool request and preliminary research findings carefully.</instruction>
    <instruction>Recommend a \`recommendedType\` from: "api", "function", "scraping", "unknown", or "error".</instruction>
    <instruction>Provide detailed \`reasoning\` for your choice.</instruction>
    <instruction>
        If recommending "api", you MUST provide an \`apiEndpointUrl\`. 
        - If a specific, publicly queryable endpoint for the exact operation is found, use that.
        - If not, but a general API service, developer portal, or documentation page exists that is relevant, provide that URL. Clearly state in your \`reasoning\` and \`warnings\` that this is a general API page and why a specific endpoint isn\'t listed (e.g., requires auth to see, part of a larger SDK, etc.).
    </instruction>
    <instruction>If recommending "function", provide a \`coreLogicOutline\`.</instruction>
    <instruction>If recommending "scraping", provide \`suggestedBaseDomain\` and optionally a \`scrapingMethodHint\`. Consider if \`authRequiresPuppeteer\` is true.</instruction>
    <instruction>If recommending "scraping" and the user or research provides an \`exampleTargetPageUrl\` (check preliminary research), include this as it is crucial for config generation. This URL strongly hints at authentication methods (like form login) and data structure.</instruction>
    <instruction>
        If recommending "scraping" and \`authRequiresPuppeteer\` is true, or if the \`exampleTargetPageUrl\` or research findings suggest interactive/form-based login (e.g., username/password), you SHOULD populate \`suggestedScrapingCredentialPairs\` with relevant pairs (e.g., [{name: \"TARGETSITE_USERNAME\", label: \"Target Site Username\"}, {name: \"TARGETSITE_PASSWORD\", label: \"Target Site Password\"}]). 
        Use the singular \`requiredCredentialName\` field for scraping ONLY if the scraping mechanism itself (e.g., a third-party scraping API/service) requires its own direct API key, NOT for the target website\'s user credentials.
    </instruction>
    <instruction>
        CRITICAL: Evaluate API suitability for the *specific tool purpose*. If an API exists but:
        a) Does not directly address the core tool purpose (e.g., API is for account management, but tool needs product metrics),
        b) Requires overly complex authentication/setup for the tool's likely context,
        c) Has prohibitive rate limits or usage restrictions for the tool's intended use,
        d) Requires extensive data transformation to be useful,
        then strongly consider recommending "function" (which might wrap the API for basic data retrieval) or "scraping". Your \`reasoning\` must clearly justify this choice over a direct "api" recommendation.
    </instruction>
    <instruction>Use the examples to understand how to make these decisions.</instruction>
</instructions>

<examples>
    <example>
        <scenario>When NOT to recommend 'api'</scenario>
        <tool-purpose>Analyze ClickBank marketplace product metrics like gravity score.</tool-purpose>
        <research-finding>ClickBank has an API, but it's for managing developer accounts and sales, not for querying product metrics.</research-finding>
        <recommendation>Do NOT recommend 'api'. Instead, recommend 'scraping' (if direct marketplace access is feasible) or 'function' (if a more complex approach is needed).</recommendation>
    </example>

    <example>
        <scenario>When to recommend 'api'</scenario>
        <tool-purpose>Get real-time stock price data for a given ticker symbol.</tool-purpose>
        <research-finding>Alpha Vantage provides a well-documented REST API with endpoints specifically for real-time stock data, including price, volume, and technical indicators.</research-finding>
        <recommendation>Recommend 'api' with apiEndpointUrl pointing to the Alpha Vantage stock data endpoint, as the API directly provides the exact data needed.</recommendation>
    </example>

    <example>
        <scenario>When to recommend 'function'</scenario>
        <tool-purpose>Calculate compound interest with customizable parameters for principal, rate, time, and compounding frequency.</tool-purpose>
        <research-finding>No specific API exists for this calculation, and the formula is well-defined mathematically.</research-finding>
        <recommendation>Recommend 'function' with a coreLogicOutline describing the compound interest formula implementation.</recommendation>
    </example>

    <example>
        <scenario>When API exists but has complex authentication</scenario>
        <tool-purpose>Fetch user's GitHub repository statistics and activity metrics.</tool-purpose>
        <research-finding>GitHub's API provides this data, but requires OAuth2 authentication, user consent, and specific scopes. The API endpoints are well-documented but implementing the full OAuth2 flow would be complex.</research-finding>
        <recommendation>Recommend 'function' with a coreLogicOutline that includes handling the OAuth2 flow, as the authentication complexity makes a pure API approach impractical.</recommendation>
    </example>

    <example>
        <scenario>When API exists but has restrictive rate limits</scenario>
        <tool-purpose>Monitor and analyze real-time social media trends across multiple platforms.</tool-purpose>
        <research-finding>Twitter's API provides trend data, but has strict rate limits (450 requests per 15-minute window) that would be insufficient for real-time monitoring of multiple trends.</research-finding>
        <recommendation>Recommend 'scraping' with suggestedBaseDomain pointing to the public trends page, as the API's rate limits make it unsuitable for the tool's real-time monitoring purpose.</recommendation>
    </example>

    <example>
        <scenario>When API exists but requires significant data transformation</scenario>
        <tool-purpose>Generate a unified product catalog from multiple supplier databases.</tool-purpose>
        <research-finding>Each supplier has an API, but they use different data formats, field names, and categorization systems. The APIs provide raw data that needs extensive normalization and mapping.</research-finding>
        <recommendation>Recommend 'function' with a coreLogicOutline that includes data normalization logic, as the core challenge is transforming and unifying the data rather than just fetching it.</recommendation>
    </example>
</examples>

<tool-request>
    <name>${toolRequest.name}</name>
    <description>${toolRequest.description}</description>
    <purpose>${toolRequest.purpose || toolRequest.description}</purpose>
    <inputs>
${parametersString}
    </inputs>
    <expected-output>${toolRequest.expectedOutput}</expected-output>
</tool-request>

<preliminary-research>
${preliminaryFindings}
(Note: User might have provided an example URL for a page showing the target data, possibly after login or navigation. If such a URL is available and relevant for scraping, capture it as 'exampleTargetPageUrl' in the scraping strategy, and consider its implications for authentication, especially for populating 'suggestedScrapingCredentialPairs'.)
</preliminary-research>

Output ONLY the JSON object matching the schema.
`;

  const modelArgs = UTILS_getModelArgsByName(MODEL_JSON().Anthropic['claude-3-7-sonnet-20250219']?.name ?? "anthropic:claude-3-7-sonnet-20250219");
  const model = await MODEL_getModel_ai(modelArgs);

  try {
    logger.debug("LLM_logic: Calling generateObject for strategy suggestion", { model: modelArgs.modelName });
    const { object } = await generateObject({
         model: model,
         schema: LlmOutputSchema, // Use the new wrapper schema
         prompt: systemPrompt,
         temperature: modelArgs.temperature ?? 0.5,
         // Consider adding maxRetries if not default in generateObject or if issues persist
         // maxRetries: 2, 
    });
    
    // Basic validation to ensure we have an object and the nested strategyDecision
    if (typeof object !== 'object' || object === null || !('strategyDecision' in object)) {
        logger.error("LLM_logic: generateObject returned an invalid structure or was missing strategyDecision.", { object });
        throw new Error("LLM failed to return a valid strategy suggestion structure including strategyDecision.");
    }
    
    // Validate the entire object against the LlmOutputSchema
    const parseResult = LlmOutputSchema.safeParse(object);
    if (!parseResult.success) {
        logger.error("LLM_logic: generateObject response did not conform to the LlmOutputSchema.", { 
            errors: parseResult.error.flatten(), 
            receivedObject: object 
        });
        // Construct a more informative error message from Zod errors
        const errorMessages = parseResult.error.errors.map(e => `${e.path.join('.')} T: ${(object as any)?.strategyDecision?.recommendedType}: ${e.message}`).join('; ');
        throw new Error(`LLM response did not match the expected schema. Issues: ${errorMessages}`);
    }

    // Extract the actual strategy suggestion from the wrapper
    const strategySuggestion = parseResult.data.strategyDecision;

    logger.info("LLM_logic: Strategy suggestion successful", { type: strategySuggestion.recommendedType });
    return strategySuggestion; // Return the validated and typed strategy decision

  } catch (error) {
    logger.error("LLM_logic: generateObject failed", { error: error instanceof Error ? error.message : String(error) });
    // Construct a default error response that matches the errorStrategySchemaMinimal (which is part of LLMStrategySuggestion)
    const errorResponse: LLMStrategySuggestion = {
         recommendedType: "error",
         reasoning: `Failed to get strategy suggestion from LLM: ${error instanceof Error ? error.message : String(error)}`,
         // warnings: ["LLM strategy suggestion failed."], // optional
     };
    return errorResponse;
  }
}
