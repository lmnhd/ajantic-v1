import { generateObject } from "ai";
import { z } from "zod";
import { MODEL_getModel_ai } from "@/app/(main)/research/analysis/lib/vercelAI-model-switcher";
import { ModelProviderEnum } from "@/src/lib/types";
import { logger } from "@/src/lib/logger";

// Number of links to process in testing mode
export const TEST_LINKS_COUNT = 2;

// Helper function to analyze content statistics
export function analyzeContent(text: string) {
  logger.log("Content Analysis Started", {
    textLength: text.length,
    operation: "analyzeContent"
  });

  const paragraphs = text.split('\n\n').filter(p => p.trim().length > 0);
  const totalChars = text.length;
  const hasStructuredData = (
    text.includes('{') && text.includes('}') || 
    text.includes('[') && text.includes(']')
  );
  
  let contentType: 'text' | 'api_docs' | 'structured_data' = 'text';
  if (hasStructuredData) {
    contentType = text.toLowerCase().includes('api') ? 'api_docs' : 'structured_data';
  }

  const stats = {
    totalCharacters: totalChars,
    paragraphCount: paragraphs.length,
    averageParagraphLength: totalChars / (paragraphs.length || 1),
    hasStructuredData,
    contentType
  };

  logger.log("Content Analysis Results", {
    stats,
    operation: "analyzeContent",
    contentType
  });

  return stats;
}

export async function analyzeUrlsForRelevance(content: string, urls: string[]): Promise<string[]> {
  logger.log("URL Analysis Started", {
    urlCount: urls.length,
    contentPreviewLength: Math.min(content.length, 1500),
    operation: "analyzeUrlsForRelevance"
  });

  const prompt = `From these extracted URLs, identify only the ones that are relevant to the main content and would provide valuable additional context. Exclude social media links, navigation menus, footers, and external websites.

Content preview:
${content.substring(0, 1500)}...

Available URLs:
${urls.join('\n')}`

logger.log("URL Analysis Prompt", {
  prompt,
  operation: "analyzeUrlsForRelevance"
});

  const relevantLinks = await generateObject({
    model: await MODEL_getModel_ai({
      modelName: "gpt-4o-mini",
      provider: ModelProviderEnum.OPENAI,
      temperature: 0.1,
    }),
    prompt: prompt,
    temperature: 0.1,
    schema: z.object({
      urls: z.array(z.string().url())
        .describe("Array of full URLs that are relevant to the main content")
    }),
  });

  logger.log("URL Analysis Complete", {
    originalUrlCount: urls.length,
    relevantUrlCount: relevantLinks.object.urls.length,
    operation: "analyzeUrlsForRelevance"
  });

  return relevantLinks.object.urls;
}

export async function compareContentQuality(contents: Array<{ url: string, content: string }>) {
  // Analyze each content sample
  const analysisResults = contents.map((sample, index) => {
    const issues = [];
    const content = sample.content;
    
    if (content.includes('\n\n') && content.split('\n\n').length > content.length / 100) {
      issues.push('Excessive newlines detected - possible raw code');
    }
    
    if (content.match(/[A-Z_]{10,}/g)) {
      issues.push('Contains long uppercase strings - possible unprocessed constants');
    }
    
    const bracketMatches = content.match(/\{|\}|\[|\]|\(|\)/g);
    if (bracketMatches && bracketMatches.length > content.length / 50) {
      issues.push('High density of brackets/braces - possible raw code');
    }

    const codeKeywords = ['function', 'const', 'var', 'let', 'return', 'import', 'export'];
    if (codeKeywords.some(keyword => content.includes(keyword))) {
      issues.push('Contains programming keywords - possible raw code');
    }

    return {
      index,
      isLikelyCode: issues.length > 1,
      issues,
      readabilityScore: content.split(/[.!?]/).length / content.split(/\s+/).length
    };
  });

  // Find best content by readability and issues
  const bestResult = analysisResults.reduce((best, current) => 
    current.readabilityScore > best.readabilityScore && current.issues.length <= best.issues.length ? current : best
  );

  return {
    bestIndex: bestResult.index,
    analysis: {
      isLikelyCode: bestResult.isLikelyCode,
      issues: bestResult.issues,
      readabilityScore: bestResult.readabilityScore
    }
  };
} 