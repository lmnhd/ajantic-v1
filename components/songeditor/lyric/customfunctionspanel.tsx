import { Button } from "@/components/ui/button";
import { useGlobalStore } from "@/src/lib/store/GloabalStoreState";
import { __updateAIState } from "@/src/lib/lyric-helpers";
import React from "react";
import { AISessionState, CustomFunction, GlobalMessages, ModelArgs, ModelProviderEnum } from "@/src/lib/types";

interface CustomFunctionsPanelProps {
  // Add props if needed in the future
}

export default function CustomFunctionsPanel(_props: CustomFunctionsPanelProps) {
  const { globalMessages, setGlobalMessages } = useGlobalStore();
  const { customRequests, useCustomRequests } = globalMessages.currentState;

  const updateGlobalMessages = (updates: Partial<AISessionState>) => {
    if (updates.currentModels) {
      updates.currentModels = updates.currentModels.map((model) => ({
        ...model,
        provider: model.provider as ModelProviderEnum,
        modelName: model.modelName,
        temperature: model.temperature ?? 0.7
      }));
    }
    const updatedMessages = __updateAIState(globalMessages, updates) as GlobalMessages;
    setGlobalMessages(updatedMessages);
  };

  return (
    <div className="relative">
      {!useCustomRequests && <h1 className="absolute left-52 top-10 font-bold text-4xl shadow-lg? shadow-white">- INSTRUCT DISABLED -</h1>}
      <div className={`flex flex-col items-end? w-2/3 mx-10 h-fit min-h-8 my-10 p-4 ${
        useCustomRequests
          ? "text-violet-400"
          : "text-gray-500 opacity-50? blur-sm"
      } hover:bg-violet-400/20 rounded-md bg-gray-600/20`}>
        <h1 
          className="text-2xl text-right font-thin p-2 m-2 cursor-pointer hover:font-bold w-full text-blue-700"
          onClick={() => {
            updateGlobalMessages({ useCustomRequests: !useCustomRequests });
          }}
        >
          Custom Instruct
        </h1>
        <div className="flex flex-col gap-6">
          {customRequests.map((r: CustomFunction, i: number) => (
            <div
              key={i}
              className="relative flex items-center justify-center p-2 italic bg-gray-500/10 rounded-md w-full"
            >
              <Button
                className="absolute left-0 h-full"
                onClick={() => {
                  const newRequests = customRequests.filter((req) => req.name !== r.name);
                  updateGlobalMessages({ customRequests: newRequests });
                }}
              >
                x
              </Button>
              <p>{r.name}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
