import { NextResponse } from "next/server";
import { PINECONE_deleteNamespace, PINECONE_deleteVectorsById, PINECONE_listVectors, PINECONE_storeData, PINECONE_deleteDocumentsByIds } from "../pinecone";
import pdfParse from "pdf-parse";
import { htmlToText } from 'html-to-text';
import { UTILS_cleanNewlines } from "@/src/lib/utils";

// Configure route to use Node.js runtime
export const runtime = 'nodejs';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

// Upload file to knowledge base
export async function POST(req: Request) {
  console.log("POST /api/kb called...");

  try {
    // Check if the request is JSON (URL) or FormData (file)
    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      // Handle URL processing
      const { url, userId, agentName, namespace, type } = await req.json();
      
      if (!url || !userId || !agentName || !namespace) {
        return NextResponse.json(
          { error: 'Missing required fields' },
          { status: 400 }
        );
      }

      console.log("Processing URL:", url);
      
      try {
        // Fetch the URL content
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch URL: ${response.statusText}`);
        }
        
        const html = await response.text();
        
        // Convert HTML to text
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

        // Store in Pinecone
        await PINECONE_storeData({
          toStore: [text],
          metadata: {
            source: url,
            type: 'url',
            timestamp: Date.now(),
            agentId: agentName,
            userId
          },
          namespace
        });

        return NextResponse.json({ success: true });
      } catch (error) {
        console.error('Error processing URL:', error);
        return NextResponse.json(
          { error: `Failed to process URL: ${getErrorMessage(error)}` },
          { status: 500 }
        );
      }
    } else {
      // Handle file upload (existing code)
      const formData = await req.formData();
      const file = formData.get('file') as File;
      const userId = formData.get('userId') as string;
      const agentName = formData.get('agentName') as string;
      const namespace = formData.get('namespace') as string;

      console.log("Received request with:", { userId, agentName, namespace, fileName: file?.name });

      if (!file || !userId || !agentName || !namespace) {
        return NextResponse.json(
          { error: 'Missing required fields' },
          { status: 400 }
        );
      }

      // Validate file type
      if (file.type !== 'application/pdf' && file.type !== 'text/plain') {
        return NextResponse.json(
          { error: 'Only PDF and text files are supported' },
          { status: 400 }
        );
      }

      let content = '';
      try {
        if (file.type === 'application/pdf') {
          // Process PDF with pdf-parse
          console.log('Processing PDF file...');
          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          console.log('Buffer created, size:', buffer.length);
          
          try {
            console.log('Attempting to parse PDF...');
            const options = {
              max: 0,  // no limit on pages
            };
            
            const data = await pdfParse(buffer, options);
            console.log('PDF parse result:', data ? 'Success' : 'Null result');
            
            if (data && data.text) {
              content = data.text;
              console.log('PDF content length:', content.length);
              
              if (!content || content.trim().length === 0) {
                console.log('PDF parsing resulted in empty content');
                return NextResponse.json({ error: 'PDF parsing resulted in empty content' }, { status: 400 });
              }
            } else {
              console.error('PDF parsing failed - null result from parser');
              return NextResponse.json({ 
                error: 'PDF parsing failed - could not read document content',
                details: 'Parser returned null'
              }, { status: 500 });
            }
          } catch (pdfError) {
            console.error('PDF parsing error details:', {
              error: pdfError,
              message: getErrorMessage(pdfError),
              stack: pdfError instanceof Error ? pdfError.stack : undefined
            });
            throw new Error(`PDF parsing failed: ${getErrorMessage(pdfError)}`);
          }
        } else {
          // Process text file
          content = await file.text();
          if (!content || content.trim().length === 0) {
            console.log('Text file is empty');
            return NextResponse.json({ error: 'Text file is empty' }, { status: 400 });
          }
        }
      } catch (error: unknown) {
        const message = getErrorMessage(error);
        console.error('Error processing file content:', {
          error,
          message,
          stack: error instanceof Error ? error.stack : undefined
        });
        return NextResponse.json(
          { error: `Failed to process ${file.type === 'application/pdf' ? 'PDF' : 'text'} file: ${message}` },
          { status: 500 }
        );
      }

      // Store in Pinecone
      try {
        await PINECONE_storeData({
          toStore: [content],
          metadata: {
            source: file.name,
            type: 'file',
            timestamp: Date.now(),
            agentId: agentName,
            userId
          },
          namespace
        });
      } catch (error: unknown) {
        const message = getErrorMessage(error);
        console.error('Error storing in Pinecone:', error);
        
        // Check for TLS/certificate errors
        if (message.includes('ERR_TLS_CERT_ALTNAME_INVALID')) {
          return NextResponse.json(
            { error: 'Database connection error. Please check your Pinecone configuration and environment variables.' },
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

// Delete a file from the knowledge base
export async function DELETE(req: Request) {
  const { vectorId, documentIds, namespace, allInNameSpace } = await req.json();
  console.log("DELETE /api/kb called with:", { vectorId, documentIds, namespace, allInNameSpace });
  
  if (allInNameSpace) {
    try {
      await PINECONE_deleteNamespace(namespace);
    } catch (error) {
      console.error('Error deleting namespace:', error);
      throw error;
    }
  } else {
    try {
      const vectorIds = Array.isArray(vectorId) ? vectorId : [vectorId];
      
      // First delete by documentIds if present
      if (documentIds?.length > 0) {
        await PINECONE_deleteDocumentsByIds(documentIds, namespace);
      }

      // Then delete any remaining vectors by ID
      const batchSize = 20;
      for (let i = 0; i < vectorIds.length; i += batchSize) {
        const batch = vectorIds.slice(i, i + batchSize);
        await PINECONE_deleteVectorsById(batch, namespace);
      }
    } catch (error) {
      console.error('Error deleting vectors:', error);
      throw error;
    }
  }
  return NextResponse.json({ success: true });
}

