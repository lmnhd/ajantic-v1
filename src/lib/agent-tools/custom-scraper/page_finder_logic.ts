import {
  PageFindingStrategy,
  SourceFindingStrategyType,
  UrlPatternConfig,
  SiteSearchConfig,
  SitemapConfig,
  WebSearchConfig,
  LlmNavigationConfig,
  SourceFinderConfig, // Import the main config holder
  // We'll need to import specific config types for each strategy later from ./types
  // e.g., UrlPatternConfig, SiteSearchConfig, etc.
} from './types';

// Placeholder for actual credential type/interface if needed
type FetchedCredentials = Record<string, string | null>; 

interface PageFinderResult {
  url: string | null;
  error?: string;
  strategyUsed?: SourceFindingStrategyType;
}

/**
 * Attempts to find the target page URL using a series of configured strategies.
 * Iterates through the strategies in order until a URL is found or all strategies are exhausted.
 */
export async function findPageSource(
  baseDomain: string,
  agentQuery: string,
  strategies: PageFindingStrategy[], // The ordered list of strategies to try
  sourceFinderOverallConfig: SourceFinderConfig, // The complete config block for all strategies
  credentials?: FetchedCredentials | null,
  // TODO: Pass LanguageModel instance if needed for LLM-guided navigation or analysis
  // languageModel?: LanguageModel,
  // TODO: Pass specific config objects from SourceFinderConfig if not fully encapsulated in PageFindingStrategy.input
  // urlPatternConfigs?: UrlPatternConfig[], 
  // siteSearchConfig?: SiteSearchConfig,
  // etc.
): Promise<PageFinderResult> {
  console.log(`[PageFinder] Starting page search for domain '${baseDomain}' with query '${agentQuery}'`);
  const strategyErrors: string[] = []; // Initialize an array to collect errors from each strategy

  for (const strategyInfo of strategies) {
    // Ensure strategyInfo and strategyType are defined before destructuring or using
    if (!strategyInfo || typeof strategyInfo.strategyType === 'undefined') {
      const undefinedStrategyError = "SourceFinderConfig: Encountered an undefined or invalid strategy object in enabledStrategies.";
      console.warn(`[PageFinder] ${undefinedStrategyError}`, { strategyInfo });
      strategyErrors.push(undefinedStrategyError);
      continue; // Skip this invalid strategy entry
    }
    const { strategyType, input: strategyDirectInput } = strategyInfo;
    let result: PageFinderResult = { url: null };

    console.log(`[PageFinder] Attempting strategy: ${strategyType}`);

    try {
      switch (strategyType) {
        case SourceFindingStrategyType.CONFIGURED_URL_PATTERNS:
          result = await _handleConfiguredUrlPatterns(
            baseDomain, 
            agentQuery, 
            sourceFinderOverallConfig.urlPatterns,
            strategyDirectInput // Could be specific overrides or query details
          );
          break;
        case SourceFindingStrategyType.SITE_SPECIFIC_SEARCH:
          result = await _handleSiteSpecificSearch(
            baseDomain, 
            agentQuery, 
            sourceFinderOverallConfig.siteSearch,
            credentials
            // strategyDirectInput might contain specific search terms if different from agentQuery
          );
          break;
        case SourceFindingStrategyType.SEMANTIC_SITEMAP_TRAVERSAL:
          result = await _handleSemanticSitemapTraversal(
            baseDomain, 
            agentQuery, 
            sourceFinderOverallConfig.sitemap
          );
          break;
        case SourceFindingStrategyType.GENERAL_WEB_SEARCH:
          result = await _handleGeneralWebSearch(
            baseDomain, 
            agentQuery, 
            sourceFinderOverallConfig.webSearch
          );
          break;
        case SourceFindingStrategyType.LLM_GUIDED_NAVIGATION:
          result = await _handleLlmGuidedNavigation(
            baseDomain, 
            agentQuery, 
            sourceFinderOverallConfig.llmNavigation,
            credentials 
            // languageModel would be passed here
          );
          break;
        default:
          console.warn(`[PageFinder] Unknown or unsupported strategy type: ${strategyType}`);
          result = { url: null, error: `Unknown strategy: ${strategyType}` };
      }

      if (result.url) {
        console.log(`[PageFinder] URL found using strategy ${strategyType}: ${result.url}`);
        return { ...result, strategyUsed: strategyType };
      } else if (result.error) {
        const specificError = `${strategyType}: ${result.error}`;
        console.log(`[PageFinder] Strategy ${strategyType} failed: ${result.error}`);
        strategyErrors.push(specificError); // Add specific error to the list
      } else {
        const noUrlMsg = `${strategyType}: Completed but found no URL.`;
        console.log(`[PageFinder] ${noUrlMsg}`);
        strategyErrors.push(noUrlMsg); // Also record if a strategy just didn't find anything
      }

    } catch (error: any) {
      const catchError = `${strategyType}: Exception during execution - ${error.message}`;
      console.error(`[PageFinder] Error executing strategy ${strategyType}: `, error);
      strategyErrors.push(catchError); // Add exception details
    }
  }

  console.log(`[PageFinder] All strategies exhausted. No URL found for query: '${agentQuery}' on domain '${baseDomain}'.`);
  let finalErrorMessage = "All page finding strategies exhausted.";
  if (strategyErrors.length > 0) {
    finalErrorMessage += "\nAttempted strategies and their outcomes:\n" + strategyErrors.map(e => `- ${e}`).join("\n");
  }
  return { url: null, error: finalErrorMessage };
}

