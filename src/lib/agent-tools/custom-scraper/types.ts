// src/lib/agent-tools/scraping-tool/types.ts

/**
 * Defines the available types of scraping methods.
 */
export enum ScrapingMethodType {
    FIRECRAWL_REQUEST = 'firecrawl', // For making requests via Firecrawl (scrape or crawl)
    VISUAL_SCRAPE_EXTRACT = 'visual',  // For visual scraping and extraction
    DIRECT_HTTP_REQUEST = 'directHttpFetch', // For direct HTTP GET/POST, etc.
}

/**
 * Defines the types of actions that can be performed in a data extraction chain.
 */
export enum ScrapingActionType {
    // Page finding / initial content retrieval actions
    NAVIGATE_TO_URL = 'NAVIGATE_TO_URL', // Directly navigate to a specified URL
    PERFORM_SITE_SEARCH = 'PERFORM_SITE_SEARCH', // Perform a search on the target site
    FETCH_WITH_FIRECRAWL = 'FETCH_WITH_FIRECRAWL', // Use Firecrawl to get initial page content (scrape or crawl)
    FETCH_WITH_DIRECT_HTTP = 'FETCH_WITH_DIRECT_HTTP', // Use direct HTTP to get content
    
    // Data extraction & transformation actions
    EXTRACT_WITH_LLM = 'EXTRACT_WITH_LLM', // Use an LLM to extract structured data from text/HTML
    EXTRACT_WITH_VISUAL_MODEL = 'EXTRACT_WITH_VISUAL_MODEL', // Use a visual model to extract from screenshot
    EXTRACT_WITH_CSS_SELECTOR = 'EXTRACT_WITH_CSS_SELECTOR', // Extract data using CSS selectors
    EXTRACT_WITH_JSON_PATH = 'EXTRACT_WITH_JSON_PATH', // Extract data from JSON using JSONPath
    TRANSFORM_DATA = 'TRANSFORM_DATA', // Apply some transformation to the data (e.g. cleanup, reformat)
    
    // Output / Control flow actions
    RETURN_DATA = 'RETURN_DATA', // Specify data to be returned as the tool's final output
    CONDITIONAL_STEP = 'CONDITIONAL_STEP', // Execute next steps based on a condition (advanced)
}

/**
 * Defines the strategies for finding the source URL(s) to scrape.
 */
export enum SourceFindingStrategyType {
    CONFIGURED_URL_PATTERNS = "configuredUrlPatterns",
    SITE_SPECIFIC_SEARCH = "siteSpecificSearch",
    SEMANTIC_SITEMAP_TRAVERSAL = "semanticSitemapTraversal",
    GENERAL_WEB_SEARCH = "generalWebSearch",
    LLM_GUIDED_NAVIGATION = "llmGuidedNavigation",
}

// Structure for defining required credentials
export interface CredentialRequirement {
    name: string; // e.g., "CLICKBANK_USERNAME", matches UserCredential.credentialName
    label: string; // e.g., "Clickbank Username", user-friendly
}

// Configuration for the URL Pattern strategy
export interface UrlPatternConfig {
    name: string; // Descriptive name for the pattern
    pattern: string; // URL template, e.g., "https://example.com/search?q=${query}"
    mapsToInput: string; // Name of the tool's input parameter to inject into the pattern
}

// Configuration for the Site Search strategy
export interface SiteSearchConfig {
    searchPageUrl?: string; // Optional: If search is not on baseDomain or needs specific path
    searchInputSelector: string;
    searchSubmitSelector: string;
    resultsContainerSelector?: string; // Optional: Narrows down DOM search for results
    resultLinkSelector: string; // Selector for links within each search result item
    resultTitleSelector?: string; // Optional: For LLM analysis of search results
    resultSnippetSelector?: string; // Optional: For LLM analysis of search results
}

// Configuration for the Sitemap strategy
export interface SitemapConfig {
    sitemapUrl?: string; // Defaults to baseDomain/sitemap.xml if not provided
    // Add specific parsing/embedding options if needed later
}

// Configuration for the Web Search strategy
export interface WebSearchConfig {
    searchEngine?: 'perplexity' | 'googleCustomSearch'; // Default to perplexity
    maxResultsToConsider?: number; // Default e.g., 5
}

// ***** NEW TYPE DEFINITION: Represents one configured page finding strategy *****
export interface PageFindingStrategy {
  strategyType: SourceFindingStrategyType;
  input?: string | object; // Optional input/config specific to the strategy type (e.g., search query for site search, pattern for URL patterns)
}


// Configuration for the LLM Guided Navigation strategy
export interface LlmNavigationConfig {
    maxSteps?: number; // Default e.g., 5
    // Optional: modelArgs?: ModelArgs; // If model needs per-tool configuration
}

