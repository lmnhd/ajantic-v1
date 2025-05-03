import React, { useEffect } from "react";

import ReferenceStateView from "@/components/global/reference-stateview";
import { useGlobalStore } from "@/src/lib/store/GloabalStoreState";

import { cn, UTILS_getGenericData, UTILS_putGenericData } from "@/src/lib/utils";


import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AgentComponentProps,
  AISessionState,
  AnalysisSet,
  GlobalMessages,
  
  ModelArgs,
  ModelNames,
  ModelProvider,
  ModelProviderEnum,
} from "@/src/lib/types";
import { Button } from "@/components/ui/button";
import { useChat } from "ai/react";
import { useActions } from "ai/rsc";
import { useToast } from "@/components/ui/use-toast";
import { BlockLyricType } from "@/components/songeditor/lyric/block";
import { BoxIcon, CircleArrowDownIcon, Delete } from "lucide-react";

import { set } from "zod";
import { CoreMessage, Message } from "ai";
import { GeneralPurpose } from "@prisma/client";
import {
  ANALYSIS_TOOLS_generatePrompt,
  ANALYSIS_TOOLS_getAnalysisPrompts,
  ANALYSIS_TOOLS_getLastAnalysisMessages,
  ANALYSIS_TOOLS_getLastAnalysisModelName,
  ANALYSIS_TOOLS_quickSaveAnalysisPrompt,
  ANALYSIS_TOOLS_saveAnalysisMessages,
  ANALYSIS_TOOLS_storeLastAnalysisModelName,
} from "../src/lib/analysis_server";
import { AnthropicModelNames, AnthropicProps } from "@/src/app/api/model/anthropic";
import { MistralModelNames, MistralProps } from "@/src/app/api/model/mistral";
import { CohereModelNames, CohereProps } from "@/src/app/api/model/cohere";
import {
  GoogleGenerativeAIModelNames,
  GoogleGenerativeAIProps,
  //GoogleVertexModelNames,
  //GoogleVertexProps,
} from "@/src/app/api/model/google";
import {
  Link,
  Button as ScrollButton,
  Element,
  Events,
  animateScroll as scroll,
  scrollSpy,
  scroller,
} from "react-scroll";
import {
  SERVER_getPromptDirectives,
  SERVER_saveAsPrompt,
  SERVER_savePromptDirectives,
} from "@/src/lib/server";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModelProviderSelect } from "@/components/global/model-provider-select";
import { AutoPromptData } from "./teams/ac_framework";

