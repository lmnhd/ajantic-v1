import { AgentComponentProps, ContextContainerProps, ModelProviderEnum, ServerMessage, ValueType } from "@/src/lib/types";
import modelsData from "@/src/app/api/model/vercel_models.json";
import { AgentFormData } from "@/components/teams/auto_gen_wf/types";
import { RequestFormSchema } from "@/src/lib/post-message-analysis/form-creator-core";
import { generateObject } from "ai";
import { MODEL_getModel_ai } from "@/src/lib/vercelAI-model-switcher";
import { MODEL_getModelArgsByName, MODEL_JSON } from "@/src/lib/utils";
import { z } from "zod";

export const UTILS_TEAMS_listAllAIModels = (): Promise<{modelName: string, provider: string, isThinkingModel: boolean}[]> => {
   const models: {modelName: string, provider: string, isThinkingModel: boolean}[] = [];

   // Process all providers and models from the JSON object
   Object.keys(modelsData).forEach(provider => {
      const providerModels = modelsData[provider as keyof typeof modelsData];
      Object.entries(providerModels).forEach(([modelName, modelInfo]) => {
         models.push({
            modelName: modelName,
            provider: (modelInfo as any).provider,
            isThinkingModel: (modelInfo as any).isThinkingModel
         });
      });
   });

   return Promise.resolve(models);
}

export const UTILS_jsonToXmlString = async (obj: any, indent = 0, contextName = ""): Promise<string> => {
   if (obj === null || obj === undefined) {
     return "<null/>";
   }
 
   // Handle primitive types
   if (typeof obj !== "object") {
     return String(obj);
   }
 
   const indentStr = " ".repeat(indent);
   const indentStrInner = " ".repeat(indent + 2);
 
   if (Array.isArray(obj)) {
     if (obj.length === 0) return `${indentStr}<${contextName || "array"}/>`;
 
     // Format array items
     const itemPromises = obj.map(async (item, index) => {
       if (typeof item === "object" && item !== null) {
         // Try to determine a more descriptive item name
         let itemTypeName = contextName ? `${contextName}_item` : "item";
         
         // If it's an object with a name or type property, use that for added context
         if (!Array.isArray(item) && item.name) {
           itemTypeName = item.name.replace(/\s+/g, "_").toLowerCase();
         } else if (!Array.isArray(item) && item.type) {
           itemTypeName = item.type.replace(/\s+/g, "_").toLowerCase();
         } else {
           // Append item index for uniqueness
           itemTypeName = Array.isArray(item) 
             ? `${itemTypeName}_array_${index}` 
             : `${itemTypeName}_object_${index}`;
         }
         
         const xmlContent = await UTILS_jsonToXmlString(
           item, 
           indent + 4, 
           itemTypeName
         );
         
         return `${indentStrInner}<${itemTypeName}>\n${indentStrInner}${xmlContent}\n${indentStrInner}</${itemTypeName}>`;
       } else {
         return `${indentStrInner}<item>${item}</item>`;
       }
     });
     
     const items = await Promise.all(itemPromises);
     const arrayTag = contextName ? `${contextName}_array` : "array";
     return `${indentStr}<${arrayTag}>\n${items.join("\n")}\n${indentStr}</${arrayTag}>`;
   }
 
   // Handle objects
   const entryPromises = Object.entries(obj).map(async ([key, value]) => {
     if (value === null || value === undefined) {
       return `${indentStrInner}<${key}/>`;
     }
 
     if (typeof value === "object") {
       // Pass the key as context for the child object/array
       const xmlContent = await UTILS_jsonToXmlString(value, indent + 4, key);
       return `${indentStrInner}<${key}>\n${xmlContent}\n${indentStrInner}</${key}>`;
     }
 
     return `${indentStrInner}<${key}>${value}</${key}>`;
   });
 
   const entries = await Promise.all(entryPromises);
   const objectTag = contextName ? `${contextName}_object` : "object";
   return `${indentStr}<${objectTag}>\n${entries.join("\n")}\n${indentStr}</${objectTag}>`;
 };

 export const UTILS_TEAMS_infoRequestContextFormSet = (requestFormSchema: RequestFormSchema, hiddenFromAgents: string[], currentAgent: AgentComponentProps, history: ServerMessage[], fullScreen: boolean): ContextContainerProps => {
  const contextForm: ContextContainerProps = {
    setName: requestFormSchema?.formName ?? "Unnamed Form",
    lines: [],
    text: "",
    isDisabled: false,
    formSchema: {
      schema: requestFormSchema?.schema?.map(item => ({
        formName: item.formName,
        key: item.key,
        valueType: item.valueType as ValueType,
        enumValues: item.enumValues,
        enumLabels: item.enumLabels
      })) ?? [],
      formName: requestFormSchema?.formName ?? "",
    },
    fullScreen: fullScreen,
    // Hidden from all agents
    hiddenFromAgents: hiddenFromAgents,
    requestData: {
      agentName: currentAgent.name,
      message: requestFormSchema?.requestMessage ?? "",
      history: history,
    }
  };
  return contextForm;
};


