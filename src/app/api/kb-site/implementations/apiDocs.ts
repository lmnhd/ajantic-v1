import { htmlToText } from 'html-to-text';
import { ScrapingResult, URLProcessor } from './index';
import * as cheerio from 'cheerio';
import { analyzeUrlsForRelevance, TEST_LINKS_COUNT, analyzeContent, compareContentQuality } from './url-analyzer';
import { logger } from '@/src/lib/logger';
import { UTILS_cleanNewlines } from '@/src/lib/utils';

class ApiDocsImplementation implements URLProcessor {
  name = 'apiDocs';

  private extractLinks(html: string, baseUrl: string): string[] {
    logger.log("Extracting Links", {
      baseUrl,
      operation: "apiDocs.extractLinks"
    });

    const $ = cheerio.load(html);
    const links = new Set<string>();
    
    $('a').each((_, element) => {
      const href = $(element).attr('href');
      if (href) {
        try {
          // Resolve relative URLs to absolute
          const absoluteUrl = new URL(href, baseUrl).href;
          links.add(absoluteUrl);
        } catch (e) {
          // Skip invalid URLs
          logger.log("Invalid URL Skipped", {
            href,
            baseUrl,
            error: e instanceof Error ? e.message : 'Unknown error',
            operation: "apiDocs.extractLinks"
          });
        }
      }
    });
    
    logger.log("Links Extracted", {
      baseUrl,
      linkCount: links.size,
      operation: "apiDocs.extractLinks"
    });

    return Array.from(links);
  }

  private isApiDocsUrl(url: string): boolean {
    const apiKeywords = ['api', 'docs', 'documentation', 'reference', 'swagger', 'openapi', 'redoc'];
    const lowercaseUrl = url.toLowerCase();
    return apiKeywords.some(keyword => lowercaseUrl.includes(keyword));
  }

  private isApiDocsContent(html: string): boolean {
    const $ = cheerio.load(html);
    
    // Common API documentation elements
    const apiElements = [
      'swagger-ui',
      '.swagger-ui',
      '.redoc',
      '.api-docs',
      '.api-reference',
      '.api-documentation',
      '[data-swagger-ui]',
      '[data-redoc]'
    ];
    
    // Common API documentation keywords in text
    const apiKeywords = [
      'API Reference',
      'API Documentation',
      'Endpoints',
      'HTTP Methods',
      'Request Parameters',
      'Response Schema',
      'Authentication',
      'Rate Limiting'
    ];
    
    // Check for API documentation specific elements
    const hasApiElements = apiElements.some(selector => $(selector).length > 0);
    
    // Check for API documentation keywords in headers and strong text
    const hasApiKeywords = apiKeywords.some(keyword => 
      $('h1, h2, h3, h4, h5, h6, strong').text().includes(keyword)
    );
    
    return hasApiElements || hasApiKeywords;
  }

