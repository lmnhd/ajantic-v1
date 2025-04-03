'use server';

import { generateText } from "ai";
import { logger } from '@/src/lib/logger';
import { MODEL_getModel_ai } from "@/src/lib/vercelAI-model-switcher";
import { ModelProviderEnum } from "@/src/lib/types";
import { SERVER_storeGeneralPurposeData } from "@/src/lib/server";

// Helper function to process document content
export async function CORE_processDocument(
  documentContent: string, 
  analysisType: string, 
  depth: string = "standard"
): Promise<string> { // Return only the analysis string or throw error
  let result = "";
  try {
    logger.tool("CORE: Starting document processing", {
      action: "DOCUMENT_PROCESS_START",
      contentLength: documentContent.length,
      analysisType,
      depth
    });

    let prompt = ``;
    switch (analysisType.toLowerCase()) {
      case "summary":
        prompt = `Provide a comprehensive summary...`; // Keep prompts as before
        break;
      case "insights":
        prompt = `Analyze the following document and provide key insights...`;
        break;
      case "key_information":
        prompt = `Extract the most important information...`;
        break;
      case "sentiment":
        prompt = `Analyze the sentiment and tone...`;
        break;
      default:
        prompt = `Analyze the following document and provide a comprehensive overview...`;
    }
    // Add depth instruction
    if (analysisType !== 'general') {
        prompt += depth === "deep" ? " Include detailed analysis..." : " Focus on core elements..."; // Simplified example
    }
    prompt += `\n\nDocument content: ${documentContent}`;

    // TODO: Make model configurable
    const modelArgs = {
        modelName: "gpt-4o-mini",
        provider: ModelProviderEnum.OPENAI,
        temperature: 0.2,
    };
    const model = await MODEL_getModel_ai(modelArgs);

    const response = await generateText({
      model: model,
      prompt,
    });

    result = response.text;
    logger.tool("CORE: Document processing complete", {
      action: "DOCUMENT_PROCESS_COMPLETE",
      analysisType,
      resultLength: result.length,
    });
    return result; // Return analysis string

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error("CORE: Failed to process document", {
      action: "DOCUMENT_PROCESS_ERROR",
      analysisType,
      error: errorMsg
    });
    // Throw error to be caught by the caller
    throw new Error(`Error processing document: ${errorMsg}`);
  }
}

// Function to save the analysis result
export async function CORE_saveAnalysisResult(
    userId: string, // Assuming userId is needed for DB operations
    agentName: string, // Assuming agentName is needed for DB namespace
    documentName: string,
    analysisType: string,
    depth: string,
    result: string
): Promise<{success: boolean; error?: string}> {
     logger.tool("CORE: Saving Analysis Result", {
        analysisType,
        documentName,
        agentName
     });
     try {
        // Construct appropriate namespace/key if needed
        // Example: Using documentName as key and a specific namespace
        const namespace = `document_processor_results_${userId}_${agentName}`;
        const key = documentName; 

        await SERVER_storeGeneralPurposeData(
            result,                   // content
            documentName,             // meta1
            `${analysisType} - ${depth}`, // meta2
            JSON.stringify({ analysisType, depth, agentName, userId }), // meta3 (more context)
            `${namespace}:${key}`,     // name (namespace:key format)
            false                     // allowMultiple = false (overwrite if exists)
        );
        logger.tool("CORE: Analysis Result Saved", { documentName, success: true });
        return { success: true };
     } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown DB error";
        logger.error("CORE: Failed to save analysis result", { 
            documentName,
            error: errorMsg 
        });
        return { success: false, error: `Failed to save analysis: ${errorMsg}` };
     }
} 