"use server"

import { ServerMessage } from "@/src/lib/types";

export type DynamicFormValueType =
  | "string"
  | "number"
  | "boolean"
  | "object"
  | "array"
  | "null"
  | "undefined"
  | "date"
  | "enum"
  | "file";

export type DynamicFormSchemaValue = {
  key: string;
  valueType: DynamicFormValueType;
  enumValues?: string[];
  enumLabels?: string[];
  description?: string;
  options?: string[];
  fileTypes?: string[];
  group?: string;
  formName: string;
};

export type DynamicFormSchema = DynamicFormSchemaValue[];

export type RequestFormSchema = {
  formName: string;
  schema: DynamicFormSchema;
  requestingAgentName: string;
  requestMessage: string;
  historyUpToThisPoint: ServerMessage[];
    
}

export type FormCreatorResult = {
  formSchema: DynamicFormSchema;
  formName: string;
}