// --- Placeholder Helper Functions for each strategy ---

async function _handleConfiguredUrlPatterns(
    baseDomain: string, 
    agentQuery: string, 
    patternsArray?: UrlPatternConfig[], 
    strategyInput?: any // strategyInput could be used for more complex input mapping if needed
): Promise<PageFinderResult> {
  if (!patternsArray || patternsArray.length === 0) {
    return { url: null, error: "URL patterns array is not configured or is empty." };
  }

  console.log(`[PageFinder][UrlPatterns] Evaluating ${patternsArray.length} URL pattern(s).`);

  const commonAccessDeniedMessages = [
    "permission to access this resource",
    "access denied",
    "forbidden",
    "not authorized",
    "unauthorized"
  ];

  // Ensure pattern-specific errors are detailed enough
  let patternSpecificErrors: string[] = [];

  for (const patternConfig of patternsArray) {
    let targetUrlString = patternConfig.pattern;
    const placeholder = '${query}'; // Using a simple placeholder for now

    if (patternConfig.mapsToInput && strategyInput && typeof strategyInput === 'object' && strategyInput !== null && patternConfig.mapsToInput in strategyInput) {
        // If mapsToInput is specified and exists in strategyInput, use that value
        targetUrlString = targetUrlString.replace(placeholder, encodeURIComponent(String(strategyInput[patternConfig.mapsToInput as keyof typeof strategyInput])));
        console.log(`[PageFinder][UrlPatterns] Generated URL from pattern "${patternConfig.name}" using mapped input "${patternConfig.mapsToInput}": ${targetUrlString}`);
    } else if (targetUrlString.includes(placeholder)) {
        // Fallback to agentQuery if placeholder exists and no specific mapping or mapping failed
        targetUrlString = targetUrlString.replace(placeholder, encodeURIComponent(agentQuery));
        console.log(`[PageFinder][UrlPatterns] Generated URL from pattern "${patternConfig.name}" using agentQuery: ${targetUrlString}`);
    } else {
        // If the pattern doesn't have the placeholder, it might be a static URL.
        console.log(`[PageFinder][UrlPatterns] Pattern "${patternConfig.name}" (value: ${targetUrlString}) does not contain placeholder '${placeholder}'. Evaluating as a static URL.`);
    }

    if (!targetUrlString.startsWith('http://') && !targetUrlString.startsWith('https://')) {
      console.warn(`[PageFinder][UrlPatterns] Pattern "${patternConfig.name}" generated/is an invalid URL (doesn't start with http/https): ${targetUrlString}`);
      patternSpecificErrors.push(`Pattern '${patternConfig.name}': Invalid URL generated: ${targetUrlString.substring(0,50)}...`);
      continue; // Try next pattern
    }

    try {
      // Attempt to fetch the URL
      // Consider adding a timeout to the fetch request if it becomes an issue.
      const response = await fetch(targetUrlString, { method: 'GET' }); // Using GET to check content for 403s

      if (response.ok) { // Status 200-299
        if (targetUrlString.includes(baseDomain)) {
          console.log(`[PageFinder][UrlPatterns] Pattern "${patternConfig.name}" yielded valid URL within base domain: ${targetUrlString}`);
          return { url: targetUrlString, strategyUsed: SourceFindingStrategyType.CONFIGURED_URL_PATTERNS };
        } else {
          const msg = `Pattern '${patternConfig.name}': URL ${targetUrlString.substring(0,50)}... is outside baseDomain ${baseDomain}.`;
          console.log(`[PageFinder][UrlPatterns] ${msg}`);
          patternSpecificErrors.push(msg);
        }
      } else if (response.status === 403) {
        const bodyText = await response.text();
        const deniedMessageFound = commonAccessDeniedMessages.some(msg => bodyText.toLowerCase().includes(msg));
        const msg = `Pattern '${patternConfig.name}' (${targetUrlString.substring(0,50)}...): Resulted in 403 Forbidden` + (deniedMessageFound ? ' (Access Denied message found in body).' : '.');
        console.warn(`[PageFinder][UrlPatterns] ${msg}`);
        patternSpecificErrors.push(msg);
      } else {
        const msg = `Pattern '${patternConfig.name}' (${targetUrlString.substring(0,50)}...): Fetch failed with status ${response.status}: ${response.statusText}.`;
        console.warn(`[PageFinder][UrlPatterns] ${msg}`);
        patternSpecificErrors.push(msg);
      }
    } catch (error: any) {
      const msg = `Pattern '${patternConfig.name}' (${targetUrlString.substring(0,50)}...): Error during fetch - ${error.message}.`;
      console.error(`[PageFinder][UrlPatterns] ${msg}`);
      patternSpecificErrors.push(msg);
    }
  }

  // If loop finishes, no URL was returned
  if (patternSpecificErrors.length > 0) {
    return { url: null, error: `No suitable URL from patterns. Issues encountered:\n` + patternSpecificErrors.map(e => `  - ${e}`).join('\n') };
  }
  return { url: null, error: "No suitable URL generated from configured patterns after evaluation and fetching (and no specific errors recorded during pattern checks)." };
}