const PromptWindowControl = ({
  localStateObject,
  setLocalStateObject,
  index,
  promptTextToSet,
  numRows = 6,
  isDirective = false,
  input,
  placeHolder,
  handleInputChange,
  handleAutoPrompt,
  useAutoPrompt,
  autoPromptModel,
  handleAutoPromptModelChange,
  autoPromptExtraInfo,
  setAutoPromptExtraInfo,
}: {
  localStateObject: AISessionState;
  setLocalStateObject: (e: AISessionState) => void;
  index: number;
  promptTextToSet: (text: string) => void;
  numRows?: number;
  isDirective?: boolean;
  input?: string;
  placeHolder?: string;
  handleInputChange?: any;
  useAutoPrompt?: boolean;
  handleAutoPrompt?: (data: string) => Promise<void>;
  autoPromptModel: ModelArgs;
  handleAutoPromptModelChange: (e: string) => void;
  autoPromptExtraInfo: string;
  setAutoPromptExtraInfo: (e: string) => void;

}) => {
  //const [isNewPrompt, setIsNewPrompt] = React.useState<boolean>(false);
  //const [localSavedQuickAnalysisPrompts, setLocalSavedQuickAnalysisPrompts] =
  React.useState<string[]>([]);
  const [analysisQuickPromptsLoaded, setAnalysisQuickPromptsLoaded] =
    React.useState<boolean>(false);
  const [promptDirectives, setPromptDirectives] = React.useState<
    GeneralPurpose[]
  >([]);

  const [addExamples, setAddExamples] = React.useState<number>(0);

  const [localAutoPromptExtraInfo, setLocalAutoPromptExtraInfo] =
    React.useState<string>("");

  const textFieldRef = React.useRef<HTMLTextAreaElement>(null);

  const { appState, setGlobalMessages } = useGlobalStore();

  // const handleAutoPromptModelChange = (model: ModelArgs, property: keyof ModelArgs) => {
  //   setAutoPromptModel((prev) => ({ ...prev, [property]: model[property] }));

  // };
  const loadAllQuickPrompts = async () => {
    // console.log(
    //   "loading all quick prompts genericData",
    //   localStateObject.genericData
    // );
    const qp = UTILS_getGenericData("localSavedQuickAnalysisPrompts", {
      history: [],
      currentState: localStateObject,
    });
    if (qp && qp.length > 0) {
      return;
    }
    // else {
    //   setLocalSavedQuickAnalysisPrompts(qp.map((r: any) => r.content));
    // }

    //console.log("loading all quick prompts", appState.currentUser.id);

    const result = await ANALYSIS_TOOLS_getAnalysisPrompts({
      userId: appState.currentUser.id,
    });
    if (!result) return;
    if (result.length === 0) return;

    //console.log("all quick prompts", result);
    //setLocalSavedQuickAnalysisPrompts(result.map((r) => r.content));
    setGlobalMessages(
      UTILS_putGenericData(
        result.map((r) => r.content),
        "localSavedQuickAnalysisPrompts",
        { history: [], currentState: localStateObject }
      )
    );
    //setLocalSavedQuickAnalysisPrompts(result.map((r) => r.content));
    setAnalysisQuickPromptsLoaded(true);
  };

  useEffect(() => {
    const localSavedQuickAnalysisPrompts = UTILS_getGenericData(
      "localSavedQuickAnalysisPrompts",
      { history: [], currentState: localStateObject }
    );
    //console.log(
    //  "localSavedQuickAnalysisPrompts",
    //  localSavedQuickAnalysisPrompts
    //);
    if (
      !localSavedQuickAnalysisPrompts ||
      localSavedQuickAnalysisPrompts.length === 0 ||
      !analysisQuickPromptsLoaded
    ) {
      //console.log("useEffect-loading all quick prompts");
      loadAllQuickPrompts();
    }
  }, [localStateObject]);

  // PRE-LOAD PROMPT DIRECTIVES
  useEffect(() => {
    const loadPromptDirectives = async () => {
      if (!appState.currentUser) return;
      const result = await SERVER_getPromptDirectives(appState.currentUser.id);
      if (!result) return;
      setPromptDirectives(result);
    };
    loadPromptDirectives();
  }, []);

  useEffect(() => {
    if (isDirective) return;
    // console.log("PROMPT-WINDOW-CONTROL-useEffect", index);
    // console.log(
    //   "PROMPT-WINDOW-CONTROL-globalMessages",
    //   { history: [], currentState: localStateObject }.currentState.currentAgents
    //     .agents[index].systemPrompt
    // );
    if (localStateObject.currentAgents.agents[index].systemPrompt) {
      textFieldRef.current!.value =
        localStateObject.currentAgents.agents[index].systemPrompt;
    }
  }, [localStateObject.currentAgents.agents[index].systemPrompt]);
  useEffect(() => {
    //console.log("PROMPT-WINDOW-CONTROL-autoPromptModel", autoPromptModel);
  }, [
    autoPromptModel.modelName,
    autoPromptModel.provider,
    autoPromptModel.temperature,
  ]);
  return (
    <div className="flex flex-col w-full h-full">
      {/* <div className="flex w-full h-6 items-end justify-end bg-slate-900/90 rounded-md rounded-b-none p-1 ">
        {localStateObject &&
          localStateObject.currentAgents &&
          localStateObject.currentAgents.agents[index].systemPrompt &&
          localStateObject.currentAgents.agents[index].systemPrompt.length >
            5 && (
            <TooltipProvider delayDuration={50}>
              <Tooltip>
                <TooltipTrigger
                  onClick={() => {
                    console.log("Send to set clicked", index);
                    // Handle click event here
                    const _data = {
                      text: localStateObject.currentAgents.agents[index]
                        .systemPrompt,
                      index: index,
                    };
                    console.log("Send to set clicked", _data);
                    promptTextToSet(JSON.stringify(_data));

                    //UTILS_putGenericData(_data, `Analysis-CurrentLineSet-${localStateObject.userId}`, globalMessages);
                    // Add your logic for sending to set
                  }}
                >
                  <BoxIcon className="w-4 h-4 text-violet-500" />
                </TooltipTrigger>
                <TooltipContent className="z-50">
                  <p>Send to set</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
      </div> */}
      <div
      //className="flex flex-col items-center w-5/6? p-0 text-sm justify-center border-b-[1px] border-slate-900"
      >
        <div className="flex flex-row items-center border-t border-indigo-900/50 pb-2 gap-1 justify-around bg-slate-900/80">
          {false && promptDirectives.length > 0 && isDirective && (
            <Select
              onValueChange={(v) => {
                console.log("onValueChange", v);
                const thisAgent = localStateObject.currentAgents.agents[
                  index
                ] as AgentComponentProps;
                thisAgent.promptDirectives![index] = v;
                const newAgents = localStateObject.currentAgents;
                newAgents.agents[index] = thisAgent;
                setLocalStateObject({
                  ...localStateObject,
                  currentAgents: newAgents,
                });
              }}
            >
              <SelectTrigger className="w-1/3 xl:w-full? bg-indigo-800 text-xs">
                <SelectValue placeholder="Prompt Directive" />
              </SelectTrigger>
              <SelectContent>
                {isDirective &&
                  promptDirectives.map((p, i) => {
                    return (
                      <SelectItem key={i} value={p.content}>
                        {p.meta1}
                      </SelectItem>
                    );
                  })}
              </SelectContent>
            </Select>
          )}
          {useAutoPrompt && (
            <div
            className="w-full p-2 flex items-center justify-end"
            >
              <Popover >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-violet-500/10 hover:bg-violet-500/20 border-violet-500/20 text-violet-200"
                  >
                    <span className="mr-2">✨</span> Auto Prompt
                  </Button>
                </PopoverTrigger>
                <PopoverContent>
                  <div className="flex flex-col items-center justify-center w-full gap-2">
                    <Input
                      placeholder="extra info here..."
                      defaultValue={
                        localStateObject.genericData.autoPromptExtraInfo
                      }
                      onBlur={(e) => {
                        const _newState = {
                          ...localStateObject,
                          genericData: {
                            ...localStateObject.genericData,
                            autoPromptExtraInfo: e.target.value,
                          },
                        };
                        setLocalStateObject(_newState);
                        setLocalAutoPromptExtraInfo(e.target.value);
                      }}
                    />
                    <div className="flex items-center justify-center gap-2">
                      Add{" "}
                      <input
                        className="bg-black w-12 h-6? p-1 text-white"
                        type="number"
                        value={addExamples}
                        title="addExamples"
                        onChange={(e) => setAddExamples(parseInt(e.target.value))}
                      />{" "}
                      Examples
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      console.log(
                        "LOCAL-AUTO-PROMPT-EXTRA-INFO",
                        localAutoPromptExtraInfo
                      );
                      if (!handleAutoPrompt) {
                        console.log("No handleAutoPrompt function provided");
                        return;
                      }
                      const isFirstTime =
                        localStateObject.currentAgents.agents[index]

                          .systemPrompt &&
                        localStateObject.currentAgents.agents[index].systemPrompt
                          .length > 25
                          ? false
                          : true;
                      //return;
                      const _data = {
                        isDirective: isDirective,
                        index: index,
                        role: localStateObject.currentAgents.agents[index]
                          .roleDescription,
                        title: localStateObject.currentAgents.agents[index].title,
                        name: localStateObject.currentAgents.agents[index].name,
                        extraInfo: localAutoPromptExtraInfo,
                        addExamples: addExamples,
                      } as AutoPromptData;
                      if (isFirstTime) {
                        console.log("HANDLE_AUTO_PROMPT: isFirstTime", isFirstTime);
                        console.log("HANDLE_AUTO_PROMPT: _data", _data);

                        //await new Promise(resolve => setTimeout(resolve, 3000));
                        handleAutoPrompt && await handleAutoPrompt(JSON.stringify(_data));
                      } else {
                        

                        const updatePromptInfo = window.prompt(
                          "What changes do you want to make to the prompt?",""
                        );
                        
                        if (true) {
                          console.log("HANDLE_AUTO_PROMPT: updatePromptInfo", updatePromptInfo);
                          _data.requestedChanges = updatePromptInfo || "";
                          _data.previousPrompts = [
                            localStateObject.currentAgents.agents[index]
                              .systemPrompt as string,
                          ];

                          handleAutoPrompt && await handleAutoPrompt(
                            JSON.stringify({
                              ..._data,
                              requestedChanges: updatePromptInfo,
                            })
                          );
                        }
                      }
                    }}
                    className="bg-violet-500/10 hover:bg-violet-500/20 border-violet-500/20 text-violet-200"
                  >
                    <span className="mr-2">✨</span> Auto Prompt
                  </Button>
                  {/* <Button
                    variant={"outline"}
                    className="w-full m-1 bg-indigo-600/50 text-lime-500"
                    onClick={async () => {
                      console.log(
                        "LOCAL-AUTO-PROMPT-EXTRA-INFO",
                        localAutoPromptExtraInfo
                      );
                      const isFirstTime =
                        localStateObject.currentAgents.agents[index]
                          .systemPrompt &&
                        localStateObject.currentAgents.agents[index].systemPrompt
                          .length > 25
                          ? false
                          : true;
                      //return;
                      const _data = {
                        isDirective: isDirective,
                        index: index,
                        role: localStateObject.currentAgents.agents[index]
                          .roleDescription,
                        title: localStateObject.currentAgents.agents[index].title,
                        name: localStateObject.currentAgents.agents[index].name,
                        extraInfo: localAutoPromptExtraInfo,
                        addExamples: addExamples,
                      } as AutoPromptData;
                      if (isFirstTime) {
                        //await new Promise(resolve => setTimeout(resolve, 3000));
                        handleAutoPrompt(JSON.stringify(_data));
                      } else {
                        const updatePromptInfo = window.prompt(
                          "What changes do you want to make to the prompt?"
                        );
                        if (updatePromptInfo) {
                          _data.requestedChanges = updatePromptInfo;
                          _data.previousPrompts = [
                            localStateObject.currentAgents.agents[index]
                              .systemPrompt as string,
                          ];
                          handleAutoPrompt(
                            JSON.stringify({
                              ..._data,
                              requestedChanges: updatePromptInfo,
                            })
                          );
                        }
                      }
                    }}
                  >
                    GENERATE
                  </Button> */}
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* {true && ( */}
          {false &&
            localStateObject.genericData.localSavedQuickAnalysisPrompts && (
              <Select
                onValueChange={(v) => {
                  handleInputChange({
                    target: {
                      value:
                        localStateObject.currentAgents.agents[index]
                          .systemPrompt + v,
                    },
                  } as React.ChangeEvent<HTMLInputElement>);
                }}
              >
                <SelectTrigger className="w-1/3 xl:w-full? bg-indigo-800 text-xs">
                  <SelectValue placeholder="Quick Prompt" />
                </SelectTrigger>
                <SelectContent>
                  {/* {localSavedQuickAnalysisPrompts.map((p, i) => { */}
                  {localStateObject.genericData
                    .localSavedQuickAnalysisPrompts &&
                    localStateObject.genericData.localSavedQuickAnalysisPrompts.map(
                      (p: any, i: any) => {
                        return (
                          <SelectItem key={i} value={p}>
                            {p}
                          </SelectItem>
                        );
                      }
                    )}
                </SelectContent>
              </Select>
            )}
        </div>
        {/* {localStateObject.currentAgents.agents[index].systemPrompt && (
          <Button
            onClick={() => {
              handleInputChange({
                target: { value: "" },
              } as React.ChangeEvent<HTMLInputElement>);
            }}
            className=" bg-violet-800 w-full"
          >
            <Delete className="w-4 h-4" />
          </Button>
        )} */}
      </div>
      <textarea
        ref={textFieldRef}
        placeholder={
          placeHolder
            ? placeHolder
            : "Explain key differences between Set 1 and Set 2"
        }
        title="prompt"
        defaultValue={
          input !== undefined
            ? input
            : (localStateObject.currentAgents.agents[index]
                .systemPrompt as string)
        }
        // value={localStateObject.currentAgents[index].promptDirectives}
        onBlur={(e) => {
          console.log("onChange", e.target.value);
          // console.log("handleInputChange", e);
          if (handleInputChange) handleInputChange(e);
        }}
        rows={numRows}
        className="w-full bg-indigo-900/70 text-violet-100? rounded-b-sm border-0 font-thin"
      />
      {/* <Button onClick={() => {
        console.log("localStateObject.genericData", localStateObject.genericData);
      }}>
        Log Generic Data
      </Button> */}
    </div>
  );
};

export default PromptWindowControl;
