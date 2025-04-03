"use server";

import { generateObject, generateText, tool, ToolExecutionOptions } from "ai";
import { MODEL_getModel_ai } from "../../vercelAI-model-switcher";
import { ModelProviderEnum } from "@/src/lib/types";
import { z } from "zod";
import axios from "axios";
import fs from "fs";
import path from "path";
import os from "os";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import jsonwebtoken from "jsonwebtoken";
import bcrypt from "bcrypt";
import multer from "multer";
import { headers } from "next/headers";
import { Pinecone } from "@pinecone-database/pinecone";
import { PINECONE_storeData, PINECONE_query_docs } from "@/src/app/api/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";
import {
  S3Client,
  PutObjectCommand,
  PutObjectCommandInput,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { randomUUID } from "crypto";
import { ScriptEvaluator } from "./script-evaluator";
import { MODEL_CONFIG } from "../../models/model-config";
import { SERVER_getGeneralPurposeDataMany, SERVER_getGeneralPurposeDataSingle, SERVER_storeGeneralPurposeData } from "@/src/lib/server-actions";
import { SERVER_deleteGeneralPurposeData } from "@/src/lib/server";
import { GeneralPurpose } from "@prisma/client";
import { TextChatLogProps } from "../../text-chat-log";
import { logger } from '@/src/lib/logger';
import { ScriptMemoryManager } from "./script-memory-manager";
import { ScriptWriterResult, ScriptEvaluationResult, MEMORY_NAMESPACE, SAVED_SCRIPTS_NAMESPACE, SYSTEM_MESSAGES } from "./dynamic-tool-typs";
import { DynamicToolConfig } from "../../types";
import { OpenAI } from "openai";
import { S3_storeFileToS3 } from "@/src/lib/agent-tools/s3-storage/s3-core";

// One tool will write a javascript block of code.
// Another tool will execute the javascript block of code and ultimately approves or rejects the code.
// when the code is approved, it is added to database to be called by the executor.

export const TOOLFUNCTION_SCRIPT_WRITER = async (
  prompt: string,
  codeHistory: string[],
  errors: string[],
  context?: string
): Promise<ScriptWriterResult> => {
  logger.tool("Script Writer - Starting", {
    promptLength: prompt.length,
    historyCount: codeHistory.length,
    errorCount: errors.length,
    hasContext: !!context
  });

  const fullPrompt =
    codeHistory.length === 0
      ? `${prompt}${context ? `\nContext:\n${context}` : ""}`
      : `From this prompt:\n"${prompt}"\n"${await _createCodeHistoryList(
          codeHistory
        )}"\n"${await _createErrorsList(
          errors
        )}"\nPlease fix the errors and provide a new code block.${context ? `\nContext:\n${context}` : ""}`;

  try {
    const script = await generateObject({
      model: await MODEL_getModel_ai(MODEL_CONFIG.SCRIPT_WRITER),
      system: SYSTEM_MESSAGES.scriptWriterFirstTime,
      prompt: fullPrompt,
      schema: z.object({
        script: z.string(),
        testParameters: z.string().optional(),
        description: z.string(),
        requiredInfo: z.array(z.string()).optional(),
        hasAllRequiredInfo: z.boolean(),
      }),
    });

    if (!script.object.hasAllRequiredInfo || script.object.script.startsWith("MISSING_INFO:")) {
      logger.tool("Script Writer - Missing Information", {
        missingInfo: script.object.requiredInfo
      });
      return {
        script: "",
        parameters: null,
        description: "Missing Required Information",
        err: true,
        errormsg: `Please provide the following information:\n${
          script.object.requiredInfo?.map((info) => `- ${info}`).join("\n") || ""
        }`,
        errorHistory: errors,
        codeHistory: codeHistory,
      };
    }

    logger.tool("Script Writer - Success", {
      scriptLength: script.object.script.length,
      hasParameters: !!script.object.testParameters
    });

    return {
      script: script.object.script,
      parameters: script.object.testParameters,
      description: script.object.description,
      err: false,
      errormsg: "",
      errorHistory: errors,
      codeHistory: codeHistory,
    };
  } catch (error) {
    logger.tool("Script Writer - Error", {
      error: (error as Error).message
    });
    throw error;
  }
};

export const _createErrorsList = async (errors: string[]): Promise<string> => {
  if (errors.length === 0) {
    return "";
  }
  if (errors.length === 1) {
    return `The code you provided has the following error:\n${errors[0]}`;
  }
  // mention the latest error first, then the previous errors
  return `... has the following errors:\n${
    errors[errors.length - 1]
  }\nAnd here are the previous errors:\n${errors.slice(0, -1).join("\n")}`;
};

export const _createCodeHistoryList = async (codeHistory: string[]): Promise<string> => {
  if (codeHistory.length === 0) {
    return "";
  }
  if (codeHistory.length === 1) {
    return `The code you provided is:\n${codeHistory[0]}`;
  }
  // mention the latest code first, then the previous code
  return `The last code that failed:\n${
    codeHistory[codeHistory.length - 1]
  }\nAnd here are the previous tries:\n${codeHistory.slice(0, -1).join("\n")}`;
};

export const TOOLFUNCTION_SCRIPT_EXECUTOR = async (
  script: string,
  parameters?: any
): Promise<{ success: boolean; output: any; error?: string }> => {
  logger.tool("Preparing to execute dynamic script", { 
    action: "SCRIPT_EXECUTE_START",
    scriptLength: script.length,
    hasParameters: !!parameters,
    parameterCount: parameters ? Object.keys(parameters).length : 0
  });

  try {
    // Create a function from the script body with all available libraries
    const scriptFunction = new Function(
      "axios",
      "fs",
      "path",
      "os",
      "dotenv",
      "express",
      "cors",
      "bodyParser",
      "mongoose",
      "jsonwebtoken",
      "bcrypt",
      "multer",
      "S3_storeFileToS3",
      "parameters",
      `
      return (async () => {
        ${script}
      })();
    `
    );
    
    // Execute with all libraries available
    const result = await scriptFunction(
      axios,
      fs,
      path,
      os,
      dotenv,
      express,
      cors,
      bodyParser,
      mongoose,
      jsonwebtoken,
      bcrypt,
      multer,
      S3_storeFileToS3,
      parameters
    );
    
    logger.tool("Dynamic script executed successfully", {
      action: "SCRIPT_EXECUTE_COMPLETE",
      outputType: typeof result,
      resultSize: typeof result === 'string' ? result.length : 
                 Array.isArray(result) ? result.length : 
                 typeof result === 'object' ? Object.keys(result || {}).length : 0
    });
    
    return {
      success: true,
      output: result
    };
  } catch (error) {
    logger.error("Failed to execute dynamic script", {
      action: "SCRIPT_EXECUTE_ERROR",
      error: error instanceof Error ? error.message : String(error),
      scriptLength: script.length
    });
    return {
      success: false,
      output: null,
      error: (error as Error).message
    };
  }
};

// a function that runs a while loop until the script is approved
export const TOOLSACTION_GENERATE_SCRIPT = async (
  prompt: string,
  maxAttempts: number = 5,
  context?: string,
  forceNew: boolean = false
): Promise<{
  script: string;
  parameters?: any;
  description?: string;
  errormsg?: string;
  errorHistory?: string[];
  codeHistory?: string[];
  output?: any;
}> => {
  const memoryManager = new ScriptMemoryManager();

  // Try to reuse existing script unless forceNew is true
  if (!forceNew) {
    try {
      const existingScript = await memoryManager.findSimilarScript(prompt);
      if (existingScript) {
        console.log("Found existing script with similar prompt");
        return existingScript;
      }
    } catch (error) {
      console.error("Error finding similar script:", error);
      // Continue with generating new script rather than failing
    }
  }

  // If no existing script found or forceNew is true, generate new script
  let approved = false;
  let codeHistory: string[] = [];
  let errors: string[] = [];
  let scriptOBJ: {
    script: string;
    err: boolean;
    parameters?: any;
    description?: string;
    errormsg?: string;
    errorHistory: string[];
    codeHistory: string[];
    output?: any;
  } = {
    script: "",
    err: false,
    parameters: null,
    description: "",
    errormsg: "",
    errorHistory: [],
    codeHistory: [],
    output: null,
  };
  let attempts = 0;

  while (!approved && attempts < maxAttempts) {
    scriptOBJ = await TOOLFUNCTION_SCRIPT_WRITER (
      prompt,
      codeHistory,
      errors,
      context
    ) as ScriptWriterResult;
    if (scriptOBJ.err) {
      return scriptOBJ;
    }

    const execResult = await TOOLFUNCTION_SCRIPT_EXECUTOR(
      scriptOBJ.script,
      scriptOBJ.parameters
    );
    approved = execResult.success;

    if (!approved) {
      errors.push(execResult.error || "Unknown error");
      codeHistory.push(scriptOBJ.script);
      scriptOBJ.errormsg = execResult.error || "Unknown error";
      scriptOBJ.errorHistory = [...errors];
      scriptOBJ.codeHistory = [...codeHistory];
    }
    attempts++;
  // wait for 5 seconds
  await new Promise(resolve => setTimeout(resolve, 5000));
  }

  // Store the result in Pinecone
  await memoryManager.storeScript(
    prompt,
    {
      prompt,
      script: scriptOBJ.script,
      parameters: scriptOBJ.parameters,
      description: scriptOBJ.description,
      output: scriptOBJ.output,
    },
    approved
  );

  return scriptOBJ;
};


// Use the interface in the function return type
export const TOOLSACTION_DYNAMIC_SCRIPT_EVALUATEANDCREATE = async (
  prompt: string, 
  maxAttempts: number = 5, 
  context?: string
): Promise<ScriptEvaluationResult> => {
  // Combine prompt and context for pre-execution evaluation
  const fullPrompt = context ? `${prompt}\nContext: ${context}` : prompt;

  // Pre-execution evaluation
  const preEvaluation = await generateObject({
    model: await MODEL_getModel_ai(MODEL_CONFIG.REQUIREMENTS_ANALYZER),
    system: `You are a javascript requirements analyzer. Your job is to:
1. Analyze the prompt and identify ALL required information and dependencies
2. Check if any required information is missing
3. Determine if the request is feasible
4. Identify potential error scenarios that need to be handled
5. Only accept JAVASCRIPT requests. Any other language will be rejected.`,
    prompt: fullPrompt,
    schema: z.object({
      feasible: z
        .boolean()
        .describe("Whether the request is technically feasible"),
      requiredInfo: z
        .array(z.string())
        .optional()
        .describe("List of all required information"),
      missingInfo: z
        .array(z.string())
        .optional()
        .describe("List of missing required information"),
      potentialErrors: z
        .array(z.string())
        .optional()
        .describe("Potential error scenarios to handle"),
      suggestedApproach: z
        .string()
        .optional()
        .describe("Suggested approach to handle the request"),
    }),
  });

  // If there's missing information, return it in the error message
  if (
    preEvaluation.object.missingInfo &&
    preEvaluation.object.missingInfo.length > 0
  ) {
    return {
      script: "",
      parameters: null,
      description: "Missing Required Information",
      error: `Please provide the following information: ${preEvaluation.object.missingInfo.join(
        ", "
      )}`,
      approved: false,
      message: "Missing Required Information",
    };
  }

  // Generate the script
  let scriptOBJ = await TOOLSACTION_GENERATE_SCRIPT(
    prompt,
    maxAttempts,
    context
  );

  // Post-execution validation
  // if (!scriptOBJ.error) {
  //   const postValidation = await generateObject({
  //     model: await MODEL_getModel_ai({
  //       modelName: "gpt-4o-mini",
  //       provider: ModelProviderEnum.OPENAI,
  //       temperature: 0,
  //     }),
  //     system: "You are a script validator. Verify the script meets all requirements and handles potential errors.",
  //     prompt: `Original prompt: ${prompt}\nGenerated script: ${scriptOBJ.script}\nPotential errors to handle: ${preEvaluation.object.potentialErrors?.join(", ") || ""}`,
  //     schema: z.object({
  //       meetsRequirements: z.boolean(),
  //       missingErrorHandling: z.array(z.string()),
  //       suggestedImprovements: z.array(z.string()),
  //       criticalIssues: z.array(z.string()),
  //     }),
  //   });

  //   // If validation fails, try to improve the script
  //   if (!postValidation.object.meetsRequirements) {
  //     const improvedContext = `${context || ""}\nRequired improvements:\n${postValidation.object.suggestedImprovements.join("\n")}\nMissing error handling:\n${postValidation.object.missingErrorHandling.join("\n")}`;

  //     // Attempt to generate an improved version
  //     scriptOBJ = await TOOLSACTION_GENERATE_SCRIPT(prompt, maxAttempts, improvedContext, true);
  //   }
  // }


  return {
    script: scriptOBJ.script,
    parameters: scriptOBJ.parameters,
    description: scriptOBJ.description,
    error: scriptOBJ.errormsg,
    approved: true,
    message: "Script approved",
  };
};    



export async function saveToPinecone(
  data: any,
  metadata: any,
  namespace: string
) {
  const metadataWithTimestamp = {
    ...metadata,
    timestamp: Date.now(),
  };

  await PINECONE_storeData({
    toStore: data,
    metadata: metadataWithTimestamp,
    namespace,
  });
}

export async function trackScriptReuse(
  originalPrompt: string,
  matchedScript: string,
  score: number,
  success: boolean
) {
  await saveToPinecone(
    originalPrompt,
    {
      type: "script_reuse_metric",
      originalPrompt,
      matchedScript,
      score,
      success,
      timestamp: Date.now(),
    },
    "SCRIPT_REUSE_METRICS"
  );
}

export const AGENT_TOOLS_DYNAMIC_ACTION_getAllCustomScriptsForAgent = async (agentName: string, userId: string) => {
  const scripts:GeneralPurpose[] = await SERVER_getGeneralPurposeDataMany(`SAVED_CUSTOM_SCRIPTS_${agentName}_${userId}`);
  return scripts.map((script) => `${script.meta1} - ${script.meta2}`).join("\n");
};

/**
 * Core functionality for dynamic actions
 */
// Create a singleton tools list
const dynamicTools: DynamicToolConfig[] = [];

// Add a tool to the action core
export async function DYNAMIC_ACTION_addTool(tool: DynamicToolConfig) {
  dynamicTools.push(tool);
  return true;
}

// Get all tools
export async function DYNAMIC_ACTION_getTools() {
  return dynamicTools;
}

// Execute an action with the LLM
export async function DYNAMIC_ACTION_execute(prompt: string) {
  try {
    const config = MODEL_CONFIG.AGENT;
    
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY as string,
    });
    
    const response = await openai.chat.completions.create({
      model: config.modelName,
      messages: [{ role: "user", content: prompt }],
      temperature: config.temperature,
      tools: dynamicTools.map(tool => ({
        type: "function" as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        }
      })),
    });

    return response;
  } catch (error) {
    console.error("Error executing dynamic action:", error);
    throw error;
  }
}
