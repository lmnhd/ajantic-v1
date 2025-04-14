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
  modelProviderChanged?: (e: string) => void;
  temperatureChanged?: (e: number) => void;
};

export const ModelProviderSelect: React.FC<ModelProviderSelectProps> = ({
  model,
  index,
  localState,
  modelNameChanged,
  modelProviderChanged,
  temperatureChanged,
}) => {
  const [openAIModelNames, setOpenAIModelNames] = useState<
    ModelProviderSelectName[]
  >([]);
  const temperatureRef = useRef<HTMLInputElement>(null);
  const [tempText, setTempText] = useState("0.7");

  const loadOpenAIModelNames = async () => {
    if (
      UTILS_getGenericData("OPENAI_MODEL_NAMES", {
        currentState: localState,
        history: [],
      })
    ) {
      const cachedNames = UTILS_getGenericData("OPENAI_MODEL_NAMES", {
        currentState: localState,
        history: [],
      });
      setOpenAIModelNames(cachedNames);
      return cachedNames;
    } else {
      const modelNames: ModelProviderSelectName[] =
        await SERVER_getOpenAIModelNames();
      UTILS_putGenericData(modelNames, "OPENAI_MODEL_NAMES", {
        currentState: localState,
        history: [],
      });
      setOpenAIModelNames(modelNames);
      return modelNames;
    }
  };

  useEffect(() => {
    if (temperatureRef.current) {
      setTempText(temperatureRef.current.value);
    }
  }, [temperatureRef.current?.value]);

  useEffect(() => {
    loadOpenAIModelNames();
  }, [localState]);

  return (
    <div>
      <Select
        value={model.provider}
        onValueChange={(e) => {
          if (modelProviderChanged) {
            modelProviderChanged(e as ModelProviderEnum);
          }
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select a model provider" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ModelProviderEnum.ANTHROPIC}>Anthropic</SelectItem>
          <SelectItem value={ModelProviderEnum.OPENAI}>OpenAI</SelectItem>
          <SelectItem value={ModelProviderEnum.DEEPSEEK}>DeepSeek</SelectItem>
          <SelectItem value={ModelProviderEnum.MISTRAL}>Mistral</SelectItem>
          <SelectItem value={ModelProviderEnum.COHERE}>Cohere</SelectItem>
          <SelectItem value={ModelProviderEnum.GOOGLE_G}>
            Google GenAI
          </SelectItem>
          <SelectItem value={ModelProviderEnum.BEDROCK}>Bedrock</SelectItem>
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
            Object.keys(modelsData.OpenAI).map((modelName) => (
              <SelectItem key={modelName} value={modelName}>
                {modelName}
              </SelectItem>
            ))}
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
      {/* Temperature Input (if needed, keep separate) */}
      {/* Example - using direct callback */}
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
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={tempText} // Use controlled value
            // defaultValue={model.temperature || 0.7} // Remove default value for controlled input
            onChange={(e) => {
              setTempText(e.target.value); // Update local text state
              temperatureChanged(parseFloat(e.target.value));
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
          />
        </div>
      ))}
    </div>
  );
}
