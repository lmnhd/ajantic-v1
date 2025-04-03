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
import { useFullscreen } from "../src/lib/useFullscreen";
import OauthPanel from "./oauth-panel";
import AllowedContacts from './allowed-contacts';

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

const AgentPromptsContainer: React.FC<{
  system: string;
  agent_index: number;
  localStateObject: AISessionState;
  setLocalStateObject: (localStateObject: AISessionState) => void;
  setAIMessages: (globalMessages: GlobalMessages) => void;
  handleChangeIndex: () => void;
  handleAutoPrompt: (data: string) => Promise<void>;
  autoPromptModel: ModelArgs;
  handleAutoPromptModelChange: (e: string) => void;
  autoPromptExtraInfo: string;
  setAutoPromptExtraInfo: (e: string) => void;

  handlePromptTextToSet: (text: string) => void;
}> = ({
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
}) => {
  const [fullscreenRef, toggleFullscreen, isFullscreen] = useFullscreen();
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
    <div className="space-y-4">
      {/* System Prompt Section */}
      {/* <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-indigo-300">System Prompt</h4>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAutoPrompt}
            className="bg-violet-500/10 hover:bg-violet-500/20 border-violet-500/20 text-violet-200"
          >
            <span className="mr-2">✨</span> Auto Prompt
          </Button>
        </div>
        <div className="relative">
          <textarea
            value={
              localStateObject.currentAgents.agents[agent_index].systemPrompt
            }
            onChange={(e) => {
              const newAgents = localStateObject.currentAgents;
              newAgents.agents[agent_index].systemPrompt = e.target.value;
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
            }}
            className="w-full h-32 bg-indigo-900 border border-white/10 rounded-md p-3 text-sm text-indigo-200 resize-none focus:ring-1 focus:ring-violet-500/20 focus:border-violet-500/20"
            placeholder="Enter system prompt..."
          />
        </div>
      </div> */}
      <PromptWindowControl
        localStateObject={localStateObject}
        setLocalStateObject={setLocalStateObject}
        index={agent_index}
        promptTextToSet={handlePromptTextToSet}
        numRows={12}
        isDirective={false}
        autoPromptModel={autoPromptModel}
        handleAutoPromptModelChange={handleAutoPromptModelChange}
        autoPromptExtraInfo={autoPromptExtraInfo}
        setAutoPromptExtraInfo={setAutoPromptExtraInfo}
        handleAutoPrompt={handleAutoPrompt}
        useAutoPrompt={true}
      />

      {/* Directives Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-indigo-300">Directives</h4>
          <Button
            variant="outline"
            size="sm"
            onClick={newDirective}
            className="bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-500/20 text-indigo-200"
          >
            <PlusIcon className="w-4 h-4 mr-2" /> Add Directive
          </Button>
        </div>
        <div className="space-y-3">
          {localStateObject.currentAgents.agents[
            agent_index
          ].promptDirectives?.map((directive, directiveIndex) => (
            <div key={directiveIndex} className="relative group">
              <div className="absolute -left-10 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
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
                  }}
                  className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                >
                  <Trash2Icon className="w-4 h-4" />
                </Button>
              </div>
              <textarea
                defaultValue={directive}
                onBlur={(e) => {
                  const newAgents = localStateObject.currentAgents;
                  if (newAgents.agents[agent_index].promptDirectives) {
                    newAgents.agents[agent_index].promptDirectives[
                      directiveIndex
                    ] = e.target.value;
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
                className="w-full h-20 bg-indigo-900 border border-white/10 rounded-md p-3 text-sm text-indigo-200 resize-none focus:ring-1 focus:ring-indigo-500/20 focus:border-indigo-500/20"
                placeholder="Enter directive (e.g., change perspective, modify tone)..."
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default function AgentComponent2({
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
  handleAutoPrompt: (data: string) => Promise<void>;
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
  const [fullscreenRef, toggleFullscreen, isFullscreen] = useFullscreen();
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
    "from-indigo-700 to-zinc-700",
    "from-neutral-700 to-stone-700",
    "from-red-700 to-green-700",
    "from-blue-700 to-indigo-700",
  ];

  //const gradientIndex = Math.floor(Math.random() * tailwindGradients.length);
  const [twGrad, setTwGrad] = useState<string>(
    tailwindGradients[Math.floor(Math.random() * tailwindGradients.length)]
  );

  const [isKnowledgeBaseOpen, setIsKnowledgeBaseOpen] = useState(false);

  useEffect(() => {
    console.log("AgentIndex Changed...", agent_index);
  }, [agent_index]);

  useEffect(() => {
    const currentAgent = localStateObject.currentAgents.agents[agent_index];
    setRoleDescription(currentAgent.roleDescription || "");
  }, [agent_index, localStateObject]);

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
    <div
      className={cn(
        "flex flex-col w-full h-full overflow-y-auto rounded-lg border border-white/10",
        "bg-gradient-to-br from-indigo-950/40 to-violet-900/40 backdrop-blur-md",
        "shadow-lg shadow-black/20",
        localStateObject.currentAgents.agents[agent_index]?.disabled
          ? "opacity-50"
          : "",
        !UTILS_isToolAgent(
          localStateObject.currentAgents.agents[agent_index]
            .type as AgentTypeEnum
        )
          ? "hover:shadow-indigo-900/20"
          : "hover:shadow-violet-900/20",
        localStateObject.currentAgents.agents[agent_index]?.training
          ? "bg-gradient-to-br from-indigo-900/90 to-indigo-950/90"
          : ""
      )}
    >
      <div className="flex flex-col w-full p-4 space-y-4">
        {/* Status Bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-black/20 rounded-md border border-white/5">
          <div className="flex items-center space-x-3">
            <div
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium",
                UTILS_isToolAgent(
                  localStateObject.currentAgents.agents[agent_index]
                    .type as AgentTypeEnum
                )
                  ? "bg-violet-500/10 text-violet-200 border border-violet-500/20"
                  : "bg-indigo-500/10 text-indigo-200 border border-indigo-500/20"
              )}
            >
              {UTILS_isToolAgent(
                localStateObject.currentAgents.agents[agent_index]
                  .type as AgentTypeEnum
              )
                ? "TOOL AGENT"
                : "TASK AGENT"}
            </div>
            <span
              className={cn(
                "px-2 py-1 rounded-md text-xs font-medium",
                localStateObject.currentAgents.agents[agent_index]?.disabled
                  ? "bg-red-500/10 text-red-200 border border-red-500/20"
                  : localStateObject.currentAgents.agents[agent_index]?.training
                  ? "bg-yellow-500/10 text-yellow-200 border border-yellow-500/20"
                  : "bg-emerald-500/10 text-emerald-200 border border-emerald-500/20"
              )}
            >
              {localStateObject.currentAgents.agents[agent_index]?.disabled
                ? "Disabled"
                : localStateObject.currentAgents.agents[agent_index]?.training
                ? "Training"
                : "Active"}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            {!localStateObject.currentAgents.agents[agent_index].training && (
              <div className="flex items-center space-x-2">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    title="Toggle agent disabled state"
                    aria-label="Toggle agent disabled state"
                    checked={
                      localStateObject.currentAgents.agents[agent_index]
                        ?.disabled
                    }
                    className="sr-only peer"
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
                  <div
                    className={cn(
                      "w-9 h-5 rounded-full peer",
                      "bg-indigo-700 peer-checked:bg-pink-600/20",
                      "after:content-[''] after:absolute after:top-[2px] after:left-[2px]",
                      "after:bg-white after:rounded-full after:h-4 after:w-4",
                      "after:transition-all peer-checked:after:tranindigo-x-full"
                    )}
                  ></div>
                </label>
                <span className="text-xs text-indigo-400">
                  {localStateObject.currentAgents.agents[agent_index]?.disabled
                    ? "Enable"
                    : "Disable"}
                </span>
              </div>
            )}
            {!localStateObject.currentAgents.agents[agent_index].disabled && (
              <div className="flex items-center space-x-2">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    title="Toggle agent training state"
                    aria-label="Toggle agent training state"
                    checked={
                      localStateObject.currentAgents.agents[agent_index]
                        ?.training
                    }
                    className="sr-only peer"
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
                  <div
                    className={cn(
                      "w-9 h-5 rounded-full peer",
                      "bg-indigo-700 peer-checked:bg-yellow-600/20",
                      "after:content-[''] after:absolute after:top-[2px] after:left-[2px]",
                      "after:bg-white after:rounded-full after:h-4 after:w-4",
                      "after:transition-all peer-checked:after:tranindigo-x-full"
                    )}
                  ></div>
                </label>
                <span className="text-xs text-indigo-400">Training</span>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 gap-4">
          {/* Type Selection */}
          <div className="p-4 bg-black/20 rounded-md border border-white/5">
            <label className="block text-sm font-medium text-indigo-300 mb-2">
              Agent Type
            </label>
            <Select
              defaultValue={
                localStateObject.currentAgents.agents[agent_index]?.type
              }
              onValueChange={(e) => handleOnBlur("type", e)}
            >
              <SelectTrigger className="w-full bg-indigo-900 border-white/10">
                <SelectValue placeholder="Select Agent Type" />
              </SelectTrigger>
              <SelectContent>
                {Object.values(AgentTypeEnum).map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tool Selection */}
          {(localStateObject.currentAgents.agents[agent_index].type ===
            "tool-operator" ||
            localStateObject.currentAgents.agents[agent_index].type ===
              "dynamic-tool") && (
            <div className="p-4 bg-black/20 rounded-md border border-white/5">
              <Collapsible>
                <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium text-indigo-300">
                  <span>Tool Selection</span>
                  <span className="text-indigo-500">↓</span>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-1">
                  {toolOptions().map((tool) => (
                    <div
                      key={tool}
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
                        "px-3 py-2 rounded-md text-sm cursor-pointer transition-all duration-200",
                        "hover:bg-violet-500/10",
                        localStateObject.currentAgents.agents[
                          agent_index
                        ].tools?.includes(tool as AI_Agent_Tools)
                          ? "bg-violet-500/20 text-violet-200"
                          : "text-indigo-400 hover:text-violet-200"
                      )}
                    >
                      {tool}
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}
          {/* Allowed Contacts */}
          {localStateObject.currentAgents.agents[agent_index].type !== AgentTypeEnum.MANAGER && (
            <AllowedContacts
              allowedContacts={localStateObject.currentAgents.agents[agent_index].allowedContacts || []}
              onUpdate={(updatedContacts) => {
                const newAgents = localStateObject.currentAgents;
                newAgents.agents[agent_index].allowedContacts = updatedContacts;
                setLocalStateObject({
                  ...localStateObject,
                  currentAgents: newAgents,
                });
              }}
              availableAgents={localStateObject.currentAgents.agents.filter(a => a.name !== localStateObject.currentAgents.agents[agent_index].name).map(a => ({ id: a.name, name: a.name }))}
            />
          )}
          {localStateObject.currentAgents.agents[agent_index].tools?.includes(
            AI_Agent_Tools.OAUTH_PROVIDER
          ) && (
            <AgentComponentField name="OAuth Provider Select">
              <OauthPanel userId={localStateObject.userId} />
            </AgentComponentField>
          )}

          {/* Basic Info */}
          <div className="p-4 bg-black/20 rounded-md border border-white/5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-indigo-300 mb-2">
                Name
              </label>
              <Input
                className="w-full bg-indigo-900 border-white/10"
                defaultValue={
                  localStateObject.currentAgents.agents[agent_index]?.name
                }
                onBlur={(e) => handleOnBlur("name", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-indigo-300 mb-2">
                Title
              </label>
              <Input
                className="w-full bg-indigo-900 border-white/10"
                placeholder="ex. Programmer"
                defaultValue={
                  localStateObject.currentAgents.agents[agent_index]?.title
                }
                onBlur={(e) => handleOnBlur("title", e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-indigo-300 mb-2">
                Role Description
              </label>
              <textarea
                className="w-full bg-indigo-900 border border-white/10 rounded-md p-2 text-sm"
                placeholder="ex. Writes code, creates UI, etc."
                defaultValue={
                  localStateObject.currentAgents.agents[agent_index]
                    ?.roleDescription
                }
                rows={4}
                onBlur={(e) => handleOnBlur("roleDescription", e.target.value)}
              />
            </div>
          </div>

          {/* Model Selection */}
          <div className="p-4 bg-black/20 rounded-md border border-white/5">
            <label className="block text-sm font-medium text-indigo-300 mb-2">
              Model Configuration
            </label>
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
              }}
              temperatureChanged={(e: number) => {
                handleOnBlur("disabled", e.toString());
              }}
            />
          </div>

          {/* Voice Selection */}
          <div className="p-4 bg-black/20 rounded-md border border-white/5">
            <label className="block text-sm font-medium text-indigo-300 mb-2">
              Voice Configuration
            </label>
            <AgentVoiceSelect
              onChange={handleVoiceChange}
              elevenLabsVoices={elevenLabsVoices}
              voicesLoaded={voicesLoaded}
              agentIndex={agent_index}
              localState={localStateObject}
            />
          </div>

          {/* System Prompt */}
          <div className="p-4 bg-black/20 rounded-md border border-white/5">
            <AgentPromptsContainer
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
          </div>

          {/* Memory Section */}
          <div className="p-4 bg-black/20 rounded-md border border-white/5">
            <label className="block text-sm font-medium text-indigo-300 mb-2">
              Memory & Stored Information
            </label>
            <Popover>
              <PopoverTrigger className="w-full px-4 py-2 text-sm bg-indigo-900 rounded-md border border-white/10 hover:bg-indigo-800 transition-colors">
                View Stored Info
              </PopoverTrigger>
              <PopoverContent>
                <AgentStoredInfo
                  agent={localStateObject.currentAgents.agents[agent_index]}
                  teamName={localStateObject.currentAgents.name}
                  userId={localStateObject.userId}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Knowledge Base */}
          <div className="p-4 bg-black/20 rounded-md border border-white/5">
            <Collapsible
              open={isKnowledgeBaseOpen}
              onOpenChange={setIsKnowledgeBaseOpen}
            >
              <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-medium text-indigo-300">
                <span>Knowledge Base</span>
                <span className="text-indigo-500">↓</span>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4">
                <div ref={fullscreenRef}>
                  <KnowledgeBaseComponent
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
                      const newAgents = localStateObject.currentAgents;
                      newAgents.agents[agent_index].hasKnowledgeBase = val;
                      setLocalStateObject({
                        ...localStateObject,
                        currentAgents: newAgents,
                      });
                    }}
                    autoKBArgs={{
                      agentTitle:
                        localStateObject.currentAgents.agents[agent_index]
                          .title,
                      agentRole:
                        localStateObject.currentAgents.agents[agent_index]
                          .roleDescription,
                      teamObjectives: localStateObject.currentAgents.objectives,
                    }}
                    localState={localStateObject}
                    toggleFullScreen={toggleFullscreen}
                  />
                  {localStateObject.currentAgents.agents[agent_index]
                    .hasKnowledgeBase && (
                    <div className="mt-4">
                      <KB_LiveQueryComponent
                        agentName={
                          localStateObject.currentAgents.agents[agent_index]
                            .name
                        }
                        userId={localStateObject.userId}
                      />
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="mt-auto p-4 bg-black/30 border-t border-white/5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={saveAgentState}
              className="bg-indigo-900 hover:bg-indigo-800"
            >
              <Disc2Icon className="w-4 h-4 mr-2" />
              Save State
            </Button>
            <Select
              onValueChange={(e) => {
                manualLoadAgentState(parseInt(e));
              }}
            >
              <SelectTrigger className="w-[180px] bg-indigo-900 border-white/10">
                <SelectValue placeholder="Load Agent State" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Agent States</SelectLabel>
                  {storedAgentStates.agents.map((state) => (
                    <SelectItem key={state.id} value={state.id.toString()}>
                      {state.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            onClick={deleteAgent}
            className="bg-red-900/20 hover:bg-red-900/30 border-red-500/20 text-red-200"
          >
            <Trash2Icon className="w-4 h-4 mr-2" />
            Delete Agent
          </Button>
        </div>
      </div>

      {/* Tester Popover */}
      {false && (
        <Popover
          open={agentTesterPopoverOpen}
          onOpenChange={setAgentTesterPopoverOpen}
        >
          <PopoverTrigger className="absolute bottom-4 right-4">
            <Button
              variant="outline"
              className="bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-500/20"
            >
              Open Tester
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            side="top"
            className="w-[700px] h-[600px] rounded-lg border border-indigo-600/20 bg-indigo-950/90 backdrop-blur-md"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-indigo-200">
                Chat with{" "}
                {localStateObject.currentAgents.agents[agent_index].name}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAgentTesterPopoverOpen(false)}
                className="text-indigo-400 hover:text-indigo-300"
              >
                Close
              </Button>
            </div>
            <div className="h-[calc(100%-3rem)] bg-black/20 rounded-md border border-white/5">
              {/* Tester content here */}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
