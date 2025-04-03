import { NextResponse } from "next/server";
import {
  PINECONE_deleteNamespace,
  PINECONE_deleteVectorsById,
  PINECONE_listVectors,
  PINECONE_storeData,
} from "../pinecone";
import pdfParse from "pdf-parse";
import { htmlToText } from "html-to-text";
import { CheerioCrawler, Configuration } from "crawlee";

// Configure route to use Node.js runtime
export const runtime = "nodejs";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

// Upload file to knowledge base
export async function POST(req: Request) {
  console.log("POST /api/kb called...");

  try {
    // Check if the request is JSON (URL) or FormData (file)
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      // Handle URL processing
      const {
        url,
        userId,
        agentName,
        namespace,
        type,
        maxPages = 10,
      } = await req.json();

      if (!url || !userId || !agentName || !namespace) {
        return NextResponse.json(
          { error: "Missing required fields" },
          { status: 400 }
        );
      }

      console.log("Processing URL:", url);

      try {
        const texts: string[] = [];

        // Initialize the crawler
        const crawler = new CheerioCrawler({
          maxRequestsPerCrawl: maxPages,
          // Add these configurations to bypass header generation issues
          requestHandler({ $, request, enqueueLinks }) {
            // Extract text from the page
            const text = htmlToText($.html(), {
              wordwrap: false,
              preserveNewlines: true,
              selectors: [
                { selector: "img", format: "skip" },
                { selector: "script", format: "skip" },
                { selector: "style", format: "skip" },
                { selector: "a", options: { ignoreHref: true } },
              ],
            });

            // Add URL context to the text
            const textWithSource = `Source URL: ${request.url}\n\nContent:\n${text}`;
            texts.push(textWithSource);

            // Enqueue all links from the same domain
            enqueueLinks({
              strategy: "same-domain",
              transformRequestFunction(req) {
                // Skip file downloads, images, etc.
                if (!/\.(jpg|jpeg|png|gif|pdf|zip|doc|docx)$/i.test(req.url)) {
                  return req;
                }
                return false;
              },
            });
          },
          // Disable header generator and use simple configuration
          useSessionPool: false,
          persistCookiesPerSession: false,
          requestHandlerTimeoutSecs: 30,
          navigationTimeoutSecs: 30,
          // Add basic browser-like headers
          additionalMimeTypes: ["text/plain"],
        });
          
        // Start the crawler
        await crawler.run([url]);

        if (texts.length > 0) {
          // Store all collected texts in Pinecone
          await PINECONE_storeData({
            toStore: texts,
            metadata: {
              source: url,
              type: "url",
              timestamp: Date.now(),
              agentId: agentName,
              userId,
            },
            namespace,
          });
          return NextResponse.json({ success: true });
        } else {
          return NextResponse.json(
            { error: "No text found in the URL" },
            { status: 400 }
          );
        }
      } catch (error) {
        console.error("Error processing URL:", error);
        return NextResponse.json(
          { error: `Failed to process URL: ${getErrorMessage(error)}` },
          { status: 500 }
        );
      }
    } else {
      // Handle file upload (existing code)
      const formData = await req.formData();
      const file = formData.get("file") as File;
      const userId = formData.get("userId") as string;
      const agentName = formData.get("agentName") as string;
      const namespace = formData.get("namespace") as string;

      console.log("Received request with:", {
        userId,
        agentName,
        namespace,
        fileName: file?.name,
      });

      if (!file || !userId || !agentName || !namespace) {
        return NextResponse.json(
          { error: "Missing required fields" },
          { status: 400 }
        );
      }

      // Validate file type
      if (file.type !== "application/pdf" && file.type !== "text/plain") {
        return NextResponse.json(
          { error: "Only PDF and text files are supported" },
          { status: 400 }
        );
      }

      let content = "";
      try {
        if (file.type === "application/pdf") {
          // Process PDF with pdf-parse
          console.log("Processing PDF file...");
          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          console.log("Buffer created, size:", buffer.length);

          try {
            console.log("Attempting to parse PDF...");
            const options = {
              max: 0, // no limit on pages
              // pagerender: async function (pageData: any) {
              //   const textContent = await pageData.getTextContent();
              //   // Join with single spaces and normalize whitespace
              //   return textContent.items
              //     .map((item: any) => item.str)
              //     .join("")
              //     .replace(/\s+/g, " ")
              //     .trim();
              // },
            };

            const data = await pdfParse(buffer, options);
            console.log("PDF parse result:", data ? "Success" : "Null result");

            if (data && data.text) {
              content = data.text;
              console.log("PDF content length:", content.length);

              if (!content || content.trim().length === 0) {
                console.log("PDF parsing resulted in empty content");
                return NextResponse.json(
                  { error: "PDF parsing resulted in empty content" },
                  { status: 400 }
                );
              }
            } else {
              console.error("PDF parsing failed - null result from parser");
              return NextResponse.json(
                {
                  error: "PDF parsing failed - could not read document content",
                  details: "Parser returned null",
                },
                { status: 500 }
              );
            }
          } catch (pdfError) {
            console.error("PDF parsing error details:", {
              error: pdfError,
              message: getErrorMessage(pdfError),
              stack: pdfError instanceof Error ? pdfError.stack : undefined,
            });
            throw new Error(`PDF parsing failed: ${getErrorMessage(pdfError)}`);
          }
        } else {
          // Process text file
          content = await file.text();
          if (!content || content.trim().length === 0) {
            console.log("Text file is empty");
            return NextResponse.json(
              { error: "Text file is empty" },
              { status: 400 }
            );
          }
        }
      } catch (error: unknown) {
        const message = getErrorMessage(error);
        console.error("Error processing file content:", {
          error,
          message,
          stack: error instanceof Error ? error.stack : undefined,
        });
        return NextResponse.json(
          {
            error: `Failed to process ${
              file.type === "application/pdf" ? "PDF" : "text"
            } file: ${message}`,
          },
          { status: 500 }
        );
      }

      // Store in Pinecone
      try {
        await PINECONE_storeData({
          toStore: [content],
          metadata: {
            source: file.name,
            type: "file",
            timestamp: Date.now(),
            agentId: agentName,
            userId,
          },
          namespace,
        });
      } catch (error: unknown) {
        const message = getErrorMessage(error);
        console.error("Error storing in Pinecone:", error);

        // Check for TLS/certificate errors
        if (message.includes("ERR_TLS_CERT_ALTNAME_INVALID")) {
          return NextResponse.json(
            {
              error:
                "Database connection error. Please check your Pinecone configuration and environment variables.",
            },
            { status: 500 }
          );
        }

        return NextResponse.json(
          { error: `Failed to store content in knowledge base: ${message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    }
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    console.error("Error in request:", {
      error,
      message,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: `Failed to process request: ${message}` },
      { status: 500 }
    );
  }
}

// Delete a file from the knowledge base
export async function DELETE(req: Request) {
  const { vectorId, namespace, allInNameSpace } = await req.json();
  console.log("DELETE /api/kb called with:", {
    vectorId,
    namespace,
    allInNameSpace,
  });
  if (allInNameSpace) {
    try {
      await PINECONE_deleteNamespace(namespace);
    } catch (error) {
      console.error("Error deleting namespace:", error);
      throw error;
    }
  } else {
    try {
      await PINECONE_deleteVectorsById([vectorId], namespace);
    } catch (error) {
      console.error("Error deleting vectors by ID:", error);
      throw error;
    }
  }
  return NextResponse.json({ success: true });
}
