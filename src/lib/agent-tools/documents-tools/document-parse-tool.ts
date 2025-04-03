// Removed "use server"

// Removed parser imports: pdfParse, mammoth, read, utils, htmlToText
import { tool } from "ai";
import { z } from "zod";
import { logger } from "@/src/lib/logger"; // Keep logger if needed for execute wrapper
import { CORE_parseFile } from "./document-parse_core"; // Import CORE function

// Removed TOOLFUNCTION_parseFile implementation

export const AGENT_TOOLS_DOCUMENT_PARSE = async () => {
  return {
    DOCUMENT_parse: tool({
      description: "Parse different types of files into readable text. Takes base64 encoded file content.",
      parameters: z.object({
        // Expect base64 encoded string from client/agent
        fileContentBase64: z.string().describe("The base64 encoded content of the file."), 
        fileType: z.enum(["pdf", "docx", "xlsx", "xls", "html", "txt"])
                   .describe("The type of the file (e.g., pdf, docx)."),
      }),
      execute: async ({ fileContentBase64, fileType }) => {
        logger.tool("DOCUMENT_parse tool: Execute called", { fileType });
        try {
          // Decode base64 string to Buffer on the server-side caller (which is CORE_parseFile)
          // Or decode here before sending? Let's decode in CORE for safety.
          // Correction: Let's decode HERE so the CORE function always receives a Buffer.
          const buffer = Buffer.from(fileContentBase64, 'base64');
          logger.tool("DOCUMENT_parse tool: Decoded base64 to buffer", { bufferLength: buffer.length });
          
          // Call the core server-side function
          const result = await CORE_parseFile(buffer, fileType);
          
          // Attempt to parse result in case CORE returned JSON error
          try {
            const parsedResult = JSON.parse(result);
            if (parsedResult.success === false) {
              logger.warn("DOCUMENT_parse tool: Core function returned error", { error: parsedResult.error });
            } else {
               logger.tool("DOCUMENT_parse tool: Core function successful (parsed result)", { resultLength: result.length });
            }
          } catch { 
             logger.tool("DOCUMENT_parse tool: Core function successful (raw result)", { resultLength: result.length });
             // If not JSON, it's the successful text content
          }

          return result; // Return raw string (either text content or JSON error string)
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "Unknown error during parse execution";
          logger.error("DOCUMENT_parse tool: Execute wrapper error", {
            fileType,
            error: errorMsg
          });
          return JSON.stringify({
            success: false, // Use success flag for consistency
            error: errorMsg,
          });
        }
      },
    }),
  };
};

export const AGENT_TOOLS_DOCUMENT_PARSE_DIRECTIVE = async () => {
  return `
  <INSTRUCTIONS>
    Use the DOCUMENT_parse tool to parse different types of files (pdf, docx, xlsx, xls, html, txt) into readable text.
    Provide the file content encoded in base64 using the 'fileContentBase64' parameter.
  </INSTRUCTIONS>
 `;
};
