"use server";

import { kbSiteMethodChooser } from "../kb-site/kb-site-method-chooser";
import { puppeteerImplementation } from "../kb-site/implementations/puppeteer";

export const PLAYGROUND_test_methodChooser = async (
    url: string
  ) => {
    console.log("PLAYGROUND_test_methodChooser called from index.ts", url);
    const result = await kbSiteMethodChooser(url);
    console.log("result", result);
    return result;
  };

  // test puppeteer only
  export const PLAYGROUND_test_puppeteer = async (
    url: string
  ) => {
    console.log("\n🔍 PUPPETEER TEST: Starting analysis for URL:", url);
    
    try {
      const result = await puppeteerImplementation.processURL(
        url,    // baseUrl
        url,    // currentUrl
        1,      // maxDepth
        0,      // currentDepth
        new Set<string>(), // visitedUrls
        true    // testing mode
      );
      
      console.log("\n📊 PUPPETEER TEST: Results");
      console.log("Success:", result.success);
      if (result.testDetails) {
        console.log("Content Stats:", result.testDetails.contentStats);
        console.log("Sample Length:", result.testDetails.extractedTextLength);
        console.log("Links Found:", result.testDetails.numberOfLinks);
      }
      if (result.error) {
        console.log("Error:", result.error);
      }
      
      return result;
    } catch (error) {
      console.error("❌ PUPPETEER TEST: Failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        texts: [],
        sourceUrls: [],
        documentId: url
      };
    }
  };
