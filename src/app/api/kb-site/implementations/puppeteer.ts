import { htmlToText } from 'html-to-text';
import { ScrapingResult, URLProcessor } from './index';
import { GLOBAL_getPuppeteerClient, GLOBAL_getPuppeteerPage } from '@/src/lib/puppeteer_client';
import { analyzeUrlsForRelevance, TEST_LINKS_COUNT, analyzeContent, compareContentQuality } from './url-analyzer';
import * as cheerio from 'cheerio';
import { logger } from '@/src/lib/logger';
import { UTILS_cleanNewlines } from '@/src/lib/utils';
import pdfParse from "pdf-parse";

class PuppeteerImplementation implements URLProcessor {
  name = 'puppeteer';

  private async processPDFUrl(url: string): Promise<string> {
    logger.log("Processing PDF URL", {
      url,
      operation: "puppeteer.pdf"
    });

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      const options = {
        max: 0,  // no limit on pages
        // pagerender: async function(pageData: any) {
        //   const textContent = await pageData.getTextContent();
        //   return textContent.items
        //     .map((item: any) => item.str)
        //     .join('')
        //     .replace(/\s+/g, ' ')
        //     .trim();
        // }
      };
      
      const data = await pdfParse(buffer, options);
      
      if (!data || !data.text || data.text.trim().length === 0) {
        throw new Error('PDF parsing resulted in empty content');
      }

      logger.log("PDF Processing Complete", {
        url,
        textLength: data.text.length,
        operation: "puppeteer.pdf"
      });

      return data.text;
    } catch (error) {
      logger.log("PDF Processing Error", {
        url,
        error: error instanceof Error ? error.message : 'Unknown error',
        operation: "puppeteer.pdf.error"
      });
      throw error;
    }
  }

  async processURL(baseUrl: string, currentUrl: string, maxDepth: number = 2, currentDepth: number = 0, visitedUrls = new Set<string>(), testing: boolean = false): Promise<ScrapingResult> {
    logger.log("Puppeteer Processing Started", {
      url: currentUrl,
      depth: currentDepth,
      maxDepth,
      testing,
      operation: "puppeteer.processURL"
    });
    
    try {
      const normalizedUrl = new URL(currentUrl, baseUrl).href;
      
      if (visitedUrls.has(normalizedUrl)) {
        logger.log("URL Already Processed", {
          url: normalizedUrl,
          operation: "puppeteer.processURL"
        });
        return { success: true, texts: [], sourceUrls: [], documentId: baseUrl };
      }
      visitedUrls.add(normalizedUrl);

      // Domain check
      const baseUrlDomain = new URL(baseUrl).hostname;
      const currentUrlDomain = new URL(normalizedUrl).hostname;
      if (currentUrlDomain !== baseUrlDomain) {
        logger.log("Skipping External Domain", {
          baseDomain: baseUrlDomain,
          currentDomain: currentUrlDomain,
          operation: "puppeteer.processURL"
        });
        return { success: true, texts: [], sourceUrls: [], documentId: baseUrl };
      }

      logger.log("Launching Browser", {
        url: normalizedUrl,
        operation: "puppeteer.browser"
      });
      
      const browser = await GLOBAL_getPuppeteerClient('local');
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });

      // Navigate with more reliable options
      logger.log("Navigating to Page", {
        url: normalizedUrl,
        operation: "puppeteer.navigation"
      });

      await page.goto(normalizedUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // Wait for the body to be present and content to load
      await page.waitForSelector('body', { timeout: 10000 });
      
      // Add additional wait for dynamic content
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Wait for any dynamic content containers
      try {
        await Promise.race([
          page.waitForSelector('main', { timeout: 5000 }),
          page.waitForSelector('article', { timeout: 5000 }),
          page.waitForSelector('.content', { timeout: 5000 }),
          page.waitForSelector('#content', { timeout: 5000 })
        ]);
      } catch (e) {
        // Continue even if no specific content containers found
      }

      // Extract content in a single operation
      const content = await page.evaluate(() => {
        // Remove any script, style, and code-related elements first
        document.querySelectorAll('script, style, pre, code').forEach(el => el.remove());
        
        // Get main content areas first
        const mainContent = document.querySelector('main, article, .content, #content');
        const contentArea = mainContent || document.body;
        
        // Clean the content
        return {
          text: Array.from(contentArea.children)
            .filter(el => {
              const tag = el.tagName.toLowerCase();
              const className = (el.className || '').toLowerCase();
              // Filter out navigation, headers, footers, sidebars
              return !['nav', 'header', 'footer'].includes(tag) &&
                     !className.includes('nav') &&
                     !className.includes('header') &&
                     !className.includes('footer') &&
                     !className.includes('sidebar');
            })
            .map(el => el.textContent?.trim())
            .filter(text => text) // Remove empty strings
            .join('\n\n'),
          links: Array.from(document.querySelectorAll('a')).map(a => a.href)
        };
      });

      // Get the fully rendered HTML before closing the page
      logger.log("Extracting Content", {
        url: normalizedUrl,
        operation: "puppeteer.extraction"
      });
      
      const html = await page.content();
      
      // Close the page now that we have all the content we need
      await page.close();
      logger.log("Content Extracted", {
        url: normalizedUrl,
        htmlLength: html.length,
        operation: "puppeteer.extraction"
      });

      // Process the extracted content
      const normalizedText = (content.text ?? '').trim();
      const links = content.links ?? [];

      // Add a small delay to ensure stability
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Wait for common content selectors
      logger.log("Processing Content", {
        url: normalizedUrl,
        operation: "puppeteer.processing"
      });

      const text = UTILS_cleanNewlines(htmlToText(html, {
        wordwrap: false,
        preserveNewlines: true,
        selectors: [
          { selector: 'img', format: 'skip' },
          { selector: 'script', format: 'skip' },
          { selector: 'style', format: 'skip' },
          { selector: 'a', options: { ignoreHref: true } }
        ]
      }));

      logger.log("Content Processed", {
        url: normalizedUrl,
        textLength: text.length,
        operation: "puppeteer.processing"
      });

      const allTexts: string[] = [];
      const sourceUrls: string[] = [];
      const testContents: Array<{ url: string, content: string }> = [];

      // Add the current page text and URL
      allTexts.push(text);
      sourceUrls.push(normalizedUrl);
      if (testing) {
        testContents.push({ url: normalizedUrl, content: text });
      }

      // Initialize result object
      const result: ScrapingResult = { 
        success: true, 
        texts: allTexts || [],
        sourceUrls: sourceUrls || [],
        documentId: baseUrl
      };

      // Early PDF detection and processing
      if (normalizedUrl.toLowerCase().endsWith('.pdf')) {
        const pdfText = await this.processPDFUrl(normalizedUrl);
        return {
          success: true,
          texts: [pdfText],
          sourceUrls: [normalizedUrl],
          documentId: baseUrl
        };
      }

      if (currentDepth < maxDepth) {
        // Use the links we already extracted instead of getting page content again
        logger.log("Processing Links", {
          url: normalizedUrl,
          linkCount: links.length,
          operation: "puppeteer.links"
        });
        
        // Process links in batches of 50
        const BATCH_SIZE = 50;
        let relevantLinks: string[] = [];
        
        const totalBatches = Math.ceil(links.length / BATCH_SIZE);
        logger.tool("Starting Link Analysis", {
          totalLinks: links.length,
          batchSize: BATCH_SIZE,
          totalBatches,
          operation: "puppeteer.links.analysis"
        });
        
        // Process all links in batches
        for (let i = 0; i < links.length; i += BATCH_SIZE) {
          const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
          const batch = links.slice(i, i + BATCH_SIZE);
          
          logger.tool("Processing Batch", {
            batchNumber,
            totalBatches,
            batchSize: batch.length,
            startIndex: i,
            endIndex: Math.min(i + BATCH_SIZE, links.length),
            totalLinks: links.length,
            operation: "puppeteer.links.batch.start"
          });
          
          const batchResults = await analyzeUrlsForRelevance(normalizedText, batch);
          relevantLinks.push(...batchResults);
          
          logger.tool("Batch Complete", {
            batchNumber,
            totalBatches,
            relevantLinksFound: batchResults.length,
            totalRelevantLinks: relevantLinks.length,
            operation: "puppeteer.links.batch.complete"
          });
        }

        logger.tool("Link Analysis Complete", {
          totalLinks: links.length,
          totalBatches,
          finalRelevantLinks: relevantLinks.length,
          operation: "puppeteer.links.analysis.complete"
        });

        logger.log("Relevant Links Found", {
          url: normalizedUrl,
          totalLinks: links.length,
          relevantLinks: relevantLinks.length,
          operation: "puppeteer.links"
        });

        // Randomly select 2 links from the relevant links
        const shuffledLinks = relevantLinks
          .sort(() => Math.random() - 0.5) // Randomize array
          .slice(0, 2); // Take first 2 after randomization
        
        logger.log("Selected Links for Processing", {
          url: normalizedUrl,
          selectedCount: shuffledLinks.length,
          selectedLinks: shuffledLinks,
          operation: "puppeteer.links"
        });
        
        // Process the randomly selected links
        for (const link of shuffledLinks) {
          if (!visitedUrls.has(link)) {
            logger.log("Processing Sublink", {
              parentUrl: normalizedUrl,
              sublink: link,
              operation: "puppeteer.sublink"
            });

            const subResult = await this.processURL(
              baseUrl,
              link,
              maxDepth,
              currentDepth + 1,
              visitedUrls,
              testing
            );

            if (subResult.texts) {
              result.texts.push(...subResult.texts);
            }
            if (subResult.sourceUrls && result.sourceUrls) {
              result.sourceUrls.push(...subResult.sourceUrls);
            }

            logger.log("Sublink Processed", {
              parentUrl: normalizedUrl,
              sublink: link,
              success: subResult.success,
              textsCount: subResult.texts?.length,
              operation: "puppeteer.sublink"
            });
          }
        }
      }

      // If we're testing but didn't have multiple contents to compare
      if (testing) {
        logger.log("Analyzing Test Content", {
          url: normalizedUrl,
          operation: "puppeteer.testing"
        });

        const contentStats = analyzeContent(text);
        const contentQualityResult = await compareContentQuality([{ url: normalizedUrl, content: text }]);

        return { 
          success: true, 
          texts: allTexts,
          sourceUrls: sourceUrls,
          documentId: baseUrl,
          testDetails: {
            processedUrl: normalizedUrl,
            contentSample: text.substring(0, 1500),
            extractedTextLength: text.length,
            numberOfLinks: sourceUrls.length,
            contentStats,
            contentQuality: contentQualityResult.analysis,
            potentialIssues: contentQualityResult.analysis.issues
          }
        };
      }

      logger.log("Processing Complete", {
        url: normalizedUrl,
        textSegments: allTexts.length,
        operation: "puppeteer.complete"
      });

      return { 
        success: true, 
        texts: allTexts,
        sourceUrls: sourceUrls,
        documentId: baseUrl
      };
    } catch (error) {
      logger.log("Processing Error", {
        url: currentUrl,
        error: error instanceof Error ? error.message : 'Unknown error',
        operation: "puppeteer.error"
      });
      throw error;
    }
  }
}

export const puppeteerImplementation = new PuppeteerImplementation(); 