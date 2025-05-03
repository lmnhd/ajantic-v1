"use server"
import { generateObject } from "ai";
import { PostMessageAnalysisProps } from "../analysis_server";

import { MODEL_getModel_ai } from "@/src/lib/vercelAI-model-switcher";
import { OpenAIModelNames } from "@/src/app/api/model/openai";
import { ModelProviderEnum, ServerMessage } from "@/src/lib/types";
import { z } from "zod";
import { logger } from "@/src/lib/logger";
import { MODEL_JSON, MODEL_getModelArgsByName, UTILS_getModelArgsByName } from "@/src/lib/utils";
import { UTILS_getModelsJSON } from "@/src/lib/utils";
import { FormCreatorResult, RequestFormSchema } from "./form-creator-core";
import { DynamicFormValueType } from "./form-creator-core";

// Define the value types as string literals for server component
const VALUE_TYPES = {
  STRING: "string",
  NUMBER: "number",
  BOOLEAN: "boolean",
  OBJECT: "object",
  ARRAY: "array",
  NULL: "null",
  UNDEFINED: "undefined",
  DATE: "date",
  ENUM: "enum",
  FILE: "file",
  ENUM_OR_CUSTOM: "enum_or_custom",
} as const;

export async function ANALYSIS_TOOLS_formCreator(
  messageContainaingRequest: string
): Promise<FormCreatorResult> {
  logger.log(`Generating form for request...`, {
    messageContainaingRequest,
  });
  const systemPrompt = `You are a form schema creator. Your primary task is to analyze requests and create form schemas.

CRITICAL INSTRUCTION: For ANY field where options or examples are mentioned in the request (especially in parentheses like "e.g." or "such as"), ALWAYS use valueType: "enum_or_custom".

Field type selection rules in ORDER OF PRIORITY:
1. enum_or_custom: REQUIRED whenever ANY examples or options are mentioned
2. enum: Only when options are fixed with no custom input needed
3. Other types (string, number, date, etc.) ONLY when no options can be inferred

ALWAYS extract ALL potential options mentioned in the message as enumValues.

Examples of CORRECT behavior:
Request: "What's your favorite color?"
INCORRECT: { key: "favoriteColor", valueType: "string" }
CORRECT: { key: "favoriteColor", valueType: "enum_or_custom", enumValues: ["red", "blue", "green", "yellow", "purple", "other"] }

Request: "What type of document is this? (e.g., invoice, receipt, contract)"
CORRECT: { key: "documentType", valueType: "enum_or_custom", enumValues: ["invoice", "receipt", "contract"] }`;

  const result = await generateObject({
    model: await MODEL_getModel_ai(UTILS_getModelArgsByName(UTILS_getModelsJSON().OpenAI["gpt-4.5-preview"].name, 0)),
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: messageContainaingRequest,
      },
    ],
    schema: z.object({
      formSchema: z.array(
        z.object({
          key: z.string(),
          valueType: z.enum([
            VALUE_TYPES.STRING,
            VALUE_TYPES.NUMBER,
            VALUE_TYPES.BOOLEAN,
            VALUE_TYPES.OBJECT,
            VALUE_TYPES.ARRAY,
            VALUE_TYPES.NULL,
            VALUE_TYPES.UNDEFINED,
            VALUE_TYPES.DATE,
            VALUE_TYPES.ENUM,
            VALUE_TYPES.FILE,
            VALUE_TYPES.ENUM_OR_CUSTOM,
          ]).describe("ALWAYS use enum_or_custom if any options are mentioned in the request"),
          enumValues: z.array(z.string()).optional()
            .describe("REQUIRED for enum_or_custom - extract ALL potential options mentioned"),
          enumLabels: z.array(z.string()).optional(),
          group: z
            .string()
            .optional()
            .describe(
              "The group the field belongs to. This is used to group fields in the form."
            ),
          fileTypes: z
            .array(z.string())
            .optional()
            .describe("Allowed file types for file upload fields"),
          description: z
            .string()
            .optional()
            .describe(
              "A description of the field. This is used to give the user more information about the field."
            ),
        })
      ).describe(
        "The schema for the form. When feasible, use enums or enums with custom options to give the user specific choices."
      ),
      formName: z.string().describe("The name of the form. For the client to identify the form."),
    }),
  });
  logger.log(`Form created: `, {
    formSchema: result.object.formSchema,
  });
  return {
    formName: result.object.formName, 
    formSchema: result.object.formSchema.map(item => ({
      ...item,
      formName: result.object.formName,
      key: item.key as string,
      valueType: item.valueType as DynamicFormValueType
    }))
  };
}

export async function AGENT_FORM_creator(message: string): Promise<RequestFormSchema> {
  const result = await ANALYSIS_TOOLS_formCreator(message);
  return {
    formName: result.formName,
    schema: result.formSchema.map(item => ({
      ...item,
      formName: result.formName
    })),
    requestingAgentName: "",
    requestMessage: message,
    historyUpToThisPoint: [],
  };
}

export const AGENT_FORM_reWriteRequestMessage = async (requestMessage: string, formName: string): Promise<string> => {
  return `${requestMessage}\n\n Please fill and submit the info request form found in the context titled ${formName}`
};

