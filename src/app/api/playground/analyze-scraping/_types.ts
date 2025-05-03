import { z } from 'zod';

// Define the expected request body schema
export const analyzeRequestSchema = z.object({
  userId: z.string().min(1, { message: "User ID is required" }),
  targetUrl: z.string().url({ message: "Invalid URL format" }),
  dataDescription: z.string().optional(), // Optional for now
});

// Define structure for preliminary check results
export interface PreliminaryCheckResult {
    accessible: boolean;
    statusCode?: number;
    contentType?: string | null;
    error?: string;
    isLikelyBlockPage?: boolean;
    blockReason?: string;
    bodyExcerpt?: string;
    htmlContent?: string; // Store full HTML if viable
    htmlProcessed?: boolean; // Flag if full HTML was attempted
}

// Define structure for Firecrawl check results
export interface FirecrawlCheckResult {
    attempted: boolean;
    success?: boolean;
    error?: string;
    dataExcerpt?: any; // Store scraped data (e.g., markdown or main content)
    statusCode?: number; // Firecrawl might provide this
}

// Define a potential structure for the analysis result
export interface AnalysisResult {
    status: 'success' | 'error';
    message: string;
    preliminaryCheck?: PreliminaryCheckResult;
    firecrawlCheck?: FirecrawlCheckResult;
    suggestedMethod?: string;
    potentialIssues?: string[];
    suggestedSelectors?: Record<string, string> | null;
}

// Zod schema for the selector output
export const SelectorOutputSchema = z.record(
    z.string().min(1, { message: "Selector string cannot be empty." }), // Value must be a non-empty string
    { invalid_type_error: "Expected an object mapping keys to selector strings." }
).describe("A JSON object where keys are descriptive camelCase names and values are CSS selector strings."); 