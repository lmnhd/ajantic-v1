import { simpleImplementation } from "./simple";
import { puppeteerImplementation } from "./puppeteer";
import { apiDocsImplementation } from "./apiDocs";

export type ScrapingResult = {
  success: boolean;
  texts: string[];
  sourceUrls: string[];
  documentId: string;
  error?: string;
  testDetails?: {
    processedUrl: string;
    contentSample?: string;
    extractedTextLength?: number;
    numberOfLinks?: number;
    contentStats?: any;
    contentQuality?: {
      isLikelyCode: boolean;
      issues: string[];
      readabilityScore: number;
    };
    potentialIssues?: string[];
    error?: string;
  };
};

export interface URLProcessor {
  name: string;
  
  processURL(
    baseUrl: string,
    currentUrl: string,
    maxDepth?: number,
    currentDepth?: number,
    visitedUrls?: Set<string>,
    testing?: boolean
  ): Promise<ScrapingResult>;
}

export const implementations: URLProcessor[] = [
  simpleImplementation,
  apiDocsImplementation,
  puppeteerImplementation
];

