import ModelSelectGroup, {
  ModelProviderSelect,
} from "@/components/global/model-provider-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  SelectGroup,
} from "@/components/ui/select";
import { useGlobalStore } from "@/src/lib/store/GloabalStoreState";
import {
  AgentComponentProps,
  AgentType,
  AgentTypeEnum,
  AgentVoice,
  AI_Agent_Tools,
  AI_Agent_ToolsDescription,
  AISessionState,
  ElevenLabsVoice,
  GlobalMessages,
  
  ModelArgs,
  ModelNames,
  ModelProviderEnum,
} from "@/src/lib/types";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import {
  cn,
  //UTILS_getAgentToolsByName,
  UTILS_getAgentToolsDescriptions,
  UTILS_getAgentToolsEmulatorsByName,
  UTILS_getRandomColor,
  UTILS_getRandomTailwindColor,
  UTILS_isToolAgent,
  UTILS_putGenericData,
  UTILS_updateModelNameAfterProviderChange,
} from "@/src/lib/utils";
import React, { useState, useEffect, useCallback } from "react";
import PromptWindowControl from "./promptwindocontrol";
import { Button } from "@/components/ui/button";
import {
  AxeIcon,
  DeleteIcon,
  Disc2Icon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { BoxIcon } from "@radix-ui/react-icons";

import { CoreTool, Message } from "ai";
import { z } from "zod";
import AgentTester from "./agent-tester";
import { GeneralPurpose } from "@prisma/client";
import { toast } from "@/components/ui/use-toast";
import AgentVoiceSelect from "./agent-voices/agent-voice-select";
import {
  SERVER_getAllSavedAgentStates,
  SERVER_saveCommonAgentState,
} from "@/src/lib/server";
import AgentStoredInfo from "./agent-stored-info";

import KB_LiveQueryComponent from "../src/lib/agent-kb/kb-livequery";
import KnowledgeBaseComponent from "../src/lib/agent-kb/kb-component";

const AgentComponentField = ({
  name,
  children,
}: {
  name: string;
  children: any;
}) => {
  return (
    <div className="grid grid-cols-8 items-center justify-center gap-2 w-full my-1 border-b border-white/20 pb-2">
      <Label className="col-span-2 border-r border-b border-white/20 p-2">
        {name}
      </Label>
      <div className="col-span-6 mx-4">{children}</div>
    </div>
  );
};
const AgentPromptsContainer = ({
  system,
  agent_index,
  localStateObject,
  setLocalStateObject,
  setAIMessages,
  handleChangeIndex,
  handleAutoPrompt,
  autoPromptModel,
  handleAutoPromptModelChange,
  autoPromptExtraInfo,
  setAutoPromptExtraInfo,
  handlePromptTextToSet,
}: {
  system: string;
  agent_index: number;
  localStateObject: AISessionState;
  setLocalStateObject: (localStateObject: AISessionState) => void;
  setAIMessages: (globalMessages: GlobalMessages) => void;
  handleChangeIndex: () => void;
  handleAutoPrompt: (e: any) => void;
  autoPromptModel: ModelArgs;
  handleAutoPromptModelChange: (e: string) => void;
  autoPromptExtraInfo: string;
  setAutoPromptExtraInfo: (e: string) => void;
  handlePromptTextToSet: (text: string) => void;
}) => {
  //const [directives, setDirectives] = useState<string[]>([]);

  //const [systemPrompt, setSystemPrompt] = useState<string>(system);
  const newDirective = () => {
    const newAgents = { ...localStateObject.currentAgents };
    const currentAgent = newAgents.agents[agent_index];

    if (
      !currentAgent.promptDirectives ||
      currentAgent.promptDirectives.length === 0
    ) {
      currentAgent.promptDirectives = [""];
    } else {
      currentAgent.promptDirectives.push("");
    }

    const updatedState = {
      ...localStateObject,
      currentAgents: newAgents,
    };

    setLocalStateObject(updatedState);
    setAIMessages({ history: [], currentState: updatedState });
  };

  return (
    <div className="flex flex-col text-indigo-200 border border-white/20 rounded-sm items-center justify-start gap-2 h-56? w-full">
      <h4 className="text-lg font-bold mt-4">System Prompt</h4>

      <PromptWindowControl
        input={localStateObject.currentAgents.agents[agent_index].systemPrompt}
        localStateObject={localStateObject}
        setLocalStateObject={setLocalStateObject}
        index={agent_index}
        promptTextToSet={(text: string) => {
          console.log("promptTextToSet", text);
          handlePromptTextToSet(text);
        }}
        handleInputChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
          console.log("handleInputChange", e.target.value);
          console.log(
            "SYS PROMPT AGENT --",
            localStateObject.currentAgents.agents
          );
          const value = e.target.value;
          console.log("value", value);
          const newAgents = localStateObject.currentAgents;
          newAgents.agents[agent_index].systemPrompt = value;
          //return
          setLocalStateObject({
            ...localStateObject,
            currentAgents: newAgents,
          });
          setAIMessages({
            history: [],
            currentState: {
              ...localStateObject,
              currentAgents: newAgents,
            },
          });
          handleChangeIndex();

          //setSystemPrompt(systemPrompt + text);
        }}
        numRows={10}
        handleAutoPrompt={handleAutoPrompt}
        useAutoPrompt={true}
        autoPromptModel={autoPromptModel}
        handleAutoPromptModelChange={handleAutoPromptModelChange}
        autoPromptExtraInfo={autoPromptExtraInfo}
        setAutoPromptExtraInfo={setAutoPromptExtraInfo}
      />

      {localStateObject &&
        localStateObject.currentAgents &&
        localStateObject.currentAgents.agents[agent_index] &&
        localStateObject.currentAgents.agents[agent_index].promptDirectives &&
        localStateObject.currentAgents.agents[agent_index].promptDirectives.map(
          (directive, directiveIndex) => (
            console.log("directive"),
            (
              <div
                className="flex flex-col items-center justify-start w-full"
                key={directiveIndex}
              >
                <div className="flex flex-row w-full p-1 bg-white/10 rounded-md items-center? justify-between gap-6">
                  <h4 className="text-sm font-bold p-1">
                    Directive {directiveIndex + 1}
                  </h4>
                  <div
                    className="cursor-pointer hover:text-red-500 flex items-center justify-between"
                    onClick={() => {
                      console.log("directiveIndex", directiveIndex);
                      if (
                        localStateObject.currentAgents &&
                        localStateObject.currentAgents.agents[agent_index] &&
                        localStateObject.currentAgents.agents[agent_index]
                          .promptDirectives
                      ) {
                        // Delete directive
                        const newAgents = localStateObject.currentAgents;
                        newAgents.agents[agent_index].promptDirectives?.splice(
                          directiveIndex,
                          1
                        );
                        setLocalStateObject({
                          ...localStateObject,
                          currentAgents: newAgents,
                        });
                        setAIMessages({
                          history: [],
                          currentState: {
                            ...localStateObject,
                            currentAgents: newAgents,
                          },
                        });
                      }
                    }}
                  >
                    <span className="text-red-500">X</span>
                  </div>
                </div>
                <PromptWindowControl
                  input={directive}
                  promptTextToSet={(text: string) => {
                    console.log("promptTextToSet", text);
                    handlePromptTextToSet(text);
                  }}
                  handleInputChange={(
                    e: React.ChangeEvent<HTMLTextAreaElement>
                  ) => {
                    const text = e.target.value;
                    //console.log("handleInputChange", text);
                    const newAgents = localStateObject.currentAgents;
                    console.log(
                      "newAgents",
                      newAgents,
                      "agent_index: ",
                      agent_index,
                      "directiveIndex: ",
                      directiveIndex
                    );
                    if (
                      newAgents &&
                      newAgents.agents[agent_index] &&
                      newAgents.agents[agent_index].promptDirectives
                      //newAgents[agent_index].promptDirectives[directiveIndex]
                    ) {
                      console.log(
                        "newAgents.agents[agent_index].promptDirectives[directiveIndex]",
                        newAgents.agents[agent_index].promptDirectives[
                          directiveIndex
                        ]
                      );
                      newAgents.agents[agent_index].promptDirectives[
                        directiveIndex
                      ] = text;
                      setLocalStateObject({
                        ...localStateObject,
                        currentAgents: newAgents,
                      });
                      setAIMessages({
                        history: [],
                        currentState: {
                          ...localStateObject,
                          currentAgents: newAgents,
                        },
                      });
                    }
                  }}
                  handleAutoPrompt={handleAutoPrompt}
                  autoPromptModel={autoPromptModel}
                  handleAutoPromptModelChange={handleAutoPromptModelChange}
                  numRows={3}
                  isDirective={true}
                  localStateObject={localStateObject}
                  setLocalStateObject={setLocalStateObject}
                  index={directiveIndex}
                  placeHolder="change from third person to first person perspective"
                  autoPromptExtraInfo={autoPromptExtraInfo}
                  setAutoPromptExtraInfo={setAutoPromptExtraInfo}
                />
              </div>
            )
          )
        )}
      <Button variant={"outline"} onClick={newDirective}>
        <PlusIcon className="w-4 h-4" /> Directive
      </Button>
    </div>
  );
};
export default function AgentComponent({
  agent_index,
  saveAgentState,
  inputChanged,
  localStateObject,
  setLocalStateObject,
  setAIMessages,
  storedAgentStates,
  manualLoadAgentState,
  handleAutoPrompt,
  autoPromptModel,
  handleAutoPromptModelChange,
  autoPromptExtraInfo,
  setAutoPromptExtraInfo,
  handlePromptTextToSet,
  elevenLabsVoices,
  voicesLoaded,
  handleChangeIndex,
  refreshAgentStates,
}: {
  agent_index: number;
  saveAgentState: () => void;
  localStateObject: AISessionState;
  setLocalStateObject: (localStateObject: AISessionState) => void;
  inputChanged: (input: string) => void;
  setAIMessages: (globalMessages: GlobalMessages) => void;
  storedAgentStates: {
    agents: {
      id: number;
      name: string;
      roleDescription: string;
      title: string;
    }[];
    teams: { id: number; name: string; objectives: string }[];
  };
  manualLoadAgentState: (id: number) => void;
  handleAutoPrompt: (e: any) => void;
  autoPromptModel: ModelArgs;
  handleAutoPromptModelChange: (e: string) => void;
  autoPromptExtraInfo: string;
  setAutoPromptExtraInfo: (e: string) => void;
  handlePromptTextToSet: (text: string) => void;
  elevenLabsVoices: ElevenLabsVoice[];
  voicesLoaded: boolean;
  handleChangeIndex: () => void;
  refreshAgentStates: () => void;
}) {
  const [agentTesterPopoverOpen, setAgentTesterPopoverOpen] = useState(false);
  const [colorOne, setColorOne] = useState<string>(
    UTILS_getRandomTailwindColor()
  );
  const [colorTwo, setColorTwo] = useState<string>(
    UTILS_getRandomTailwindColor()
  );
  const [roleDescription, setRoleDescription] = useState<string>("");

  // const { appState, setAppState, globalMessages, setLocalStateObject } =
  //   useGlobalStore();

  const [voiceOn, setVoiceOn] = useState<boolean>(false);

  const tailwindGradients = [
    "from-indigo-700 to-pink-700",
    "from-emerald-700 to-teal-700",
    "from-sky-700 to-cyan-700",
    "from-violet-700 to-purple-700",
    "from-fuchsia-700 to-pink-700",
    "from-rose-700 to-orange-700",
    "from-yellow-700 to-gray-700",
    "from-slate-700 to-zinc-700",
    "from-neutral-700 to-stone-700",
    "from-red-700 to-green-700",
    "from-blue-700 to-indigo-700",
  ];

  //const gradientIndex = Math.floor(Math.random() * tailwindGradients.length);
  const [twGrad, setTwGrad] = useState<string>(
    tailwindGradients[Math.floor(Math.random() * tailwindGradients.length)]
  );

  const [isKnowledgeBaseOpen, setIsKnowledgeBaseOpen] = useState(false);

  const handleStateUpdate = useCallback(
    (newState: AISessionState) => {
      setLocalStateObject(newState);
      if (setAIMessages) {
        setAIMessages({
          history: [],
          currentState: newState,
        });
      }
    },
    [setLocalStateObject, setAIMessages]
  );

  const setHasKnowledgBase = useCallback(
    (hasKnowledgeBase: boolean) => {
      const newState = {
        ...localStateObject,
        currentAgents: {
          ...localStateObject.currentAgents,
          agents: localStateObject.currentAgents.agents.map((agent, idx) =>
            idx === agent_index ? { ...agent, hasKnowledgeBase } : agent
          ),
        },
      };
      handleStateUpdate(newState);
    },
    [localStateObject, agent_index, handleStateUpdate]
  );

  const handleOnBlur = useCallback(
    (field: keyof AgentComponentProps, value: string) => {
      const newState = {
        ...localStateObject,
        currentAgents: {
          ...localStateObject.currentAgents,
          agents: localStateObject.currentAgents.agents.map((agent, idx) => {
            if (idx !== agent_index) return agent;

            if (field === "disabled") {
              return {
                ...agent,
                modelArgs: {
                  ...agent.modelArgs,
                  temperature: parseFloat(value),
                },
              };
            }

            return {
              ...agent,
              [field]: value,
            };
          }),
        },
      };

      handleStateUpdate(newState);

      if (field !== "disabled") {
        toast({
          title: "Agent updated",
          description: `${field} updated to ${value}`,
        });
      }
    },
    [localStateObject, agent_index, handleStateUpdate]
  );

  const deleteAgent = () => {
    if (window.confirm("Are you sure you want to delete this agent?")) {
      const newAgents = localStateObject.currentAgents;
      newAgents.agents.splice(agent_index, 1);
      setLocalStateObject({
        ...localStateObject,
        currentAgents: newAgents,
      });
      setAIMessages({
        history: [],
        currentState: {
          ...localStateObject,
          currentAgents: newAgents,
        },
      });
    }
  };

  const handleVoiceChange = (voice: AgentVoice) => {
    console.log("handleVoiceChange", voice);
    const newAgents = localStateObject.currentAgents;
    newAgents.agents[agent_index].voice = voice;
    setLocalStateObject({
      ...localStateObject,
      currentAgents: newAgents,
    });
  };

  const toolOptions = () => {
    let result: string[] = [];
    Object.values(AI_Agent_Tools)
      .filter(
        (tool) =>
          tool !== AI_Agent_Tools.AGENT_GLOBAL_STATE &&
          tool !== AI_Agent_Tools.AGENTIC_TOOLS
      )
      .forEach((tool) => {
        result.push(tool);
      });
    return result;
  };

  // useEffect(() => {
  //   setColorOne(UTILS_getRandomTailwindColor());
  //   setColorTwo(UTILS_getRandomTailwindColor());
  // }, []);

  // useEffect(() => {
  //   const _idx = Math.floor(Math.random() * tailwindGradients.length);
  //   setTwGrad(tailwindGradients[_idx]);
  //   UTILS_putGenericData(
  //     tailwindGradients[_idx],
  //     "Research-Analysis-AgentGradient-" +
  //       agent_index +
  //       appState.currentUser.id,
  //     globalMessages
  //   );
  // }, []);

  // useEffect(() => {

  //   console.log("AGENT COMPONENT-useEffect", localStateObject.currentAgents.agents[agent_index]);
  //   if(localStateObject.currentAgents.agents[agent_index].voice){
  //     handleVoiceChange(localStateObject.currentAgents.agents[agent_index].voice);
  //   }
  // }, [localStateObject.currentAgents.agents[agent_index]]);

  // console.log(
  //   "AGENT COMPONENT",
  //   agent_index,
  //   localStateObject.currentAgents.agents[agent_index],
  //   UTILS_getRandomColor(0.95),
  //   UTILS_getRandomColor(0.23)
  // );

  return (
    // <div>
    <div
      className={cn(
        //`bg-gradient-to-br from-${colorOne}-500? to-${colorTwo}-500? from-blue-700? to-pink-700? ${twGrad}?`,
        "flex flex-wrap w-full h-full overflow-y-auto bg-grid-slate-300/10? bg-black/20? border border-white? backdrop-blur-md rounded-sm p-2 font-thin",
        localStateObject.currentAgents.agents[agent_index] &&
          localStateObject.currentAgents.agents[agent_index].disabled
          ? "opacity-50 mix-blend-color-dodge"
          : "",
        //`bg-gradient-to-br from-[rgba(238, 255, 0, 0.685)] to-[rgba(238,9,20,0.67)]`
        !UTILS_isToolAgent(
          localStateObject.currentAgents.agents[agent_index]
            .type as AgentTypeEnum
        )
          ? "bg-gradient-to-br from-black/40 to-black/50"
          : "bg-gradient-to-br from-black/70 to-black/90",
        localStateObject.currentAgents.agents[agent_index] &&
          localStateObject.currentAgents.agents[agent_index].training
          ? "bg-gradient-to-br from-gray-700/50 to-gray-950/90 mix-blend-color-burn"
          : ""

        //`bg-gradient-to-br from-[${UTILS_getRandomColor(0.95)}] to-[${UTILS_getRandomColor(0.23)}]`
      )}
    >
      <div className="flex flex-col items-center justify-start gap-2 h-56? w-full">
        {/* Status */}
        <AgentComponentField name="Status">
          <div className="flex flex-row items-center justify-around gap-2">
            {UTILS_isToolAgent(
              localStateObject.currentAgents.agents[agent_index]
                .type as AgentTypeEnum
            ) ? (
              <div>TOOL AGENT</div>
            ) : (
              <div>TASK AGENT</div>
            )}
            <span
              className={cn(
                localStateObject.currentAgents.agents[agent_index] &&
                  localStateObject.currentAgents.agents[agent_index].disabled
                  ? "text-BLA shadow-red-500 shadow-2xl"
                  : localStateObject.currentAgents.agents[agent_index] &&
                    localStateObject.currentAgents.agents[agent_index].training
                  ? "text-yellow-500 shadow-yellow-500 shadow-2xl"
                  : "text-green-500 shadow-green-500 shadow-2xl",
                "text-pretty text-lg",
                "font-bold"
              )}
            >
              {localStateObject.currentAgents.agents[agent_index] &&
              localStateObject.currentAgents.agents[agent_index].disabled
                ? "Disabled"
                : localStateObject.currentAgents.agents[agent_index] &&
                  localStateObject.currentAgents.agents[agent_index].training
                ? "Training"
                : "Active"}
            </span>
            <div>
              {!localStateObject.currentAgents.agents[agent_index].training && (
                <div className="flex flex-row items-center justify-start gap-2">
                  <input
                    checked={
                      localStateObject.currentAgents.agents[agent_index] &&
                      localStateObject.currentAgents.agents[agent_index]
                        .disabled
                    }
                    className="w-4 h-4 bg-black"
                    type="checkbox"
                    id="status-checkbox"
                    onChange={(e) => {
                      const newAgents = localStateObject.currentAgents;
                      newAgents.agents[agent_index].disabled = e.target.checked;
                      setLocalStateObject({
                        ...localStateObject,
                        currentAgents: newAgents,
                      });
                      setAIMessages({
                        history: [],
                        currentState: {
                          ...localStateObject,
                          currentAgents: newAgents,
                        },
                      });
                    }}
                  />
                  <label
                    htmlFor="status-checkbox"
                    className="text-xs font-extralight"
                  >
                    {localStateObject.currentAgents.agents[agent_index] &&
                    localStateObject.currentAgents.agents[agent_index].disabled
                      ? ""
                      : "Disable"}
                  </label>
                </div>
              )}
              {!localStateObject.currentAgents.agents[agent_index].disabled && (
                <div className="flex flex-row items-center justify-start gap-2">
                  <input
                    title="Training"
                    checked={
                      localStateObject.currentAgents.agents[agent_index] &&
                      localStateObject.currentAgents.agents[agent_index]
                        .training
                    }
                    className="w-4 h-4 bg-black"
                    type="checkbox"
                    id="training-checkbox"
                    onChange={(e) => {
                      const newAgents = localStateObject.currentAgents;
                      newAgents.agents[agent_index].training = e.target.checked;
                      setLocalStateObject({
                        ...localStateObject,
                        currentAgents: newAgents,
                      });
                      setAIMessages({
                        history: [],
                        currentState: {
                          ...localStateObject,
                          currentAgents: newAgents,
                        },
                      });
                    }}
                  />
                  <label
                    htmlFor="training-checkbox"
                    className="text-xs font-extralight"
                  >
                    {localStateObject.currentAgents.agents[agent_index] &&
                    localStateObject.currentAgents.agents[agent_index].training
                      ? ""
                      : "Training"}
                  </label>
                </div>
              )}
            </div>
            {/* <label htmlFor="status-checkbox" className="">
                Status
              </label> */}
          </div>
        </AgentComponentField>
        {/* Type */}
        <AgentComponentField name="Type">
          {" "}
          <Select
            defaultValue={
              localStateObject.currentAgents.agents[agent_index] &&
              localStateObject.currentAgents.agents[agent_index].type
            }
            onValueChange={(e) => {
              handleOnBlur("type", e);
            }}
          >
            {" "}
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Agent Type" />
            </SelectTrigger>
            <SelectContent>
              {Object.values(AgentTypeEnum).map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </AgentComponentField>
        {/** Tool Selection */}
        {(localStateObject.currentAgents.agents[agent_index].type ===
          "tool-operator" ||
          localStateObject.currentAgents.agents[agent_index].type ===
            "dynamic-tool") && (
          <AgentComponentField name="Tools">
            {" "}
            <Collapsible>
              <CollapsibleTrigger>Tool Selection</CollapsibleTrigger>
              <CollapsibleContent className="flex flex-col items-center justify-center">
                {toolOptions().map((tool) => (
                  <div
                    onClick={() => {
                      const _newAgents = localStateObject.currentAgents;
                      if (!_newAgents.agents[agent_index]?.tools) {
                        _newAgents.agents[agent_index].tools = [];
                      }
                      if (
                        !_newAgents.agents[agent_index].tools.includes(
                          tool as AI_Agent_Tools
                        )
                      ) {
                        _newAgents.agents[agent_index].tools.push(
                          tool as AI_Agent_Tools
                        );
                      } else {
                        _newAgents.agents[agent_index].tools =
                          _newAgents.agents[agent_index].tools.filter(
                            (t) => t !== (tool as AI_Agent_Tools)
                          );
                      }
                      setLocalStateObject({
                        ...localStateObject,
                        currentAgents: _newAgents,
                      });
                    }}
                    className={cn(
                      localStateObject.currentAgents.agents[agent_index]
                        .tools &&
                        localStateObject.currentAgents.agents[
                          agent_index
                        ].tools.includes(tool as AI_Agent_Tools)
                        ? "bg-blue-500/70 text-blue-900"
                        : "opacity-20 mix-blend-screen hover:opacity-100",
                      "p-2 rounded-md border-b border-violet-700 shadow-sm text-center text-sm cursor-pointer hover:bg-pink-500/70 font-semibold w-full transition-all duration-300"
                    )}
                    key={tool}
                  >
                    {tool}
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
            <Collapsible>
              <CollapsibleTrigger>Tool Tester</CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-4">
                  {/* <h2 className="text-lg font-semibold">Tool Tester</h2> */}
                  <div className="space-y-2">
                    {/* {localStateObject.currentAgents.agents[agent_index]?.tools && localStateObject.currentAgents.agents[agent_index]?.tools.length > 0 && localStateObject.currentAgents.agents[agent_index]?.tools.map((tool) => {
                      console.log("Tool Tester", tool);
                      const emulators = UTILS_getAgentToolsEmulatorsByName(tool as AI_Agent_Tools);
                      if (emulators && 'tools' in emulators && emulators.tools.length > 0) {
                        return <ToolTester 
                          key={tool}
                          toolName={tool}
                          emulators={emulators.tools} 
                          output={(result: string | number | boolean) => {
                            console.log("ToolTester output", result);
                          }} 
                          sendTextToSet={(text: string) => {
                            console.log("ToolTester sendTextToSet", text);
                          handlePromptTextToSet(text)
                        }} />
                      }else{
                        // return <div key={tool}>No emulator found for {tool}</div>
                      }
                    })} */}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </AgentComponentField>
        )}
        {/* Name */}
        <AgentComponentField name="Name">
          {" "}
          <Input
            className="col-span-6 mx-4"
            defaultValue={
              localStateObject.currentAgents.agents[agent_index] &&
              localStateObject.currentAgents.agents[agent_index].name
            }
            onBlur={(e) => {
              handleOnBlur("name", e.target.value);
            }}
          />
        </AgentComponentField>
        {/* Title */}
        {localStateObject.currentAgents.agents[agent_index] && (
          <AgentComponentField name="Title">
            {" "}
            <Input
              placeholder="ex. Programmer"
              className="col-span-6 mx-4"
              defaultValue={
                localStateObject.currentAgents.agents[agent_index].title
              }
              onBlur={(e) => {
                handleOnBlur("title", e.target.value);
              }}
            />
          </AgentComponentField>
        )}
        {/* Role */}
        {localStateObject.currentAgents.agents[agent_index] && (
          <AgentComponentField name="Role">
            {" "}
            <textarea
              className="col-span-6 bg-black/0 rounded-sm p-2 mx-4 w-44 whitespace-pre-wrap break-words"
              placeholder="ex. Writes code, creates UI, etc."
              defaultValue={
                localStateObject.currentAgents.agents[agent_index]
                  .roleDescription
              }
              // value={
              //   //localStateObject.currentAgents[agent_index].roleDescription
              //   roleDescription
              // }
              rows={4}
              onBlur={(e) => {
                handleOnBlur("roleDescription", e.target.value);
              }}
            />
          </AgentComponentField>
        )}
        {/* Model */}
        {localStateObject.currentAgents.agents[agent_index] && (
          <AgentComponentField name="Model">
            <ModelProviderSelect
              localState={localStateObject}
              setLocalState={setLocalStateObject}
              model={
                localStateObject.currentAgents.agents[agent_index].modelArgs
              }
              index={agent_index}
              modelNameChanged={(e: string) => {
                let _args =
                  localStateObject.currentAgents.agents[agent_index].modelArgs;
                _args.modelName = e as ModelNames;
                const newAgents = localStateObject.currentAgents;
                newAgents.agents[agent_index].modelArgs = _args;
                setLocalStateObject({
                  ...localStateObject,
                  currentAgents: newAgents,
                });
              }}
              modelProviderChanged={(e: string) => {
                let _args =
                  localStateObject.currentAgents.agents[agent_index].modelArgs;
                _args.provider = e as ModelProviderEnum;
                _args.modelName = UTILS_updateModelNameAfterProviderChange(
                  e as ModelProviderEnum
                ) as ModelNames;
                const newAgents = localStateObject.currentAgents;
                newAgents.agents[agent_index].modelArgs = _args;
                setLocalStateObject({
                  ...localStateObject,
                  currentAgents: newAgents,
                });
                console.log("AGENT COMPONENT_modelProviderChanged", _args);
                // return;
              }}
              temperatureChanged={(e: number) => {
                handleOnBlur("disabled", e.toString());
                // return;
              }}

              // printModelList={(e: string) => {
              //   console.log("AGENT COMPONENT_printModelList", e);
              //   const _state = localStateObject;
              //   _state.contextSets.push({
              //     setName: "Models currently accessible",
              //     lines: [],
              //     text: e,
              //     isDisabled: true,
              //   });
              //   setLocalStateObject(_state);
              // }}
            />
          </AgentComponentField>
        )}
        {/* Voice */}
        {localStateObject.currentAgents.agents[agent_index] && (
          <AgentComponentField name="Voice">
            <AgentVoiceSelect
              onChange={handleVoiceChange}
              elevenLabsVoices={elevenLabsVoices}
              voicesLoaded={voicesLoaded}
              agentIndex={agent_index}
              localState={localStateObject}
            />
          </AgentComponentField>
        )}
        {localStateObject.currentAgents.agents[agent_index] && (
          <AgentPromptsContainer
            //system={agent.systemPrompt || "You are a helpful assistant."}
            system={
              localStateObject.currentAgents.agents[agent_index]
                .systemPrompt as string
            }
            agent_index={agent_index}
            localStateObject={localStateObject}
            setLocalStateObject={setLocalStateObject}
            setAIMessages={setAIMessages}
            handleAutoPrompt={handleAutoPrompt}
            autoPromptModel={autoPromptModel}
            handleAutoPromptModelChange={handleAutoPromptModelChange}
            autoPromptExtraInfo={autoPromptExtraInfo}
            setAutoPromptExtraInfo={setAutoPromptExtraInfo}
            handlePromptTextToSet={handlePromptTextToSet}
            handleChangeIndex={handleChangeIndex}
          />
        )}
        {localStateObject.currentAgents.agents[agent_index] && (
          <AgentComponentField name="Memory/Auto-Stored Info">
            <Popover>
              <PopoverTrigger>View Stored Info</PopoverTrigger>
              <PopoverContent>
                <AgentStoredInfo
                  agent={localStateObject.currentAgents.agents[agent_index]}
                  teamName={localStateObject.currentAgents.name}
                  userId={localStateObject.userId}
                />
              </PopoverContent>
            </Popover>
          </AgentComponentField>
        )}
        {/* Knowledge Base Section */}
        {localStateObject.currentAgents.agents[agent_index] && (
          <AgentComponentField name="Knowledge Base">
            <Collapsible
              open={isKnowledgeBaseOpen}
              onOpenChange={setIsKnowledgeBaseOpen}
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center gap-2 w-full justify-start"
                >
                  <BoxIcon className="w-4 h-4" />
                  Knowledge Base
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="p-2">
                kb
                <KnowledgeBaseComponent
                  localState={localStateObject}
                  toggleFullScreen={() => {}}
                  isEnabled={true}
                  namespace={`agent-kb-${localStateObject.userId}-${localStateObject.currentAgents.agents[agent_index].name}`}
                  agentName={
                    localStateObject.currentAgents.agents[agent_index].name
                  }
                  userId={localStateObject.userId}
                  onKnowledgeBaseUpdate={() => {
                    console.log("Knowledge Base Updated");
                  }}
                  setHasKnowledgeBase={(val: boolean) => {
                    console.log("Set Has Knowledge Base");
                    const newAgents = localStateObject.currentAgents;
                    newAgents.agents[agent_index].hasKnowledgeBase = val;
                    setLocalStateObject({
                      ...localStateObject,
                      currentAgents: newAgents,
                    });
                  }}
                  autoKBArgs={{
                    agentTitle:
                      localStateObject.currentAgents.agents[agent_index].title,
                    agentRole:
                      localStateObject.currentAgents.agents[agent_index]
                        .roleDescription,
                    teamObjectives: localStateObject.currentAgents.objectives,
                  }}
                />
                {localStateObject.currentAgents.agents[agent_index].hasKnowledgeBase && <KB_LiveQueryComponent
                  agentName={
                    localStateObject.currentAgents.agents[agent_index].name
                  }
                  userId={localStateObject.userId}
                />}
              </CollapsibleContent>
            </Collapsible>
          </AgentComponentField>
        )}
      </div>
      {localStateObject.currentAgents.agents[agent_index] && (
        <Popover
          onOpenChange={setAgentTesterPopoverOpen}
          open={agentTesterPopoverOpen}
        >
          <PopoverTrigger
            className={cn(
              "flex items-center justify-center w-full p-1 text-xs bg-slate-700/70 rounded-sm"
            )}
          >
            tester
          </PopoverTrigger>
          <PopoverContent
            align="start"
            side="top"
            draggable
            className="w-[700px] h-[600px] rounded-2xl border border-indigo-600/50 bg-black/40 backdrop-blur-md mx-auto"
          >
            <div className="flex justify-between w-full items-start">
              <div className={cn("text-xl font-bold mb-4 cursor-pointer")}>
                chat with{" "}
                {localStateObject.currentAgents.agents[agent_index].name}
              </div>
              <div
                onClick={() => setAgentTesterPopoverOpen(false)}
                className="font-extrabold text-pink-500 cursor-pointer"
              >
                X
              </div>
            </div>
            <div
              className={cn(
                "flex items-center justify-center w-full bg-blend-color-dodge"
              )}
            >
              {/* <AgentTester
                index={agent_index}
                currentState={localStateObject}
                setCurrentState={(state: AISessionState) => {
                  setLocalStateObject(state);
                  setAIMessages({
                    history: [],
                    currentState: state,
                  });
                }}
                agentName={
                  localStateObject.currentAgents.agents[agent_index].name || ""
                }
                saveAgentState={saveAgentState}
                globalMessages={{
                  history: [],
                  currentState: localStateObject,
                }}
                setGlobalMessages={({ history, currentState }) => {
                  setLocalStateObject(currentState);
                  setAIMessages({
                    history: [],
                    currentState: currentState,
                  });
                }}
                inputChanged={inputChanged}
              /> */}
            </div>
          </PopoverContent>
        </Popover>
      )}
      <div
        className={cn(
          "flex items-center justify-center gap-2 p-1 bg-black/20 backdrop-blur-md rounded-sm w-full"
        )}
      >
        <Button
          variant="outline"
          onClick={async () => {
            saveAgentState();
          }}
        >
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Disc2Icon className="w-4 h-4" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Save State</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </Button>
        <Select
          onValueChange={(e) => {
            manualLoadAgentState(parseInt(e));
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="agent states" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Agent States</SelectLabel>
              {storedAgentStates.agents.length > 0 &&
                storedAgentStates.agents.map((state) => (
                  <SelectItem key={state.id} value={state.id.toString()}>
                    {state.name}
                  </SelectItem>
                ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {/* <Select
          onValueChange={(e) => {
            manualLoadAgentState(parseInt(e), "one");
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="teams states" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Team States</SelectLabel>
              {storedAgentStates.teams.length > 0 &&
                storedAgentStates.teams.map((state) => (
                  <SelectItem key={state.id} value={state.id.toString()}>
                    {state.name}
                  </SelectItem>
                ))}
            </SelectGroup>
          </SelectContent>
        </Select> */}
        <Button
          variant={"outline"}
          onClick={() => {
            deleteAgent();
          }}
        >
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Trash2Icon className="w-4 h-4" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Delete Agent</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </Button>
      </div>
    </div>

    // </div>
  );
}
