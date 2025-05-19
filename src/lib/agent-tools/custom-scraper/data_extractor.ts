import {
  DataExtractionChainStep,
  // FetchedCredentials, // Incorrect import
  ScrapingActionType,
} from './types';
import { FetchedCredentials } from './execution_logic'; // Corrected import
import { AuthContext } from './auth_handler'; // May be needed if visual steps use an existing Puppeteer page
import { executeScrapingAction } from './scraper_actions';

export interface ExtractionResult {
  finalData: string | null;
  errors?: string[];
}

/**
 * Processes the data through a chain of extraction steps.
 *
 * @param initialContent The initial raw content (e.g., HTML, Markdown) obtained from the content scraper.
 * @param initialContentType The MIME type of the initial content.
 * @param dataExtractionChain The array of extraction steps to perform.
 * @param targetUrl The original URL the content was scraped from (for context or re-fetching if needed by an action).
 * @param agentQuery The overall query from the agent, for context in LLM extraction steps.
 * @param authContext Potential authentication context (e.g., Puppeteer page for visual actions).
 * @param credentials Fetched credentials, for actions that might need them directly.
 * @returns A Promise resolving to the final extracted data string.
 */
export async function processDataExtractionChain(
  initialContent: string | null,
  initialContentType: string | undefined,
  dataExtractionChain: DataExtractionChainStep[],
  targetUrl: string,
  agentQuery: string,
  authContext: AuthContext, // Pass this along
  credentials: FetchedCredentials,
  // TODO: Add languageModel client if LLM_EXTRACT_FROM_DATA uses a local/non-Firecrawl LLM
): Promise<ExtractionResult> {
  let currentData: string | null = initialContent;
  let previousStepOutput: string | null = initialContent;
  const errors: string[] = [];

  if (!dataExtractionChain || dataExtractionChain.length === 0) {
    console.log('[DataExtractor] No data extraction chain defined, returning initial content.');
    // If initialContent is null and no chain, it means content scraping likely failed.
    if (initialContent === null) {
        errors.push('Initial content was null and no data extraction chain was defined.');
    }
    return { finalData: initialContent, errors: errors.length > 0 ? errors : undefined };
  }

  console.log(`[DataExtractor] Starting data extraction chain with ${dataExtractionChain.length} steps.`);

  for (let i = 0; i < dataExtractionChain.length; i++) {
    const step = dataExtractionChain[i];
    console.log(`[DataExtractor] Executing step ${i + 1}/${dataExtractionChain.length}: ${step.actionType} - ${step.stepName}`);

    // Determine input for the current step
    const inputForThisStep = step.inputSource === 'previousStepOutput' ? previousStepOutput : initialContent;

    if (inputForThisStep === null && step.actionType === ScrapingActionType.LLM_EXTRACT_FROM_DATA) {
        const errorMsg = `Skipping LLM_EXTRACT_FROM_DATA step "${step.stepName}" because previous step data is null.`;
        console.warn(`[DataExtractor] ${errorMsg}`);
        errors.push(errorMsg);
        // currentData remains null, previousStepOutput remains null
        continue; // Move to next step
    }
    // Potentially add similar checks for other action types that require non-null input from previous step

    try {
      // Some actions might need targetUrl (e.g. if they re-fetch or use it as context)
      // Others might primarily operate on previousStepOutput (e.g. LLM_EXTRACT_FROM_DATA)
      const actionResult = await executeScrapingAction(
        step.actionType,
        targetUrl, // Pass targetUrl for context or if action re-fetches
        step.actionConfig,
        agentQuery,
        inputForThisStep, // Use the determined input for this step
        credentials,
        // TODO: Pass languageModel if the action needs it
        // TODO: Pass authContext.puppeteerPage if action is VISUAL_SCRAPE_EXTRACT and needs it
      );

      if (actionResult.error) {
        const errorMsg = `Error in data extraction step ${i + 1} (${step.stepName} - ${step.actionType}): ${actionResult.error}`;
        console.warn(`[DataExtractor] ${errorMsg}`);
        errors.push(errorMsg);
        // Decide if we should stop the chain on error. For now, update currentData and continue.
      }
      
      currentData = actionResult.data; // Always update currentData with the latest result from the action
      previousStepOutput = actionResult.data; // The output of this step becomes previousStepOutput for the next

      if (currentData !== null) {
        console.log(`[DataExtractor] Step ${i + 1} (${step.stepName}) produced data.`);
      } else {
        console.log(`[DataExtractor] Step ${i + 1} (${step.stepName}) produced no data (or cleared it).`);
      }

    } catch (error: any) {
      const errorMsg = `Failed to execute data extraction step ${i + 1} (${step.stepName} - ${step.actionType}): ${error.message}`;
      console.error(`[DataExtractor] ${errorMsg}`, error);
      errors.push(errorMsg);
      // If an unhandled exception occurs, we stop the chain.
      // currentData will remain as it was from the last successful interaction with executeScrapingAction.
      break;
    }
  }

  console.log('[DataExtractor] Data extraction chain completed.');
  return {
    finalData: currentData,
    errors: errors.length > 0 ? errors : undefined,
  };
} 