// Overall configuration for the Source Finder module
export interface SourceFinderConfig {
    enabledStrategies: PageFindingStrategy[]; // Ordered by preference --- CHANGED TYPE HERE
    urlPatterns?: UrlPatternConfig[];
    siteSearch?: SiteSearchConfig;
    sitemap?: SitemapConfig;
    webSearch?: WebSearchConfig;
    llmNavigation?: LlmNavigationConfig;
}

export enum AuthMethod {
  NONE = 'none',
  FORM = 'form', // For username/password forms
  BASIC = 'basic', // For HTTP Basic Auth
  BEARER = 'bearer', // For Bearer token in Authorization header
  API_KEY = 'apiKey', // For API key in header or query param
  // Potentially others like OAUTH2_CLIENT_CREDENTIALS etc.
}

export interface AuthConfig {
  method: AuthMethod;
  // Form-specific selectors, if method is 'form'
  formSelector?: string;
  usernameFieldSelector?: string;
  passwordFieldSelector?: string;
  submitButtonSelector?: string;

  // For API_KEY or BEARER: specifies how the key/token is sent
  apiKeyHeaderName?: string; // e.g., "X-API-Key", "Authorization" (for Bearer, value will be "Bearer <token>")
  apiKeyQueryParamName?: string; // If sent as a query parameter

  requiredCredentialNames?: string[]; // Names of credentials to fetch using clerkId (e.g., ["OPENAI_API_KEY", "MY_SITE_PASSWORD"])
  // puppeteerScript?: string; // For complex login flows using Puppeteer (future)
  // authRequiresPuppeteer?: boolean; // Hint if Puppeteer is needed for login
}

// Configuration specific to using Firecrawl as the raw scraper
export interface FirecrawlScraperConfig {
    onlyMainContent?: boolean;
    includeRawHtml?: boolean;
    // Allow passthrough of other CrawlScrapeOptions
    [key: string]: any;
}

// Configuration specific to using Visual/Puppeteer scraping
export interface VisualScraperConfig {
    // baseDataDescription is static config; runtime query comes from agent
    baseDataDescription?: string;
    waitForRenderMs?: number;
    screenshotOptions?: {
        fullPage?: boolean;
        quality?: number;
        type?: 'png' | 'jpeg';
        // Include other puppeteer-core ScreenshotOptions if needed
        [key: string]: any;
    };
    // Optional: modelArgs?: ModelArgs; // Vision/Text model config per tool
}

// ***** NEW TYPE DEFINITION: Represents a single step in the data extraction pipeline *****
export interface DataExtractionChainStep {
    stepName: string; // User-friendly name for the step
    actionType: ScrapingActionType;
    actionConfig?: object; // Configuration specific to the actionType (e.g., FirecrawlScrapeOptions, prompt for LLM)
    inputSource?: 'initialPage' | 'previousStepOutput'; // Default: 'initialPage' for first step, 'previousStepOutput' otherwise
    description?: string; // Optional description of what this step does
}


// Configuration defining which raw scraping methods to use
export interface ScrapingMethodsConfig {
    // Could evolve to be more complex (e.g., try visual if firecrawl fails)
    preferredMethod: 'firecrawl' | 'visual' | 'directHttpFetch'; // Added direct fetch
    firecrawl?: FirecrawlScraperConfig;
    visual?: VisualScraperConfig;
    directHttpFetch?: { // Configuration for direct fetch, if any needed
         // e.g., custom headers, specific method?
    }
}

// The main configuration object stored in the 'implementation' field for scraping tools
export interface ScrapingToolImplementationConfig {
    implementationType: 'scraping'; // Discriminator field
    baseDomain: string; // The primary domain the tool interacts with
    toolPurposeDescription: string; // Context for LLMs during execution
    sourceFinderConfig: SourceFinderConfig;
    authConfig: AuthConfig;
    scrapingMethodsConfig: ScrapingMethodsConfig;
    // ***** NEW PROPERTY: Defines the sequence of actions to extract data *****
    dataExtractionChain: DataExtractionChainStep[];
}

export interface FirecrawlCrawlerPageOptions { // Subset of Firecrawl's PageOptions
  onlyMainContent?: boolean;
  includeRawHtml?: boolean;
  // other relevant options for simple content fetching
}

export interface FirecrawlCrawlerConfig { // For FIRECRAWL_CRAWL_URL action
  pageOptions?: FirecrawlCrawlerPageOptions;
  // crawlerOptions?: any; // If we were to support recursive crawling
}

export interface DirectHttpFetchConfig {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  responseType?: 'text' | 'json';
}

export interface LlmExtractFromDataConfig {
  extractionPrompt?: string;
  outputSchema?: Record<string, any>; // For future structured output
}

// Example: Structure for holding fetched credentials
export interface FetchedCredentials {
    [key: string]: string | null; // Credential name -> value
}
