"use client";
import {
  ModelProviderEnum,
  ModelNames,
  ModelArgs,
  AISessionState,
  ModelProviderSelectName,
} from "@/src/lib/types";
import React, { useEffect, useRef, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { AnthropicModelNames } from "@/src/app/api/model/anthropic";
import { MistralModelNames } from "@/src/app/api/model/mistral";
import { CohereModelNames } from "@/src/app/api/model/cohere";
import { GoogleGenerativeAIModelNames } from "@/src/app/api/model/google";
import {
  cn,
  UTILS_getGenericData,
  UTILS_putGenericData,
  UTILS_updateModelNameAfterProviderChange,
} from "@/src/lib/utils";
import { SERVER_getOpenAIModelNames } from "@/src/lib/server";
import { OpenAIModelNames } from "@/src/app/api/model/openai";
import { DeepSeekModelNames } from "@/src/app/api/model/deepseek";
import modelsData from "@/src/app/api/model/vercel_models.json";

type ModelProviderSelectProps = {
  model: ModelArgs;
  index: number;
  localState: AISessionState;
  modelNameChanged?: (e: string) => void;
  modelProviderChanged?: (e: string | ModelProviderEnum) => void;
  temperatureChanged?: (e: number) => void;
};

// Helper function to map string back to Enum member
function mapStringToProviderEnum(providerString: string): ModelProviderEnum | undefined {
    const upperCaseProvider = providerString?.toUpperCase(); // Ensure uppercase and handle potential null/undefined
    switch (upperCaseProvider) {
        case "OPENAI": return ModelProviderEnum.OPENAI;
        case "ANTHROPIC": return ModelProviderEnum.ANTHROPIC;
        case "DEEPSEEK": return ModelProviderEnum.DEEPSEEK;
        case "MISTRAL": return ModelProviderEnum.MISTRAL;
        case "COHERE": return ModelProviderEnum.COHERE;
        case "GOOGLE": return ModelProviderEnum.GOOGLE_G; // Assuming "GOOGLE" string maps to GOOGLE_G enum
        case "BEDROCK": return ModelProviderEnum.BEDROCK;
        default:
            console.warn(`Unknown provider string: ${providerString}`);
            return undefined; // Or handle error appropriately
    }
}

export const ModelProviderSelect: React.FC<ModelProviderSelectProps> = ({
  model,
  index,
  localState,
  modelNameChanged,
  modelProviderChanged,
  temperatureChanged,
}) => {
  const temperatureRef = useRef<HTMLInputElement>(null);
  const [tempText, setTempText] = useState<string>(
    (model.temperature ?? 0.7).toString()
  );

  useEffect(() => {
    setTempText((model.temperature ?? 0.7).toString());
  }, [model.temperature]);

  const providerStringValue = model.provider ? String(model.provider).toUpperCase() : undefined;

  return (
    <div>
      <Select
        value={providerStringValue}
        onValueChange={(stringValue) => {
          if (modelProviderChanged) {
            modelProviderChanged(stringValue);
          }
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select a model provider" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ANTHROPIC">Anthropic</SelectItem>
          <SelectItem value="OPENAI">OpenAI</SelectItem>
          <SelectItem value="DEEPSEEK">DeepSeek</SelectItem>
          <SelectItem value="MISTRAL">Mistral</SelectItem>
          <SelectItem value="COHERE">Cohere</SelectItem>
          <SelectItem value="GOOGLE">Google GenAI</SelectItem>
          <SelectItem value="BEDROCK">Bedrock</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={model.modelName as string}
        onValueChange={(e) => {
          if (modelNameChanged) {
            modelNameChanged(e);
          }
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select a model name" />
        </SelectTrigger>
        <SelectContent>
          {model.provider === ModelProviderEnum.OPENAI &&
            (() => {
              console.log(`>>> Condition MET: Rendering OpenAI models from modelsData.json`);
              return Object.keys(modelsData.OpenAI).map((modelName) => (
                <SelectItem key={modelName} value={modelName}>
                  {modelName}
                </SelectItem>
              ));
            })()}
          {model.provider === ModelProviderEnum.ANTHROPIC &&
            Object.keys(modelsData.Anthropic).map((modelName) => (
              <SelectItem key={modelName} value={modelName}>
                {modelName}
              </SelectItem>
            ))}
          {model.provider === ModelProviderEnum.MISTRAL &&
            Object.keys(modelsData.Mistral).map((modelName) => (
              <SelectItem key={modelName} value={modelName}>
                {modelName}
              </SelectItem>
            ))}
          {model.provider === ModelProviderEnum.COHERE &&
            Object.keys(modelsData.Cohere).map((modelName) => (
              <SelectItem key={modelName} value={modelName}>
                {modelName}
              </SelectItem>
            ))}
          {model.provider === ModelProviderEnum.GOOGLE_G &&
            Object.keys(modelsData.Google).map((modelName) => (
              <SelectItem key={modelName} value={modelName}>
                {modelName}
              </SelectItem>
            ))}
          {model.provider === ModelProviderEnum.DEEPSEEK &&
            Object.keys(modelsData.DeepSeek).map((modelName) => (
              <SelectItem key={modelName} value={modelName}>
                {modelName}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
      {temperatureChanged && (
        <div className="mt-2">
          <label
            htmlFor={`temp-range-${index}`}
            className="text-xs text-gray-400 block mb-1"
          >
            Temperature: {tempText}
          </label>
          <input
            id={`temp-range-${index}`}
            ref={temperatureRef}
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={tempText}
            onChange={(e) => {
              const newTemp = parseFloat(e.target.value);
              setTempText(e.target.value);
              temperatureChanged(newTemp);
            }}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      )}
    </div>
  );
};

export default function ModelSelectGroup({
  localState,
  setLocalState,
}: {
  localState: AISessionState;
  setLocalState: (state: AISessionState) => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-col p-4 rounded-md m-4 border-[1px] border-violet-500/20 w-48 items-center justify-center gap-4 bg-gradient-to-bl from-slate-800/80 to-slate-900/80"
      )}
    >
      <h2 className="text-violet-500 text-lg font-bold">Model Select</h2>
      {localState?.currentModels?.map((model, index) => (
        <div key={index}>
          <ModelProviderSelect
            model={model}
            index={index}
            localState={localState}
            modelProviderChanged={(providerValue) => {
              const actualEnumProvider = mapStringToProviderEnum(providerValue as string);
              if (!actualEnumProvider) return;

              const newModelName = UTILS_updateModelNameAfterProviderChange(actualEnumProvider);

              if (newModelName === undefined) {
                  console.error(`Could not find a default model for provider: ${actualEnumProvider}`);
                  return;
              }

              const updatedModels = localState.currentModels.map((m, i) =>
                i === index ? { ...m, provider: actualEnumProvider, modelName: newModelName as ModelNames } : m
              );
              setLocalState({ ...localState, currentModels: updatedModels });
            }}
            modelNameChanged={(name) => {
              const updatedModels = localState.currentModels.map((m, i) =>
                i === index ? { ...m, modelName: name as ModelNames } : m
              );
              setLocalState({ ...localState, currentModels: updatedModels });
            }}
            temperatureChanged={(temp) => {
              const updatedModels = localState.currentModels.map((m, i) =>
                i === index ? { ...m, temperature: temp } : m
              );
              setLocalState({ ...localState, currentModels: updatedModels });
            }}
          />
        </div>
      ))}
    </div>
  );
}
