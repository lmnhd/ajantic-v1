import {
  ScrapingToolImplementationConfig,
  // DataExtractionChainStep, // No longer directly used here
  // PageFindingStrategy, // No longer directly used here
  // ScrapingActionType, // No longer directly used here
  // SourceFindingStrategyType, // No longer directly used here
  // AuthMethod, // No longer directly used here
} from './types';
import { findPageSource } from './page_finder_logic';
// import { executeScrapingAction } from './scraper_actions'; // No longer directly called from here
import { getDecryptedCredential } from '../../security/credentials';

// Import new handlers/orchestrators
import { performAuthentication, AuthContext } from './auth_handler';
import { getContent, ScrapedContentResult } from './content_scraper';
import { processDataExtractionChain, ExtractionResult } from './data_extractor';

export type FetchedCredentials = Record<string, string | null>;

interface ScrapingToolInput {
  query: string;
  [key: string]: any;
}

// Export this interface
export interface ScrapingToolOutput {
  scrapedData: string | null;
  sourceUrl?: string;
  errors?: string[];
}

export async function executeScrapingTool(
  clerkId: string,
  config: ScrapingToolImplementationConfig,
  input: ScrapingToolInput,
): Promise<ScrapingToolOutput> {
  const {
    baseDomain,
    sourceFinderConfig,
    authConfig,
    scrapingMethodsConfig,
    dataExtractionChain,
  } = config;
  const { query } = input;
  const errors: string[] = [];
  let finalTargetUrl: string | undefined = undefined;

  // --- 1. Fetch Credentials --- (Existing logic, slightly adapted)
  let fetchedCredentials: FetchedCredentials = {};
  if (authConfig.requiredCredentialNames && authConfig.requiredCredentialNames.length > 0) {
    if (!clerkId) {
      errors.push("Credentials required by tool, but clerkId (userId) is missing.");
      return { scrapedData: null, errors };
    }
    console.log(`[ExecutionLogic] Fetching ${authConfig.requiredCredentialNames.length} required credentials for clerkId: ${clerkId}`);
    for (const credName of authConfig.requiredCredentialNames) {
      try {
        const decryptedValue = await getDecryptedCredential(clerkId, credName);
        fetchedCredentials[credName] = decryptedValue;
        if (decryptedValue === null) {
          const errMsg = `Credential '${credName}': Not found or decryption failed.`;
          console.warn(`[ExecutionLogic] ${errMsg}`);
          errors.push(errMsg);
        }
      } catch (error: any) {
        const errMsg = `Credential '${credName}': Error - ${error.message}`;
        console.error(`[ExecutionLogic] ${errMsg}`);
        errors.push(errMsg);
        fetchedCredentials[credName] = null;
      }
    }
    // Potentially add an early exit if a critical number of credentials failed
    // For example: if (errors.length > 0 && authConfig.some_flag_indicating_all_creds_are_critical) return { ... }
  } else {
    console.log("[ExecutionLogic] No credentials required by this tool configuration.");
  }

  // --- 2. Find Target Page URL --- (Existing logic, adapted)
  console.log("[ExecutionLogic] Step 1: Finding target page URL.");
  const pageFinderResult = await findPageSource(
    baseDomain,
    query,
    sourceFinderConfig.enabledStrategies,
    sourceFinderConfig,
    fetchedCredentials,
  );

  if (!pageFinderResult.url) {
    const pfError = pageFinderResult.error ? `Page finding failed: ${pageFinderResult.error}` : 'Page finding failed: No suitable page found to scrape.';
    errors.push(pfError);
    return { scrapedData: null, errors, sourceUrl: pageFinderResult.url ?? undefined };
  }
  if (pageFinderResult.error) {
      errors.push(`Page finder warning: ${pageFinderResult.error}`);
  }
  finalTargetUrl = pageFinderResult.url;
  console.log(`[ExecutionLogic] Target URL found: ${finalTargetUrl}`);

  // --- 3. Perform Authentication --- (New Step)
  console.log("[ExecutionLogic] Step 2: Performing authentication.");
  const authContext: AuthContext = await performAuthentication(
    authConfig,
    baseDomain,
    fetchedCredentials
  );

  if (authContext.error) {
    const authErrorMsg = `Authentication (Method: ${authConfig.method}) failed: ${authContext.error}`;
    errors.push(authErrorMsg);
    console.warn(`[ExecutionLogic] ${authErrorMsg}. Proceeding with caution.`);
    // Depending on severity, might return early if auth is critical and failed
    // if (authConfig.method !== 'none' && /* some other critical flags */) return { scrapedData: null, errors, sourceUrl: finalTargetUrl };
  }

  // --- 4. Get Initial Page Content --- (New Step)
  console.log("[ExecutionLogic] Step 3: Getting initial page content.");
  const contentResult: ScrapedContentResult = await getContent(
    finalTargetUrl,
    scrapingMethodsConfig,
    authContext,
    query,
    fetchedCredentials
  );

  if (contentResult.error) {
    const contentErrorMsg = `Content scraping (Method: ${scrapingMethodsConfig.preferredMethod}) failed for URL ${finalTargetUrl}: ${contentResult.error}`;
    errors.push(contentErrorMsg);
  }
  if (contentResult.content === null && !contentResult.error) {
    errors.push(`Content scraping (Method: ${scrapingMethodsConfig.preferredMethod}) for URL ${finalTargetUrl} returned no data and no specific error.`);
  }

  // --- 5. Process Data through Extraction Chain --- (New Step)
  console.log("[ExecutionLogic] Step 4: Processing data extraction chain.");
  const extractionResult: ExtractionResult = await processDataExtractionChain(
    contentResult.content,
    contentResult.contentType,
    dataExtractionChain,
    finalTargetUrl,
    query,
    authContext,
    fetchedCredentials
  );

  if (extractionResult.errors && extractionResult.errors.length > 0) {
    extractionResult.errors.forEach(err => errors.push(`Data extraction failed: ${err}`));
  }

  // TODO: Implement closing of Puppeteer session if authContext.puppeteerPage was created and needs cleanup
  // if (authContext.puppeteerPage) { closeAuthSession(authContext); }

  console.log("[ExecutionLogic] Scraping process completed.");
  return {
    scrapedData: extractionResult.finalData,
    sourceUrl: finalTargetUrl,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// Main placeholder can be removed or updated if direct testing is needed from this file.
// The mockConfig and its direct call to executeScrapingAction is no longer representative.
/*
async function main() {
  const mockClerkId = 'user_test_123';
  const mockConfig: ScrapingToolImplementationConfig = {
    implementationType: "scraping",
    baseDomain: "example.com",
    toolPurposeDescription: "Test scraper",
    sourceFinderConfig: {
      enabledStrategies: [
        { strategyType: SourceFindingStrategyType.CONFIGURED_URL_PATTERNS, input: "test" }
      ],
      urlPatterns: [
          { name: "Test Pattern", pattern: "https://example.com/search?q=\${query}", mapsToInput: "query"}
      ]
    },
    authConfig: { method: AuthMethod.NONE, requiredCredentialNames: [] },
    scrapingMethodsConfig: {
      preferredMethod: 'directHttpFetch',
      directHttpFetch: { headers: { 'User-Agent': 'TestScraper/1.0' } }
    },
    dataExtractionChain: [
      {
        stepName: "Get Page Title (Example LLM Extract)",
        actionType: ScrapingActionType.LLM_EXTRACT_FROM_DATA,
        actionConfig: {
          extractionPrompt: "Extract the HTML <title> tag content from the provided HTML document."
        },
        inputSource: 'initialPage'
      }
    ]
  };
  const mockInput: ScrapingToolInput = { query: "some test search" };

  console.log("--- Mock Execution Start ---");
  const output = await executeScrapingTool(mockClerkId, mockConfig, mockInput);
  console.log("--- Mock Execution End ---");
  console.log("Output:", JSON.stringify(output, null, 2));
}

// main().catch(console.error);
*/
