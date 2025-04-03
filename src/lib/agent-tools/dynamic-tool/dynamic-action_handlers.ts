'use server';

import { z } from "zod";
import { ScriptEvaluator } from "./script-evaluator";
import { 
    TOOLSACTION_DYNAMIC_SCRIPT_EVALUATEANDCREATE 
} from "./dynamic-action-core"; // Import from renamed utils file
import { 
    SERVER_storeGeneralPurposeData, 
    SERVER_getGeneralPurposeDataSingle, 
    SERVER_deleteGeneralPurposeData
} from "@/src/lib/server";
import { logger } from '@/src/lib/logger';
import { TextChatLogProps } from "@/src/lib/text-chat-log"; // Keep for logging context if needed
import { GeneralPurpose } from "@prisma/client";

// --- Core Logic Functions --- 

export const CORE_analyzeRequirements = async (
    agentName: string, // Keep agentName/userId/textChatLogs if needed for logging/context
    userId: string,
    textChatLogs: TextChatLogProps[],
    params: { prompt: string; context?: string }
) => {
    logger.tool("Dynamic Action Core - Analyze Requirements", {
        agentName,
        prompt: params.prompt,
        hasContext: !!params.context
    });
    
    // Log the call (similar to original execute)
    textChatLogs.push({
        role: "function",
        message: `CORE: Analyze requirements. Prompt: ${params.prompt}, Context: ${params.context}`,
        agentName,
        timestamp: new Date()
    });
      
    try {
        const evaluator = new ScriptEvaluator();
        const result = await evaluator.analyzeRequirements(params.prompt, params.context);
        
        logger.tool("Dynamic Action Core - Analysis Complete", { agentName, result: JSON.stringify(result) });
        
        // Log result
        textChatLogs.push({
          role: "function",
          message: `CORE: Analysis result: ${JSON.stringify(result)}`,
          agentName,
          timestamp: new Date()
        });

        return JSON.stringify(result);
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown analysis error";
        logger.error("Dynamic Action Core - Analysis Failed", { agentName, error: errorMsg });
        return JSON.stringify({ success: false, error: errorMsg });
    }
};

export const CORE_createAndExecute = async (
    agentName: string,
    userId: string,
    textChatLogs: TextChatLogProps[],
    params: { prompt: string; context?: string; forceNew?: boolean }
) => {
    logger.tool("Dynamic Action Core - Starting Script Creation/Execution", {
        agentName,
        action: "SCRIPT_CREATE_START",
        promptLength: params.prompt.length,
        hasContext: !!params.context,
        forceNew: !!params.forceNew
    });

    textChatLogs.push({
        role: "function",
        message: `CORE: Create/Execute Script. Prompt: ${params.prompt}, Context: ${params.context}`,
        agentName,
        timestamp: new Date()
    });

    try {
        // Call the implementation function from the utils file
        const result = await TOOLSACTION_DYNAMIC_SCRIPT_EVALUATEANDCREATE(
            params.prompt,
            5, // Max attempts
            params.context,
            
        );
        
        logger.tool("Dynamic Action Core - Script Creation/Execution Complete", {
            agentName,
            action: "SCRIPT_CREATE_COMPLETE",
            success: !result.error,
            message: result.message,
        });

        textChatLogs.push({
            role: "function",
            message: `CORE: Create/Execute result: ${JSON.stringify(result)}`,
            agentName,
            timestamp: new Date()
        });

        return JSON.stringify(result);
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown creation/execution error";
        logger.error("Dynamic Action Core - Creation/Execution Failed", { agentName, error: errorMsg });
        return JSON.stringify({ success: false, error: errorMsg });
    }
};