async function _handleSiteSpecificSearch(
    baseDomain: string, 
    agentQuery: string, 
    config?: SiteSearchConfig,
    credentials?: FetchedCredentials | null
): Promise<PageFinderResult> {
  if (!config) {
    return { url: null, error: "Site-specific search strategy is not configured." };
  }

  const {
    searchPageUrl,
    searchInputSelector,
    searchSubmitSelector,
    resultsContainerSelector, // Optional
    resultLinkSelector,
    resultTitleSelector,     // Optional, for LLM
    resultSnippetSelector    // Optional, for LLM
  } = config;

  if (!searchInputSelector || !searchSubmitSelector || !resultLinkSelector) {
    return { url: null, error: "Essential selectors (searchInput, searchSubmit, resultLink) are not configured for site-specific search." };
  }

  console.log(`[PageFinder][SiteSearch] Attempting site-specific search on domain '${baseDomain}' for query '${agentQuery}'.`);

  // 1. Determine the actual search page URL
  let actualSearchPageUrl = searchPageUrl;
  if (!actualSearchPageUrl) {
    // Basic assumption: search is often at the root or a common path like /search
    // This might need to be more sophisticated or require searchPageUrl to be always set.
    // For now, let's assume it's the baseDomain if searchPageUrl is not provided,
    // implying the search bar is directly on the homepage or a known page.
    // A more robust solution would be needed here, potentially trying common paths.
    actualSearchPageUrl = baseDomain.startsWith('http') ? baseDomain : `https://${baseDomain}`;
    console.log(`[PageFinder][SiteSearch] No specific searchPageUrl provided, using base domain: ${actualSearchPageUrl}`);
  } else if (!actualSearchPageUrl.startsWith('http')) {
    // If searchPageUrl is relative, prepend baseDomain
    const R_SLASH = '/';
    actualSearchPageUrl = (baseDomain.endsWith(R_SLASH) ? baseDomain.slice(0,-1) : baseDomain) + (actualSearchPageUrl.startsWith(R_SLASH) ? actualSearchPageUrl : R_SLASH + actualSearchPageUrl);
    console.log(`[PageFinder][SiteSearch] Relative searchPageUrl provided, constructed full URL: ${actualSearchPageUrl}`);
  }


  // TODO: Implement Puppeteer/Playwright or Firecrawl (if it supports this flow) logic here
  // This section would involve:
  // 1. Launching a browser instance.
  // 2. Navigating to `actualSearchPageUrl`.
  // 3. Typing `agentQuery` into `searchInputSelector`.
  // 4. Clicking `searchSubmitSelector`.
  // 5. Waiting for results (e.g., for `resultsContainerSelector` or `resultLinkSelector` to appear).
  // 6. Extracting data:
  //    - Iterate over elements matching `resultsContainerSelector` (if provided) then `resultLinkSelector`.
  //    - For each result, get the `href` from the element matching `resultLinkSelector`.
  //    - Optionally, get text from `resultTitleSelector` and `resultSnippetSelector`.
  // 7. Close the browser.

  console.warn('[PageFinder][SiteSearch] Puppeteer/browser automation logic for site search needs to be implemented.');

  // Placeholder for extracted search results
  interface ExtractedSearchResult {
    link: string;
    title?: string;
    snippet?: string;
  }
  const extractedResults: ExtractedSearchResult[] = [];

  // --- SIMULATION of browser automation ---
  // This is a mock simulation. Replace with actual browser automation.
  if (actualSearchPageUrl && searchInputSelector && searchSubmitSelector && resultLinkSelector) {
    // Simulate finding one result for now
    const mockLink = new URL(actualSearchPageUrl); // ensure it's a valid URL object
    // try to make a plausible link based on the query
    mockLink.pathname = (mockLink.pathname === '/' ? '' : mockLink.pathname) + '/search-result-page';
    mockLink.searchParams.set('q', agentQuery.replace(/\s+/g, '-').toLowerCase());
    
    extractedResults.push({
        link: mockLink.toString(),
        title: `Simulated result for: ${agentQuery}`,
        snippet: "This is a simulated search result snippet. Implement real browser automation."
    });
    console.log(`[PageFinder][SiteSearch] Simulated finding one result: ${extractedResults[0].link}`);
  }
  // --- END SIMULATION ---


  if (extractedResults.length === 0) {
    console.log('[PageFinder][SiteSearch] No results found after (simulated) site search.');
    return { url: null, error: "No results found from (simulated) site-specific search." }; // Made error more specific
  }

  // TODO: Implement LLM analysis of extractedResults if titles/snippets are available
  // This would involve:
  // 1. Checking if `resultTitleSelector` and `resultSnippetSelector` were used and yielded data.
  // 2. Formatting the titles/snippets and the `agentQuery` for an LLM prompt.
  // 3. Sending to an LLM to choose the best link.
  // 4. If LLM provides a choice, use that link.

  if (resultTitleSelector || resultSnippetSelector) {
      console.warn('[PageFinder][SiteSearch] LLM-based selection of search results needs to be implemented.');
  }

  // For now, return the first found link
  const firstResultUrl = extractedResults[0].link;

  // Basic validation and normalization of the URL
  try {
    const url = new URL(firstResultUrl, actualSearchPageUrl); // Resolve relative URLs against the search page
    const validatedUrl = url.toString();
    console.log(`[PageFinder][SiteSearch] Successfully found URL: ${validatedUrl}`);
    return { url: validatedUrl, strategyUsed: SourceFindingStrategyType.SITE_SPECIFIC_SEARCH };
  } catch (e: any) {
    console.error(`[PageFinder][SiteSearch] Invalid URL found: ${firstResultUrl}. Error: ${e.message}`);
    return { url: null, error: `Site search found an invalid URL: ${firstResultUrl.substring(0,100)}... (Error: ${e.message})` };
  }
}

