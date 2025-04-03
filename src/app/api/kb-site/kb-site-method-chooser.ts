import { MODEL_getModel_ai } from "@/src/lib/vercelAI-model-switcher";
import { ModelProviderEnum } from "@/src/lib/types";
import { generateObject } from "ai";
import { z } from "zod";
import { simpleImplementation } from "./implementations/simple";
import { apiDocsImplementation } from "./implementations/apiDocs";
import { puppeteerImplementation } from "./implementations/puppeteer";
import { ScrapingResult } from "./implementations";
import { logger } from "@/src/lib/logger";

export interface KbSiteMethodChooserResult {
  implimentationOrder: ("simple" | "apiDocs" | "puppeteer")[];
  methodGrades: Record<"simple" | "apiDocs" | "puppeteer", {
    grade: "A" | "B" | "C" | "D" | "E";
    explanation: string;
  }>;
  errors?: string[];
}

interface CrawlResult {
  success: boolean;
  error?: string;
  data?: ScrapingResult;
}

export const kbSiteMethodChooser = async (
  url: string,
): Promise<KbSiteMethodChooserResult> => {
  logger.log("Method Chooser Started", { url, operation: "methodChooser" });
  
  // Test each method with testing mode enabled
  const methodResults: Record<string, CrawlResult> = {};
  
  const methods = [
    { name: 'simple', fn: simpleImplementation.processURL.bind(simpleImplementation) },
    { name: 'apiDocs', fn: apiDocsImplementation.processURL.bind(apiDocsImplementation) },
    { name: 'puppeteer', fn: puppeteerImplementation.processURL.bind(puppeteerImplementation) }
  ];

  logger.log("Testing Implementations", { 
    methodCount: methods.length,
    methods: methods.map(m => m.name),
    operation: "methodChooser"
  });
  
  for (const method of methods) {
    logger.log(`Testing ${method.name.toUpperCase()}`, {
      method: method.name,
      url,
      operation: "methodChooser.test"
    });

    try {
      // Use testing mode to get content evaluation results
      const result = await method.fn(url, url, 1, 0, new Set<string>(), true);
      
      logger.log(`${method.name.toUpperCase()} Test Complete`, {
        method: method.name,
        success: true,
        contentStats: result.testDetails?.contentStats,
        sampleLength: result.testDetails?.extractedTextLength,
        linkCount: result.testDetails?.numberOfLinks,
        operation: "methodChooser.test"
      });

      methodResults[method.name] = { success: true, data: result };
    } catch (error) {
      logger.log(`${method.name.toUpperCase()} Test Failed`, {
        method: method.name,
        error: error instanceof Error ? error.message : 'Unknown error',
        operation: "methodChooser.test"
      });

      methodResults[method.name] = { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  logger.log("Analyzing Results", {
    methodResults: Object.fromEntries(
      Object.entries(methodResults).map(([method, result]) => [
        method,
        {
          success: result.success,
          contentLength: result.data?.testDetails?.extractedTextLength,
          linkCount: result.data?.testDetails?.numberOfLinks,
          contentType: result.data?.testDetails?.contentStats?.contentType
        }
      ])
    ),
    operation: "methodChooser.analyze"
  });
  
  const response = await generateObject({
    model: await MODEL_getModel_ai({
      modelName: "gpt-4o-mini",
      provider: ModelProviderEnum.OPENAI,
      temperature: 0.1,
    }),
    prompt: `Analyze this URL and determine the best method to scrape it: ${url}

You must respond with an object containing:
1. implimentationOrder: Array of methods in preferred order ['simple', 'apiDocs', 'puppeteer']
2. methodGrades: Object with grades for each method:
   - simple: { grade: "A-F", explanation: "why" }
   - apiDocs: { grade: "A-F", explanation: "why" }
   - puppeteer: { grade: "A-F", explanation: "why" }

Example response format:
{
  "implimentationOrder": ["simple", "puppeteer", "apiDocs"],
  "methodGrades": {
    "simple": { "grade": "A", "explanation": "Simple HTML structure" },
    "apiDocs": { "grade": "C", "explanation": "Not API documentation" },
    "puppeteer": { "grade": "B", "explanation": "Some dynamic content" }
  }
}`,
    schema: z.object({
      implimentationOrder: z.array(z.enum(['simple', 'apiDocs', 'puppeteer'])),
      methodGrades: z.object({
        simple: z.object({
          grade: z.enum(['A', 'B', 'C', 'D', 'E']),
          explanation: z.string()
        }),
        apiDocs: z.object({
          grade: z.enum(['A', 'B', 'C', 'D', 'E']),
          explanation: z.string()
        }),
        puppeteer: z.object({
          grade: z.enum(['A', 'B', 'C', 'D', 'E']),
          explanation: z.string()
        })
      })
    })
  });

  logger.log("Analysis Complete", {
    recommendedOrder: response.object.implimentationOrder,
    grades: response.object.methodGrades,
    operation: "methodChooser.complete"
  });

  return {
    implimentationOrder: response.object.implimentationOrder,
    methodGrades: response.object.methodGrades,
    errors: Object.entries(methodResults)
      .filter(([_, result]) => !result.success)
      .map(([method, result]) => `${method}: ${result.error}`)
  };
};