export const CORE_saveScript = async (
    agentName: string,
    userId: string,
    textChatLogs: TextChatLogProps[],
    params: { name: string; description: string; script: string; parameters?: any }
) => {
    logger.tool("Dynamic Action Core - Save Script", {
        agentName,
        name: params.name,
        description: params.description,
        scriptLength: params.script.length
    });

    textChatLogs.push({
        role: "function",
        message: `CORE: Save Script. Name: ${params.name}, Desc: ${params.description}`,
        agentName,
        timestamp: new Date()
    });

    try {
        const result = await SERVER_storeGeneralPurposeData(
            params.script,
            params.name,
            params.description,
            JSON.stringify(params.parameters),
            `SAVED_CUSTOM_SCRIPTS_${agentName}_${userId}`,
            true
        );
        logger.tool("Dynamic Action Core - Save Complete", { agentName, name: params.name, success: true });
        return JSON.stringify({ success: true, result });
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown save error";
        logger.error("Dynamic Action Core - Save Failed", { agentName, name: params.name, error: errorMsg });
        return JSON.stringify({ success: false, error: errorMsg });
    }
};

export const CORE_deleteScript = async (
    agentName: string,
    userId: string,
    textChatLogs: TextChatLogProps[],
    params: { name: string }
) => {
    logger.tool("Dynamic Action Core - Initiating Script Deletion", {
        agentName,
        action: "SCRIPT_DELETE_START",
        name: params.name
    });

    textChatLogs.push({
        role: "function",
        message: `CORE: Delete Script. Name: ${params.name}`,
        agentName,
        timestamp: new Date()
    });

    try {
        const scriptData = await SERVER_getGeneralPurposeDataSingle(
            params.name, // Query by name directly
            `SAVED_CUSTOM_SCRIPTS_${agentName}_${userId}` // Use namespace
        );

        if (scriptData && scriptData.id) {
            await SERVER_deleteGeneralPurposeData(scriptData.id);
            logger.tool("Dynamic Action Core - Deletion successful", { agentName, action: "SCRIPT_DELETE_COMPLETE", name: params.name });
            return JSON.stringify({ success: true });
        } else {
            logger.tool("Dynamic Action Core - Script not found for deletion", { agentName, action: "SCRIPT_DELETE_NOTFOUND", name: params.name });
            return JSON.stringify({ success: false, message: "Script not found" });
        }
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown delete error";
        logger.error("Dynamic Action Core - Deletion Failed", {
            agentName,
            action: "SCRIPT_DELETE_ERROR",
            name: params.name,
            error: errorMsg
        });
        return JSON.stringify({ success: false, error: errorMsg });
    }
};

export const CORE_getScript = async (
    agentName: string,
    userId: string,
    textChatLogs: TextChatLogProps[],
    params: { name: string }
) => {
    logger.tool("Dynamic Action Core - Retrieving Script", {
        agentName,
        action: "SCRIPT_GET_START",
        name: params.name
    });

    textChatLogs.push({
        role: "function",
        message: `CORE: Get Script. Name: ${params.name}`,
        agentName,
        timestamp: new Date()
    });

    try {
        const result = await SERVER_getGeneralPurposeDataSingle(
            params.name, // Query by name
           `SAVED_CUSTOM_SCRIPTS_${agentName}_${userId}` // Use namespace
        );

        if (result && result.content) {
            logger.tool("Dynamic Action Core - Script retrieved successfully", {
                agentName,
                action: "SCRIPT_GET_COMPLETE",
                name: params.name,
                contentLength: result.content.length
            });
            // Return the whole GeneralPurpose object or just the content?
            // Returning content seems more aligned with the original execute
            return JSON.stringify({ success: true, script: result.content, description: result.meta2, parameters: result.meta3 }); 
        } else {
            logger.tool("Dynamic Action Core - Script not found", {
                agentName,
                action: "SCRIPT_GET_NOTFOUND",
                name: params.name
            });
            return JSON.stringify({ success: false, message: "Script not found - check name" });
        }
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown get error";
        logger.error("Dynamic Action Core - Get Failed", { agentName, name: params.name, error: errorMsg });
        return JSON.stringify({ success: false, error: errorMsg });
    }
}; 