async function _handleSemanticSitemapTraversal(
    baseDomain: string, 
    agentQuery: string, 
    config?: SitemapConfig
): Promise<PageFinderResult> {
  if (!config) {
    return { url: null, error: "Sitemap traversal strategy is not configured." };
  }
  // TODO: Implement sitemap fetch, parse, embed, and search logic
  console.warn('[PageFinder] Strategy SEMANTIC_SITEMAP_TRAVERSAL not fully implemented.');
  return { url: null, error: "SEMANTIC_SITEMAP_TRAVERSAL: Not implemented." }; // Added prefix
}

async function _handleGeneralWebSearch(
    baseDomain: string, 
    agentQuery: string, 
    config?: WebSearchConfig
): Promise<PageFinderResult> {
  if (!config) {
    return { url: null, error: "General web search strategy is not configured." };
  }
  // TODO: Implement Perplexity/Google Search API integration
  // For now, return a mock success for testing purposes:
  const mockUrl = `https://www.google.com/search?q=${encodeURIComponent(agentQuery)}+site:${baseDomain}`;
  console.warn(`[PageFinder] Strategy GENERAL_WEB_SEARCH not fully implemented. Returning mock URL: ${mockUrl}`);
  // To simulate a potential failure for testing error accumulation:
  // return { url: null, error: "GENERAL_WEB_SEARCH: API key missing for external search provider (Simulated Error)." };
  return { url: mockUrl, strategyUsed: SourceFindingStrategyType.GENERAL_WEB_SEARCH };
}

async function _handleLlmGuidedNavigation(
    baseDomain: string, 
    agentQuery: string, 
    config?: LlmNavigationConfig,
    credentials?: FetchedCredentials | null
    // languageModel?: LanguageModel,
): Promise<PageFinderResult> {
  if (!config) {
    return { url: null, error: "LLM-guided navigation strategy is not configured." };
  }
  // TODO: Implement complex LLM-driven navigation logic
  console.warn('[PageFinder] Strategy LLM_GUIDED_NAVIGATION not fully implemented.');
  return { url: null, error: "LLM_GUIDED_NAVIGATION: Not implemented." }; // Added prefix
}
