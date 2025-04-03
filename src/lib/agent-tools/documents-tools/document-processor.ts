import { z } from "zod";
import { tool } from "ai";
import { TextChatLogProps } from "@/src/lib/text-chat-log";
import { logger } from '@/src/lib/logger';
import { 
    CORE_processDocument, 
    CORE_saveAnalysisResult 
} from "./document-processor_core";

// Main tool export function
export const AGENT_TOOLS_documentProcessor = (userId: string, agentName: string, textChatLogs: TextChatLogProps[]) => {
  return {
    processDocument: tool({
      description: "Process and analyze documents using AI. Extracts key information and generates insights from document content.",
      parameters: z.object({
        documentContent: z.string().describe("The text content of the document to analyze"),
        analysisType: z.enum(["summary", "insights", "key_information", "sentiment", "general"]).describe("The type of analysis to perform on the document"),
        depth: z.enum(["standard", "deep"]).optional().default("standard").describe("The depth of analysis to perform (standard or deep)"),
        saveResult: z.boolean().optional().default(false).describe("Whether to save the analysis result to the database"),
        documentName: z.string().optional().describe("Required name for the document record if saveResult is true")
      }),
      execute: async ({ documentContent, analysisType, depth = "standard", saveResult = false, documentName = "" }) => {
        logger.tool("Document Processor Tool - Execute Called", { 
          analysisType,
          depth,
          documentLength: documentContent.length,
          saveResult,
          documentName
        });

        if (saveResult && !documentName) {
            return JSON.stringify({ success: false, error: "documentName is required when saveResult is true." });
        }

        textChatLogs.push({
          role: "function",
          message: `Processing document: ${documentName || '(unnamed)'} with ${analysisType} analysis at ${depth} depth`,
          agentName: "processDocument",
          timestamp: new Date(),
        });

        let analysisResult = "";
        let errorOccurred = false;
        let errorMessage = "";

        try {
          // Process the document using the core function
          analysisResult = await CORE_processDocument(documentContent, analysisType, depth);
          logger.tool("Document Processor - Core Processing Complete", { analysisType });

          // Save to database if requested
          let saveStatus: { success: boolean; error?: string } = { success: true };
          if (saveResult && documentName) {
             saveStatus = await CORE_saveAnalysisResult(
                userId, 
                agentName, 
                documentName, 
                analysisType, 
                depth, 
                analysisResult
             );
             if (!saveStatus.success) {
                 logger.warn("Document Processor - Core Saving Failed", { documentName, error: saveStatus.error });
                 // Decide if save failure should make the whole operation fail
                 // For now, we'll return success but include a save error message
             }
          }

          return JSON.stringify({
            success: true,
            analysisType,
            depth,
            result: analysisResult,
            saved: saveResult && documentName ? true : false,
            saveError: saveStatus.error
          });

        } catch (error) {
          errorOccurred = true;
          errorMessage = error instanceof Error ? error.message : "Unknown error during document processing";
          logger.error("Document Processor - Execute Error", {
            analysisType,
            error: errorMessage
          });
          
          return JSON.stringify({
            success: false,
            message: "Error processing document",
            error: errorMessage
          });
        }
      },
    }),
  };
};

export const AGENT_TOOLS_DIRECTIVE_DOCUMENT_PROCESSOR = () => {
  return `
<INSTRUCTIONS>
  <PURPOSE>
    The Document Processor tool allows you to analyze documents and extract valuable insights, summaries, and key information.
    It enables deep understanding of document content with various analysis options.
  </PURPOSE>

  <TOOLS>
    <TOOL name="processDocument">
      <DESCRIPTION>Process and analyze documents using AI to extract insights and information.</DESCRIPTION>
      <ANALYSIS_TYPES>
        <TYPE name="summary">
          Generate a comprehensive summary of the document's content, highlighting main points.
        </TYPE>
        <TYPE name="insights">
          Identify patterns, implications, and valuable insights from the document content.
        </TYPE>
        <TYPE name="key_information">
          Extract important facts, figures, dates, names, and critical data points.
        </TYPE>
        <TYPE name="sentiment">
          Analyze the emotional tone, sentiment patterns, and subjective elements.
        </TYPE>
        <TYPE name="general">
          Provide a comprehensive overview of content, key points, and significance.
        </TYPE>
      </ANALYSIS_TYPES>
      <DEPTH_OPTIONS>
        <OPTION name="standard">
          Focus on core elements and essential information.
        </OPTION>
        <OPTION name="deep">
          Provide detailed analysis with greater context and implications.
        </OPTION>
      </DEPTH_OPTIONS>
      <PARAMETERS>
         <PARAM name="documentContent" type="string" required="true">The text content of the document.</PARAM>
         <PARAM name="analysisType" type="enum['summary', 'insights', 'key_information', 'sentiment', 'general']" required="true">Type of analysis.</PARAM>
         <PARAM name="depth" type="enum['standard', 'deep']" required="false" default="standard">Depth of analysis.</PARAM>
         <PARAM name="saveResult" type="boolean" required="false" default="false">Set to true to save the analysis result.</PARAM>
         <PARAM name="documentName" type="string" required="false">Required if saveResult is true. Used as the key to save the result.</PARAM>
      </PARAMETERS>
    </TOOL>
  </TOOLS>

  <BEST_PRACTICES>
    - Match the analysis type to your specific information needs
    - Use deep analysis for complex documents that require thorough examination
    - Provide a documentName if you set saveResult to true
    - Process documents in segments if they're extremely long
    - Combine different analysis types for comprehensive understanding
  </BEST_PRACTICES>
</INSTRUCTIONS>
  `;
}; 