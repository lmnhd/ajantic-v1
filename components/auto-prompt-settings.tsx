import { useState, useEffect } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import {
  AgentComponentProps,
  AISessionState,
  GlobalMessages,
  
  ModelArgs,
  ModelNames,
  ModelProviderEnum,
} from "@/src/lib/types";
import { convertToCoreMessages, generateText, Message } from "ai";

import AgentComponent from "./agent-component";
import { AnthropicModelNames } from "@/src/app/api/model/anthropic";
import { GoogleGenerativeAIModelNames } from "@/src/app/api/model/google";
import { MistralModelNames } from "@/src/app/api/model/mistral";
import { CohereModelNames } from "@/src/app/api/model/cohere";
import { useGlobalStore } from "@/src/lib/store/GloabalStoreState";
import {
  UTILS_getGenericData,
  UTILS_putGenericData,
  UTILS_setServerMessagesCurrentState,
  UTILS_updateModelNameAfterProviderChange,
} from "@/src/lib/utils";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ClientMessage } from "@/src/lib/aicontext";
import { db } from "@/src/lib/db";
import { GeneralPurpose } from "@prisma/client";
import {
  SERVER_getGeneralPurposeDataMany,
  SERVER_getGeneralPurposeDataSingle,
  SERVER_storeGeneralPurposeData,
} from "@/src/lib/server";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { toast } from "@/components/ui/use-toast";
import { AxeIcon } from "lucide-react";
import { Tabs } from "./agent-3d-tabs";
import { AGENT_AUTO_PROMPT } from "../prompts/auto-prompt";
import { openai } from "@ai-sdk/openai";
import { ANALYSIS_TOOLS_autoPrompt } from "../src/lib/analysis_server";
import { Button } from "@/components/ui/button";
import { ModelProviderSelect } from "@/components/global/model-provider-select";

const AutoPromptSettings = ({
  autoPromptModel,
  setAutoPromptModel,
  currentAgentIndex,
  globalMessages,
  setGlobalMessages,
}: {
  autoPromptModel: ModelArgs;
  setAutoPromptModel: (model: ModelArgs) => void;
  currentAgentIndex: number;
  globalMessages: GlobalMessages;
  setGlobalMessages: (messages: GlobalMessages) => void;
}) => {


  const [initialized, setInitialized] = useState(false);
  const [lastAutoPromptModelName, setLastAutoPromptModelName] = useState("");
  const storeAutoPromptModel = async () => {
    await SERVER_storeGeneralPurposeData(
      
      JSON.stringify(autoPromptModel),
      "autoPromptModel",
      globalMessages.currentState.userId,
      "autoPromptModel",
      `AutoPromptModel-${globalMessages.currentState.userId}`,
      false
    );

    // toast({
    //   title: "Auto Prompt Model Stored",
    //   description: "Auto prompt model stored successfully",
    // });
  };
  const loadLastAutoPromptModel = async () => {
    const lastAutoPromptModel = await SERVER_getGeneralPurposeDataSingle(
      `AutoPromptModel-${globalMessages.currentState.userId}`
    );
    if (lastAutoPromptModel) {
      try {
        console.log("FOUND LAST AUTO PROMPT MODEL", lastAutoPromptModel);
        setAutoPromptModel(JSON.parse(lastAutoPromptModel.content));
        setLastAutoPromptModelName(JSON.parse(lastAutoPromptModel.content).modelName);
      } catch (e) {
        console.error("ERROR PARSING AUTO PROMPT MODEL", e);
      }
    }

    toast({
      title: "Auto Prompt Model Loaded",
      description: "Auto prompt model loaded successfully",
    });
  };

  useEffect(() => {
    if (!initialized) {
      //console.log("LOADING LAST AUTO PROMPT MODEL");
      loadLastAutoPromptModel();
      setInitialized(true);
    }
  }, []);

  useEffect(() => {
    if (!initialized) return;
    if (autoPromptModel.modelName === lastAutoPromptModelName) return;
    console.log("STORING AUTO PROMPT MODEL");
    storeAutoPromptModel();
  }, [autoPromptModel]);

  const getFirstModelName = (provider: ModelProviderEnum) => {
    switch (provider) {
      case ModelProviderEnum.OPENAI:
        return "gpt-4o-mini";
      case ModelProviderEnum.ANTHROPIC:
        return AnthropicModelNames["claude-3-5-sonnet-20240620"];
      case ModelProviderEnum.GOOGLE_G:
        return GoogleGenerativeAIModelNames["models/gemini-1.5-flash-latest"];
      case ModelProviderEnum.MISTRAL:
        return MistralModelNames["mistral-large-latest"];
      case ModelProviderEnum.COHERE:
        return CohereModelNames["command-r-plus"];
      default:
        return "gpt-4o-mini";
    }
  };

  useEffect(() => {
    if (!globalMessages.currentState || !globalMessages.currentState.genericData || !globalMessages.currentState.genericData.autoPromptModel) return;
    setAutoPromptModel(globalMessages.currentState.genericData.autoPromptModel);
    console.log("AUTO PROMPT MODEL INITIALIZED", autoPromptModel);
  }, []);

  useEffect(() => {
    console.log("AUTO PROMPT MODEL CHANGED", autoPromptModel);

    setGlobalMessages({
      ...globalMessages,
      currentState: {
        ...globalMessages.currentState,
        genericData: {
          ...globalMessages.currentState.genericData,
          autoPromptModel,
        },
      },
    });
  }, [
    autoPromptModel.modelName,
    autoPromptModel.provider,
    autoPromptModel.temperature,
  ]);

  return (
    <div>
      <Collapsible title="Auto Prompt Settings">
        <CollapsibleTrigger className="text-sm font-thin tracking-widest p-2 rounded-sm shadow-sm mb-1 bg-white/10">
          Auto Prompt Settings
        </CollapsibleTrigger>
        <CollapsibleContent className="flex flex-col gap-2">
          <div className="text-sm font-thin">auto prompt model</div>
          <ModelProviderSelect
            model={autoPromptModel}
            index={currentAgentIndex}
            localState={globalMessages.currentState}
            setLocalState={(state: AISessionState) => {
              setGlobalMessages({
                ...globalMessages,
                currentState: {
                  ...globalMessages.currentState,
                  genericData: {
                    ...globalMessages.currentState.genericData,
                    autoPromptModel: autoPromptModel,
                  },
                },
              });
            }}
            modelProviderChanged={(e) => {
              const _newState: ModelArgs = {
                ...autoPromptModel,
                provider: e as ModelProviderEnum,
                modelName: getFirstModelName(e as ModelProviderEnum),
              };
              //handleAutoPromptModelChange(JSON.stringify(_newState));

              setAutoPromptModel(_newState);

              console.log(
                "new autoPromptModel",
                globalMessages.currentState.genericData.autoPromptModel
              );
            }}
            modelNameChanged={(e) => {
              const _newState = { ...autoPromptModel, modelName: e };
              //handleAutoPromptModelChange(JSON.stringify(_newState));

              setAutoPromptModel(_newState);

              console.log(
                "new autoPromptModel",
                globalMessages.currentState.genericData.autoPromptModel
              );
            }}
            temperatureChanged={(e) => {
              const _newState = { ...autoPromptModel, temperature: e };
              //handleAutoPromptModelChange(JSON.stringify(_newState));

              setAutoPromptModel(_newState);

              console.log(
                "new autoPromptModel",
                globalMessages.currentState.genericData.autoPromptModel
              );
            }}
          />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default AutoPromptSettings;
