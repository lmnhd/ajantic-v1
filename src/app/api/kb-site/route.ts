import { NextResponse } from "next/server";
import { PINECONE_deleteNamespace, PINECONE_deleteVectorsById, PINECONE_listVectors, PINECONE_storeData } from "../pinecone";

import { implementations } from './implementations';
import { kbSiteMethodChooser } from "./kb-site-method-chooser";

// Configure route to use Node.js runtime
export const runtime = 'nodejs';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

// async function processURL(baseUrl: string, currentUrl: string, maxDepth: number = 2, currentDepth: number = 0, visitedUrls = new Set<string>()): Promise<string[]> {
//   try {
//     const normalizedUrl = new URL(currentUrl, baseUrl).href;
    
//     if (visitedUrls.has(normalizedUrl)) {
//       return [];
//     }
//     visitedUrls.add(normalizedUrl);

//     // Only process URLs from the same domain
//     const baseUrlDomain = new URL(baseUrl).hostname;
//     const currentUrlDomain = new URL(normalizedUrl).hostname;
//     if (currentUrlDomain !== baseUrlDomain) {
//       return [];
//     }

//     const response = await fetch(normalizedUrl);
//     if (!response.ok) {
//       throw new Error(`Failed to fetch URL: ${response.statusText}`);
//     }
    
//     const html = await response.text();
//     const text = htmlToText(html, {
//       wordwrap: false,
//       preserveNewlines: true,
//       selectors: [
//         { selector: 'img', format: 'skip' },
//         { selector: 'script', format: 'skip' },
//         { selector: 'style', format: 'skip' },
//         { selector: 'a', options: { ignoreHref: true } }
//       ]
//     });

//     const allTexts = [text];

//     // Only fetch sub-links if we haven't reached max depth
//     if (currentDepth < maxDepth) {
//       const relevantLinks = await generateObject({
//         model: await MODEL_getModel_ai({
//           modelName: "claude-3-5-sonnet-20240620",
//           provider: ModelProviderEnum.ANTHROPIC,
//           temperature: 0.1,
//         }),
//         prompt: `Analyze this webpage content and identify all relevant internal links that would provide valuable additional context. Exclude social media links, navigation menus, footers, and external websites.

// Content:
// ${text.substring(0, 3000)}...`,
//         temperature: 0.1,
//         schema: z.object({
//           urls: z.array(z.string().url())
//             .describe("Array of full URLs that are relevant to the main content")
//         }),
//       });
      
//       // Process each relevant link at next depth level
//       for (const link of relevantLinks.object.urls) {
//         try {
//           const subTexts = await processURL(baseUrl, link, maxDepth, currentDepth + 1, visitedUrls);
//           allTexts.push(...subTexts);
//         } catch (error) {
//           console.warn(`Failed to process sublink ${link}:`, error);
//         }
//       }
//     }

//     return allTexts;
//   } catch (error) {
//     console.warn(`Invalid URL ${currentUrl}:`, error);
//     return [];
//   }
// }

// Upload file to knowledge base
export async function POST(req: Request) {
  console.log("POST /api/kb called...");

  try {
    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      const { url, userId, agentName, namespace, type, maxDepth = 2 } = await req.json();
      
      if (!url || !userId || !agentName || !namespace) {
        return NextResponse.json(
          { error: 'Missing required fields' },
          { status: 400 }
        );
      }

      console.log(`Processing URL: ${url} with max depth: ${maxDepth}`);

      // Method chooser
      const methodChooserResult = await kbSiteMethodChooser(url);
      console.log("Method chooser result:", methodChooserResult);
      
      let lastError = '';
      
      // Map implementation names to their instances
      const implementationMap = {
        simple: implementations.find(i => i.name === 'simple')!,
        apiDocs: implementations.find(i => i.name === 'apiDocs')!,
        puppeteer: implementations.find(i => i.name === 'puppeteer')!
      };
      
      // Try implementations in the recommended order
      for (const implName of methodChooserResult.implimentationOrder) {
        const implementation = implementationMap[implName];
        const grade = methodChooserResult.methodGrades[implName];
        
        console.log(`Trying ${implName} implementation (Grade ${grade.grade}: ${grade.explanation})`);
        
        try {
          const result = await implementation.processURL(url, url, maxDepth);
          
          if (result.success && result.texts?.length) {
            const groupId = url;
            
            for (let i = 0; i < result.texts.length; i++) {
              await PINECONE_storeData({
                toStore: [result.texts[i]],
                metadata: {
                  source: result.sourceUrls?.[i] || url,
                  documentId: result.sourceUrls?.[i] || url,
                  groupId: groupId,
                  type: 'url',
                  timestamp: Date.now(),
                  agentId: agentName,
                  userId,
                  implementation: implementation.name,
                  isMultiPage: result.texts.length > 1,
                  totalPages: result.texts.length,
                  grade: grade.grade,
                  gradeExplanation: grade.explanation
                },
                namespace
              });
            }

            return NextResponse.json({ 
              success: true,
              implementation: implementation.name,
              pagesProcessed: result.texts.length,
              documentId: result.sourceUrls?.[0] || url,
              groupId: groupId,
              grade: grade.grade,
              gradeExplanation: grade.explanation,
              allMethodGrades: methodChooserResult.methodGrades
            });
          }
        } catch (error) {
          lastError = getErrorMessage(error);
          console.warn(`Implementation ${implementation.name} (Grade ${grade.grade}) failed:`, lastError);
          // Continue to next implementation in the recommended order
        }
      }

      // If we get here, all implementations failed
      return NextResponse.json(
        { 
          error: `All implementations failed. Last error: ${lastError}`,
          methodGrades: methodChooserResult.methodGrades,
          implementationErrors: methodChooserResult.errors
        },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error('Error in request:', {
      error,
      message,
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { error: `Failed to process request: ${message}` },
      { status: 500 }
    );
  }
}