  async processURL(baseUrl: string, currentUrl: string, maxDepth: number = 2, currentDepth: number = 0, visitedUrls = new Set<string>(), testing: boolean = false): Promise<ScrapingResult> {
    logger.log("API Docs Processing Started", {
      url: currentUrl,
      depth: currentDepth,
      maxDepth,
      testing,
      operation: "apiDocs.processURL"
    });
    
    try {
      const normalizedUrl = new URL(currentUrl, baseUrl).href;
      
      if (visitedUrls.has(normalizedUrl)) {
        logger.log("URL Already Processed", {
          url: normalizedUrl,
          operation: "apiDocs.processURL"
        });
        return { success: true, texts: [], sourceUrls: [], documentId: baseUrl };
      }
      visitedUrls.add(normalizedUrl);

      // Only process URLs from the same domain
      const baseUrlDomain = new URL(baseUrl).hostname;
      const currentUrlDomain = new URL(normalizedUrl).hostname;
      if (currentUrlDomain !== baseUrlDomain) {
        logger.log("Skipping External Domain", {
          baseDomain: baseUrlDomain,
          currentDomain: currentUrlDomain,
          operation: "apiDocs.processURL"
        });
        return { success: true, texts: [], sourceUrls: [], documentId: baseUrl };
      }

      // Check if URL looks like API documentation
      const isApiUrl = this.isApiDocsUrl(normalizedUrl);
      logger.log("URL Analysis", {
        url: normalizedUrl,
        isApiUrl,
        operation: "apiDocs.analyze"
      });

      logger.log("Fetching Content", {
        url: normalizedUrl,
        operation: "apiDocs.fetch"
      });

      const response = await fetch(normalizedUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.statusText}`);
      }
      
      const html = await response.text();
      logger.log("Content Fetched", {
        url: normalizedUrl,
        contentLength: html.length,
        operation: "apiDocs.fetch"
      });

      // Check if content looks like API documentation
      const isApiContent = this.isApiDocsContent(html);
      logger.log("Content Analysis", {
        url: normalizedUrl,
        isApiContent,
        operation: "apiDocs.analyze"
      });

      // If neither URL nor content suggests API docs, skip processing
      if (!isApiUrl && !isApiContent && !testing) {
        logger.log("Skipping Non-API Content", {
          url: normalizedUrl,
          operation: "apiDocs.analyze"
        });
        return { success: true, texts: [], sourceUrls: [], documentId: baseUrl };
      }
      
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
        isApiUrl,
        isApiContent,
        operation: "apiDocs.process"
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

      if (currentDepth < maxDepth) {
        // First extract all actual links from the page
        const extractedLinks = this.extractLinks(html, normalizedUrl);
        logger.log("Links Found", {
          url: normalizedUrl,
          linkCount: extractedLinks.length,
          operation: "apiDocs.links"
        });
        
        // Then use shared analyzer to filter relevant ones
        const relevantLinks = await analyzeUrlsForRelevance(text, extractedLinks);
        logger.log("Relevant Links Found", {
          url: normalizedUrl,
          totalLinks: extractedLinks.length,
          relevantLinks: relevantLinks.length,
          operation: "apiDocs.links"
        });
        
        // In testing mode, process TEST_LINKS_COUNT links
        const linksToProcess = testing ? relevantLinks.slice(0, TEST_LINKS_COUNT) : relevantLinks;
        logger.log("Processing Links", {
          url: normalizedUrl,
          linksToProcess: linksToProcess.length,
          testing,
          operation: "apiDocs.links"
        });
        
        const errors: Array<{ link: string; error: string }> = [];
        
        for (const link of linksToProcess) {
          logger.log("Processing Sublink", {
            parentUrl: normalizedUrl,
            sublink: link,
            operation: "apiDocs.sublink"
          });

          try {
            const result = await this.processURL(baseUrl, link, maxDepth, currentDepth + 1, visitedUrls, testing);
            if (result.success && result.texts) {
              logger.log("Sublink Processed Successfully", {
                parentUrl: normalizedUrl,
                sublink: link,
                textSegments: result.texts.length,
                operation: "apiDocs.sublink"
              });

              allTexts.push(...result.texts);
              sourceUrls.push(...(result.sourceUrls || new Array(result.texts.length).fill(link)));
              if (testing && result.texts[0]) {
                testContents.push({ url: link, content: result.texts[0] });
              }
            } else if (testing && result.error) {
              logger.log("Sublink Processing Error", {
                parentUrl: normalizedUrl,
                sublink: link,
                error: result.error,
                operation: "apiDocs.sublink"
              });
              errors.push({ link, error: result.error });
            }
          } catch (error) {
            logger.log("Sublink Processing Failed", {
              parentUrl: normalizedUrl,
              sublink: link,
              error: error instanceof Error ? error.message : 'Unknown error',
              operation: "apiDocs.sublink"
            });
            
            errors.push({ 
              link, 
              error: error instanceof Error ? error.message : 'Unknown error' 
            });
            
            // In testing mode, continue processing other test links
            if (testing) {
              continue;
            }
          }
        }
        
        // If in testing mode and all test links failed, return error details
        if (testing && errors.length === linksToProcess.length) {
          logger.log("All Test Links Failed", {
            url: normalizedUrl,
            errors: errors.map(e => ({ link: e.link, error: e.error })),
            operation: "apiDocs.testing"
          });

          return {
            success: false,
            error: `All test links failed processing`,
            texts: allTexts,
            sourceUrls: sourceUrls,
            documentId: baseUrl,
            testDetails: {
              processedUrl: normalizedUrl,
              error: errors.map(e => `${e.link}: ${e.error}`).join('; '),
              numberOfLinks: linksToProcess.length
            }
          };
        }

        // If in testing mode and we have multiple contents, compare them
        if (testing) {
          logger.log("Comparing Content Samples", {
            url: normalizedUrl,
            sampleCount: testContents.length,
            operation: "apiDocs.testing"
          });

          const contentQualityResult = await compareContentQuality(testContents);
          const bestContent = testContents[contentQualityResult.bestIndex];
          const contentStats = analyzeContent(bestContent.content);

          logger.log("Best Content Selected", {
            url: normalizedUrl,
            selectedUrl: bestContent.url,
            contentStats,
            operation: "apiDocs.testing"
          });

          return {
            success: true,
            texts: [bestContent.content],  // Only return the best content
            sourceUrls: [bestContent.url],
            documentId: baseUrl,
            testDetails: {
              processedUrl: bestContent.url,
              contentSample: bestContent.content.substring(0, 1500),
              extractedTextLength: bestContent.content.length,
              numberOfLinks: linksToProcess.length,
              contentStats
            }
          };
        }
      }

      // If we're testing but didn't have multiple contents to compare
      if (testing) {
        logger.log("Analyzing Single Content Sample", {
          url: normalizedUrl,
          operation: "apiDocs.testing"
        });

        const contentStats = analyzeContent(text);
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
            contentStats
          }
        };
      }

      logger.log("Processing Complete", {
        url: normalizedUrl,
        textSegments: allTexts.length,
        operation: "apiDocs.complete"
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
        operation: "apiDocs.error"
      });

      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        texts: [],
        sourceUrls: [],
        documentId: baseUrl,
        ...(testing && {
          testDetails: {
            processedUrl: currentUrl,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        })
      };
    }
  }
}

export const apiDocsImplementation = new ApiDocsImplementation(); 