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
  const result = await generateObject({
    model: await MODEL_getModel_ai(UTILS_getModelArgsByName(UTILS_getModelsJSON().OpenAI["gpt-4o-mini"].name, 0)),
    messages: [
      {
        role: "system",
        content: `You are an expert web form designer focused on creating precise, targeted forms. Your task is to analyze the provided message and create a form schema that ONLY collects the specific information explicitly requested or implied by the message.

Key principles:
1. ONLY include fields that are directly related to the information being requested
2. Do NOT add any fields that weren't mentioned or implied in the request
3. Prioritize providing the user with options whenever feasible.
4. Use appropriate field types based on the following priority:
   - string: Use ONLY for unique personal information (like names, specific IDs) or when options are impossible.
   - enum_or_custom: PREFERRED - Use when there are potential options, but the user might need to enter a custom value. Provide suggested options in 'enumValues'/'enumLabels'.
   - enum: Use when there is a small, fixed set of known options. Provide these options in 'enumValues'/'enumLabels'.
   - date: for dates.
   - number: for numerical values.
   - file: for file uploads.
   - boolean: for simple yes/no choices.
5. Add clear descriptions to help users understand what information is needed
6. Group related fields if multiple fields are needed for a single request using the 'group' property
7. Always generate 'enumValues' and 'enumLabels' when using 'enum' or 'enum_or_custom'.

Example 1 (Request: "What is your name and email?"):
Fields: [{ key: "name", valueType: "string" }, { key: "email", valueType: "string" }]
Example 2 (Request: "What type of document is this? It could be an invoice, receipt, or maybe a contract."):
Fields: [{ key: "documentType", valueType: "enum_or_custom", enumValues: ["invoice", "receipt", "contract"], enumLabels: ["Invoice", "Receipt", "Contract"] }]
Example 3 (Request: "Select the primary color: Red, Green, or Blue?"):
Fields: [{ key: "primaryColor", valueType: "enum", enumValues: ["red", "green", "blue"], enumLabels: ["Red", "Green", "Blue"] }]`,
      },
      {
        role: "user",
        content: messageContainaingRequest,
      },
    ],
    schema: z.object({
      formSchema: z
        .array(
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
            ]),
            enumValues: z.array(z.string()).optional(),
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
        )
        .describe(
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

