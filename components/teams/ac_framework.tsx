import { useState, useEffect, useRef, useCallback } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  AgentComponentProps,
  AgentTypeEnum,
  AgentVoiceProviderEnum,
  AISessionState,
  ElevenLabsVoice,
  ModelArgs,
  ModelNames,
  ModelProviderEnum,
  ServerMessage,
  GlobalMessages,
  Team,
  ContextContainerProps,
  ContextSet,
} from "@/src/lib/types";
import { Message } from "ai";

import { AnthropicModelNames } from "@/src/app/api/model/anthropic";
import { GoogleGenerativeAIModelNames } from "@/src/app/api/model/google";
import { MistralModelNames } from "@/src/app/api/model/mistral";
import { CohereModelNames } from "@/src/app/api/model/cohere";

import {
  cn,
  UTILS_getGenericData,
  UTILS_isToolAgent,
  UTILS_putGenericData,
  UTILS_updateModelNameAfterProviderChange,
} from "@/src/lib/utils";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { boolean, z } from "zod";
import { ClientMessage } from "@/src/lib/aicontext";

import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { toast } from "@/components/ui/use-toast";
import {
  ArrowDownNarrowWideIcon,
  ArrowUpNarrowWideIcon,
  AxeIcon,
  BotIcon,
  ExpandIcon,
  Maximize2Icon,
  Minimize2,
  XIcon,
} from "lucide-react";
//import { Tabs } from "./agent-3d-tabs";
import { AGENT_AUTO_PROMPT } from "@/src/lib/prompts/auto-prompt";
import { ANALYSIS_TOOLS_autoPrompt } from "@/src/lib/analysis_server";

import { AGENT_AUTO_SPAWN } from "@/src/lib/agent-auto-spawn";

import { SERVER_ACTION_AGENT_AUTO_SPAWN } from "@/src/lib/server-actions";
import { SERVER_getAgent, SERVER_getTeam } from "@/src/lib/server2";
import { logger } from "@/src/lib/logger";
import { fetchKnowledgeBaseEntries } from "@/src/app/api/kb-entries/[id]";
import { useFullscreen } from "@/src/lib/useFullscreen";
import Agent_comp from "./agent_comp";
import { listElevenLabsVoices } from "@/src/lib/voices/voices-db";

export interface AutoPromptData {
  isDirective: boolean;
  index: number;
  role: string;
  title: string;
  name: string;
  promptSuggestions: string;
  extraInfo?: string;
  addExamples?: number;
  lastPrompt?: string;
  requestedChanges?: string;
  teamObjective?: string;
  peerAgents?: AgentComponentProps[];
  previousPrompts?: string[];
  characterName?: string;
  characterRole?: string;
  characterTitle?: string;
}

// TODO: Update pre agent chat to consider entire message history and context when rewriting message
function ACFramework({
  messages,
  setMessages,
  localStateObject,
  setlocalStateObject,
  contextSet,
  inputChanged,
  currentAgentIndex,
  setCurrentAgentIndex,
  handlePromptTextToSet,
  handleDeleteTextFromSet,
  saveAgentState,
  stateLoaded,
  savedAgentStates,
  handleChangeIndex,
  refreshAgentStates,
  loadAgent,
  setAgentActive,
}: {
  messages:
    | Message[]
    | ServerMessage[]
    | ClientMessage[]
    | HumanMessage[]
    | AIMessage[];
  setMessages: (
    messages:
      | Message[]
      | ServerMessage[]
      | ClientMessage[]
      | HumanMessage[]
      | AIMessage[]
  ) => void;
  localStateObject: AISessionState;
  setlocalStateObject: (state: AISessionState) => void;
  contextSet: ContextSet;
  inputChanged: (text: string) => void;
  currentAgentIndex: number;
  setCurrentAgentIndex: (idx: number) => void;
  handlePromptTextToSet: (text: string) => void;
  handleDeleteTextFromSet?: (args: string) => void;
  saveAgentState: () => // _agent: string,
  // _lineSets: string,
  // _index: number,
  // saveOneOrAll: "one" | "all",
  // _name?: string
  void;
  stateLoaded: boolean;
  savedAgentStates: {
    agents: {
      id: number;
      name: string;
      roleDescription: string;
      title: string;
    }[];
    teams: { id: number; name: string; objectives: string }[];
  };
  handleChangeIndex: () => void;
  refreshAgentStates: () => void;
  loadAgent: (agentId: number) => void;
  setAgentActive: (active: boolean) => void;
}) {
  // const { appState, setAppState, localStateObject, setlocalStateObject } =
  //   useGlobalStore();
  // const [messages, setMessages] = useState<
  //   Message[] | ServerMessage[] | ClientMessage[] | HumanMessage[] | AIMessage[]
  // >([]);
  //const { localStateObject, setlocalStateObject } = useGlobalStore();
  // console.log("AGENT-COMPONENT-FRAMEWORK-localStateObject", localStateObject);
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const [fullLength, setFullLength] = useState(false);
  const [autoPromptMessages, setAutoPromptMessages] = useState<Message[]>([]);
  const [kbInitialized, setKbInitialized] = useState(false);
  const [autoPromptModel, setAutoPromptModel] = useState<ModelArgs>({
    modelName: "gpt-4-turbo",
    provider: ModelProviderEnum.OPENAI,
    temperature: 0.5,
  });

  const [autoPromptExtraInfo, setAutoPromptExtraInfo] = useState<string>("");

  const [elevenLabsVoices, setElevenLabsVoices] = useState<ElevenLabsVoice[]>(
    []
  );
  const initialized = useRef(false); // Add this ref
  const [fullscreenRef, toggleFullscreen, isFullscreen] = useFullscreen();
  // const [tabDefaultValue, setTabDefaultValue] = useState<string>(
  //   localStateObject.currentAgents.agents[0].name ||
  //     `Agent ${currentAgentIndex + 1}`
  // );

  const tabsRef = useRef<HTMLDivElement>(null);

  const setAIMessages = useCallback(
    (state: AISessionState) => {
      setlocalStateObject(state);
    },
    [setlocalStateObject]
  );

  const handleAIMessages = useCallback(
    (globalMessages: GlobalMessages) => {
      if (globalMessages.currentState) {
        setAIMessages(globalMessages.currentState);
      }
    },
    [setAIMessages]
  );

  const prevAgents = useRef(localStateObject.currentAgents);

  const manualLoadAgentState = useCallback(
    async (id: number) => {
      loadAgent(id);
      setCurrentAgentIndex(0);
    },
    [loadAgent, setCurrentAgentIndex]
  );

  const deleteAgent = (index: number) => {
    if (localStateObject.currentAgents.agents.length > 1) {
      console.log(
        "Deleting Agent",
        localStateObject.currentAgents.agents[index]
      );

      if (window.confirm("Are you sure you want to delete this agents?")) {
        setCurrentAgentIndex(0);

        const _newState = {
          ...localStateObject,
          currentAgents: {
            ...localStateObject.currentAgents,
            agents: localStateObject.currentAgents.agents.filter(
              (_, i) => i !== index
            ),
          },
        } as AISessionState;
        console.log("_newState", _newState);

        setlocalStateObject(_newState);
        //   // UTILS_setServerMessagesCurrentState(
        //   //   messages as ServerMessage[],
        //   //   _newState as AISessionState
        //   // );
        // }
      }
    }
  };

  const modelNameChanged = (modelName: any) => {
    console.log("modelname changed", modelName);
    const _newAgentArray = localStateObject.currentAgents.agents.map(
      (a, index) => {
        if (a.index === index) {
          return {
            ...a,
            modelArgs: {
              ...a.modelArgs,
              modelName: modelName,
            },
          } as AgentComponentProps;
        }
        return a;
      }
    );
    console.log("_newAgentArray", _newAgentArray);
    modelNameChanged(_newAgentArray);
  };

  const modelProviderChanged = (modelProvider: ModelProviderEnum) => {
    console.log(
      "modelprovider changed",
      modelProvider,
      "agents",
      localStateObject.currentAgents
    );
    const _newAgentArray = localStateObject.currentAgents.agents.map(
      (a, index) => {
        //console.log("a.index", a.index);
        console.log("this-index", index);
        console.log("that-index", a.index);
        console.log("this-modelProvider", modelProvider);
        if (a.index === index) {
          return {
            ...a,
            modelArgs: {
              ...a.modelArgs,
              modelName: UTILS_updateModelNameAfterProviderChange(
                modelProvider
              ) as ModelNames,
              provider: modelProvider,
            },
          } as AgentComponentProps;
        }
        return a;
      }
    );
    console.log("_newAgentArray", _newAgentArray);
    // providerChanged(_newAgentArray);
    //setAgents((prev) => [...prev, ..._newAgentArray]);
    // setAgents(_newAgentArray ? _newAgentArray : []);
  };

  const agentAutoSpawn = async () => {
    if (window.confirm("Customize with description?")) {
      // set agentActive true
      setAgentActive(true);
      logger.log("Agent Auto Spawn Started");
      const _shortDescription = window.prompt(
        "Short description of what this agent will do",
        "This agent will access and manipulate the users PC file system"
      ) as string;
      const _props = (await SERVER_ACTION_AGENT_AUTO_SPAWN(
        {
          teamObjective: _shortDescription,
          existingAgents: localStateObject.currentAgents.agents,
        }
      )) as { agent: AgentComponentProps | null; message: string; success: boolean };
      console.log("_props", _props);
      logger.log("Agent Auto Spawn Finished");
      if (_props && _props.success) {
        addAgent(_props.agent || undefined);
        handleChangeIndex();
      } else {
        toast({
          title: "Agent Auto Spawn Failed",
          description: _props.message,
        });
      }
      setAgentActive(false);
    } else {
      addAgent();
    }
  };

  const addAgent = (agent?: AgentComponentProps) => {
    const _newState = {
      ...localStateObject,
      currentAgents: {
        ...localStateObject.currentAgents,
        agents: [
          ...localStateObject.currentAgents.agents,
          agent
            ? agent
            : {
                type: "agent",
                name: `Agent ${
                  localStateObject.currentAgents.agents.length + 1
                }`,
                roleDescription: "New Hire",
                modelArgs: {
                  modelName: "gpt-4o-mini",
                  provider: ModelProviderEnum.OPENAI,
                },
                systemPrompt:
                  "You are a helpful agent with no assigned tasks yet",
                voice: {
                  provider: AgentVoiceProviderEnum.ELEVEN_LABS,
                  nameOrVoiceID: "21m00Tcm4TlvDq8ikWAM",
                },
                tools: [],
                title: "Generic Agent",
              },
        ],
      },
    } as AISessionState;
    setlocalStateObject(_newState);
  };

  const handleAutoPrompt = async (data: string) => {
    console.log("AUTO-PROMPT-DATA", data);
    console.log(
      "localStateObject.genericData.autoPromptModel",
      localStateObject.genericData.autoPromptModel
    );
    let model: ModelArgs = localStateObject.genericData.autoPromptModel;
    if (!model) {
      model = {
        modelName: "gpt-4o-mini",
        temperature: 0.5,
        provider: ModelProviderEnum.OPENAI,
      };
    }

    const {
      isDirective,
      index,
      role,
      title,
      name,
      promptSuggestions,
      extraInfo,
      addExamples,
      lastPrompt,
      requestedChanges,
    }: AutoPromptData = JSON.parse(data);

    const teamObjective = localStateObject.currentAgents.objectives;

    console.log("name", name);

    const prompt = AGENT_AUTO_PROMPT({
      isDirective,
      index,
      role,
      title,
      name,
      promptSuggestions,
      extraInfo,
      addExamples: addExamples ? addExamples : 0,
      lastPrompt,
      requestedChanges: requestedChanges || "",
      teamObjective,
      peerAgents: localStateObject.currentAgents.agents,
      characterName: name,
      characterRole: role,
      characterTitle: title,
    });
    console.log("prompt", prompt);
    //return;

    const response = await ANALYSIS_TOOLS_autoPrompt({
      userId: localStateObject.userId,
      autoPromptMessages: autoPromptMessages,
      systemPrompt: prompt,
      characterRole: role,
      characterTitle: title,
      characterName: name,
      previousPrompts: lastPrompt ? [lastPrompt] : [],
      extraInfo: extraInfo || undefined,
      modelArgs: model,
      addExamples: addExamples || 0,
    });
    console.log("response", response);

    if (response) {
      setAutoPromptMessages([
        ...autoPromptMessages,
        { role: "assistant", content: response, id: Date.now().toString() },
      ]);

      const _newAgent = localStateObject.currentAgents.agents[index];
      _newAgent.systemPrompt = response;
      const _newState = {
        ...localStateObject,
        currentAgents: {
          ...localStateObject.currentAgents,
          agents: localStateObject.currentAgents.agents.map((a, i) => {
            if (i === index) {
              return _newAgent;
            }
            return a;
          }),
        },
      } as AISessionState;

      // UTILS_setServerMessagesCurrentState(
      //   messages as ServerMessage[],
      //   _newState as AISessionState
      // );
    }
  };

  const handleAutoPromptModelChange = (
    model: ModelArgs,
    property: keyof ModelArgs
  ) => {
    console.log("handleAutoPromptModelChange", autoPromptModel);
    //setAutoPromptModel((prev) => ({ ...prev, [property]: model[property] }));
  };
  const handleAutoPromptModelChange2 = (args: string) => {
    // console.log("handleAutoPromptModelChange2 called", args);
    // const _data = JSON.parse(args);
    // console.log("_data", _data);
    // switch (_data.variable) {
    //   case "modelName":
    //     setAutoPromptModel((prev) => {
    //       console.log("Updating modelName", _data.modelName);
    //       return { ...prev, modelName: _data.modelName };
    //     });
    //     break;
    //   case "provider":
    //     setAutoPromptModel((prev) => {
    //       console.log("Updating provider", _data.provider);
    //       return { ...prev, provider: _data.provider };
    //     });
    //     break;
    //   case "temperature":
    //     setAutoPromptModel((prev) => {
    //       console.log("Updating temperature", _data.temperature);
    //       return { ...prev, temperature: _data.temperature };
    //     });
    //     break;
    // }
    // // setCurrentAgentIndex(currentAgentIndex);
    // console.log("autoPromptModel", autoPromptModel, currentAgentIndex);
  };
  const getFirstModelName = (modelProvider: ModelProviderEnum) => {
    switch (modelProvider) {
      case ModelProviderEnum.ANTHROPIC:
        return AnthropicModelNames["claude-3-5-sonnet-20240620"];
      case ModelProviderEnum.OPENAI:
        return "gpt-4o";
      case ModelProviderEnum.MISTRAL:
        return MistralModelNames["mistral-large-latest"];
      case ModelProviderEnum.COHERE:
        return CohereModelNames["command-r-plus"];
      case ModelProviderEnum.GOOGLE_G:
        return GoogleGenerativeAIModelNames["models/gemini-1.5-flash-latest"];
    }
  };

  const mapAgentsToTabs = useCallback(() => {
    if (!localStateObject.currentAgents) {
      return [];
    }
    return localStateObject.currentAgents.agents.map((a, i) => (
      <TabsContent
        key={i}
        value={a.name || `Agent ${i + 1}`}
        className="h-[100%]? overflow-y-auto"
      >
        <div
          className={cn(
            "pb-[500px]? overflow-y-auto",
            !fullLength ? "h-[66em]? h-screen?" : "h-fit"
          )}
        >
          {a.type && (
            <div>
              <div className="flex items-center justify-between w-full">
                {/* <div>{a.name || `Agent ${i + 1} ${a.index}`}</div> */}
                {/* {UTILS_isToolAgent(a.type as AgentTypeEnum) ? (
                  <div>TOOL AGENT</div>
                ) : (
                  <div>TASK AGENT</div>
                )} */}
              </div>
              <Agent_comp
                elevenLabsVoices={elevenLabsVoices}
                voicesLoaded={voicesLoaded}
                agent_index={i}
                saveAgentState={saveAgentState}
                localStateObject={localStateObject}
                setLocalStateObject={setlocalStateObject}
                storedAgentStates={savedAgentStates}
                manualLoadAgentState={manualLoadAgentState}
                handleAutoPrompt={handleAutoPrompt}
                autoPromptModel={autoPromptModel}
                autoPromptExtraInfo={autoPromptExtraInfo}
                setAutoPromptExtraInfo={setAutoPromptExtraInfo}
                handleAutoPromptModelChange={(e: string) => console.log(e)}
                handlePromptTextToSet={handlePromptTextToSet}
                refreshAgentStates={refreshAgentStates}
              />
            </div>
          )}
        </div>
      </TabsContent>
    ));
  }, [
    localStateObject.currentAgents?.agents,
    elevenLabsVoices,
    voicesLoaded,
    saveAgentState,
    inputChanged,
    setlocalStateObject,
    setAIMessages,
    handleChangeIndex,
  ]);

  // ELEVEN_LABS_VOICE_LIST
  useEffect(() => {
    const _gdName = "ELEVEN_LABS_VOICE_LIST";
    if (
      UTILS_getGenericData(_gdName, {
        history: [],
        currentState: localStateObject,
      })
    ) {
      setElevenLabsVoices(
        UTILS_getGenericData(_gdName, {
          history: [],
          currentState: localStateObject,
        })
      );
      setVoicesLoaded(true);
    } else {
      const loadElevenLabsVoices = async () => {
        try {
          const voices = await listElevenLabsVoices();
          setElevenLabsVoices(voices.voices);
          setVoicesLoaded(true);
          UTILS_putGenericData(voices.voices, _gdName, {
            history: [],
            currentState: localStateObject,
          });
        } catch (error) {
          console.error("Error loading ElevenLabs voices:", error);
          setVoicesLoaded(false);
        }
      };
      if (!voicesLoaded) loadElevenLabsVoices();
    }
  }, []);

  // useEffect(() => {
  //   console.log("localStateObject", localStateObject);
  //   console.log("messages", messages);
  //   console.log("contextSets ", contextSets);

  //   // if (localStateObject.currentAgents.objectives) {
  //   //   console.log("localStateObject.currentAgents.objectives", localStateObject.currentAgents.objectives);
  //   // }
  // }, [localStateObject]);

  // useEffect(() => {
  //   console.log("setTabDefaultValue", currentAgentIndex);
  //   // setTabDefaultValue(
  //   //   localStateObject.currentAgents.agents[currentAgentIndex]
  //   //     .name || `Agent ${currentAgentIndex + 1}`
  //   // );

  //   // tabsRef.current?.setAttribute("defaultValue", tabDefaultValue);
  // }, [localStateObject.currentAgents.agents.length]);

  const handleTabChange = useCallback(
    (value: string) => {
      const newIndex = localStateObject.currentAgents.agents.findIndex(
        (a) => a.name === value
      );
      if (newIndex !== -1) {
        setCurrentAgentIndex(newIndex);
      }
    },
    [localStateObject.currentAgents.agents, setCurrentAgentIndex]
  );

  // Track KB status at framework level
  const [agentsWithKB, setAgentsWithKB] = useState<Record<string, boolean>>({});

  const handleKBStatusChange = useCallback(
    (agentId: string, hasKB: boolean) => {
      setAgentsWithKB((prev) => {
        // Only update if changed
        if (prev[agentId] === hasKB) return prev;
        return { ...prev, [agentId]: hasKB };
      });
    },
    []
  );

  const [isFrameworkLoading, setIsFrameworkLoading] = useState(false);

  const memoizedHandleChangeIndex = useCallback(() => {
    if (isFrameworkLoading) return;
    setIsFrameworkLoading(true);
    try {
      handleChangeIndex();
    } finally {
      setIsFrameworkLoading(false);
    }
  }, [handleChangeIndex]);

  const initializeAgentKnowledgeBasesStatus = useCallback(async () => {

    if (initialized.current) return; // Add this check
    

    // if (
    //   UTILS_getGenericData("original-kb-check", {
    //     history: [],
    //     currentState: localStateObject,
    //   })
    // ) {
    //   console.log("original-kb-check already set for this session");
    //   return;
    // }
    console.log("initializeAgentKnowledgeBasesStatus called");
    // UTILS_putGenericData(true, "original-kb-check", {
    //   history: [],
    //   currentState: localStateObject,
    // });

    if (!localStateObject?.currentAgents?.agents) {
      console.log("No agents found");
      return;
    };

    initialized.current = true; // Add this line

    const updatedState = structuredClone(localStateObject);

    let hasChanges = false;

    // Only check once per session
    for (const _ag of updatedState.currentAgents.agents) {

      const agentName = _ag.name;

      const _statusNameSpace = `AGENT_KB_STATUS_${agentName}`;

      const _status = UTILS_getGenericData(_statusNameSpace, {
        history: [],
        currentState: updatedState,
      });

      console.log("_status = ", _status);

      if (_status) {
        console.log("AGENT_KB_STATUS already set for this session");
        continue;
      }
      UTILS_putGenericData(true, _statusNameSpace, {
        history: [],
        currentState: updatedState,
      });

      const namespace = `agent-kb-${localStateObject.userId}-${_ag.name}`;

      console.log("NAMESPACE = ", namespace);

      try {
        const entries = await fetchKnowledgeBaseEntries(namespace);
        const hasKB = entries.length > 0;
        console.log(`${_ag.name} hasKB = `, hasKB);

        if (hasKB) {
          UTILS_putGenericData(entries, namespace, {
            history: [],
            currentState: updatedState,
          });
        }

        _ag.hasKnowledgeBase = hasKB;
        //if(_ag.hasKnowledgeBase) continue;
        // if (!('hasKnowledgeBase' in agent)) {
        console.log("Setting hasKnowledgeBase to ", hasKB);

        hasChanges = true;

        updatedState.currentAgents.agents =
          updatedState.currentAgents.agents.map((a) =>
            a.name === _ag.name ? { ...a, hasKnowledgeBase: hasKB } : a
          );
        //}
        //console.log("hasKnowledgeBase = ", updatedState.currentAgents.agents[i].hasKnowledgeBase);
      } catch (error) {
        console.error(`Error checking KB for agent ${_ag.name}:`, error);
        // if (agent.hasKnowledgeBase !== false) {
        _ag.hasKnowledgeBase = false;
        hasChanges = true;
        updatedState.currentAgents.agents =
          updatedState.currentAgents.agents.map((a) =>
            a.name === _ag.name ? { ...a, hasKnowledgeBase: false } : a
          );
        // }
        //console.log("hasKnowledgeBase = ", updatedState.currentAgents.agents[i].hasKnowledgeBase);
      } finally {
        console.log("KB initialized for ", _ag.name);
        // UTILS_putGenericData(true, _statusNameSpace, {
        //   history: [],
        //   currentState: updatedState,
        // });
      }
    }

    UTILS_putGenericData(true, "original-kb-check", {
      history: [],
      currentState: localStateObject,
    });

    if (hasChanges) {
      console.log("Setting localStateObject to ", updatedState);
      setlocalStateObject(updatedState);
    }
    
  }, [localStateObject, setlocalStateObject]);

  // Initialize knowledge base status for all agents
  useEffect(() => {
    // Depend on the agent list structure/length, not the whole function
    if (localStateObject?.currentAgents?.agents) {
      console.log("USEFFECT:initializeAgentKnowledgeBasesStatus called");
      initializeAgentKnowledgeBasesStatus();
    }
    // Only re-run if the number of agents changes or the initialize function itself changes (due to its own dependencies)
  }, [localStateObject.currentAgents.agents.length, initializeAgentKnowledgeBasesStatus]);

  return localStateObject ? (
    <div
      ref={fullscreenRef as React.LegacyRef<HTMLDivElement>}
      className={cn("overflow-y-auto w-full", isFullscreen ? "bg-slate-600/80" : "")}
      //className="h-[40rem] md:h-[40rem]? w-full min-w-72?  flex flex-col max-w-5xl? mx-auto items-center justify-start my-4?"
    >
      <Tabs
        onValueChange={handleTabChange}
        value={
          localStateObject.currentAgents.agents[currentAgentIndex] &&
          localStateObject.currentAgents.agents[currentAgentIndex].name
            ? localStateObject.currentAgents.agents[currentAgentIndex].name
            : `Agent ${localStateObject.currentAgents.agents.length + 1}`
        }
        //ref={tabsRef} //defaultValue={tabDefaultValue} className=""
      >
        <TabsList
          //defaultValue={0}
          className="flex flex-wrap items-center justify-around h-fit w-full bg-black/50 border-b-[1px] border-indigo-300/50"
        >
          <div
            onClick={() => {
              agentAutoSpawn();
            }}
            className="flex items-center justify-center h-4 w-4 p-0 text-xs font-medium bg-indigo-500/20 hover:bg-indigo-500/30 rounded-md border border-indigo-500/20 hover:border-indigo-500/30 transition-colors"
          >
            +
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap gap-1 p-1">
              {localStateObject.currentAgents.agents &&
                localStateObject.currentAgents.agents.map((agent, i) => (
                  <TabsTrigger
                    onClick={(event) => {
                      if ((event as unknown as MouseEvent).ctrlKey) {
                        if (
                          confirm(
                            `Are you sure you want to delete Agent ${i + 1}?`
                          )
                        ) {
                          const _newState = { ...localStateObject };
                          _newState.currentAgents.agents.splice(i, 1);
                          setlocalStateObject(_newState);
                        }
                      }
                    }}
                    className={cn(
                      "relative group flex items-center gap-1.5 px-2 py-1 min-w-[120px] max-w-[160px]",
                      "rounded-md border transition-all duration-200",
                      "hover:scale-102 hover:-translate-y-0.5",
                      i === currentAgentIndex
                        ? "bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border-indigo-500/30 text-indigo-200"
                        : "bg-slate-900/50 border-white/5 text-slate-300 hover:bg-slate-800/50",
                      agent.disabled && "opacity-40 line-through",
                      UTILS_isToolAgent(agent.type as AgentTypeEnum)
                        ? "hover:border-violet-500/30"
                        : "hover:border-indigo-500/30",
                      agent.training &&
                        "border-yellow-500/30 shadow-[0_0_10px_rgba(234,179,8,0.1)]"
                    )}
                    key={i}
                    value={agent.name || `Agent ${i + 1}`}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <div
                        className={cn(
                          "flex-shrink-0 p-1 rounded-md",
                          UTILS_isToolAgent(agent.type as AgentTypeEnum)
                            ? "bg-violet-500/10 text-violet-200"
                            : "bg-indigo-500/10 text-indigo-200"
                        )}
                      >
                        <BotIcon className="w-3 h-3" />
                      </div>
                      <span className="font-medium truncate flex-1 text-[11px]">
                        {agent.name || `Agent ${i + 1}`}
                      </span>
                    </div>
                    <div
                      className={cn(
                        "absolute right-1.5 opacity-0 group-hover:opacity-100 transition-opacity",
                        "flex items-center gap-1"
                      )}
                    >
                      {agent.disabled && (
                        <span className="text-[10px] text-red-400">
                          Disabled
                        </span>
                      )}
                      {agent.training && (
                        <span className="text-[10px] text-yellow-400">
                          Training
                        </span>
                      )}
                    </div>
                  </TabsTrigger>
                ))}
            </div>
          </div>
          <div>
            <div className="flex gap-1">
              {/* <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => {
                        setFullLength(!fullLength);
                      }}
                      className="flex items-center justify-center h-6? w-6? text-xs bg-indigo-500/20 hover:bg-indigo-500/30 rounded-md border border-indigo-500/20 hover:border-indigo-500/30 transition-colors"
                    >
                      {!fullLength ? (
                        <ArrowDownNarrowWideIcon className="w-3 h-3" />
                      ) : (
                        <ArrowUpNarrowWideIcon className="w-3 h-3" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    Toggle length
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider> */}

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      onClick={() => {
                        toggleFullscreen();
                      }}
                      className="flex items-center justify-center h-6 w-6 text-xs bg-indigo-500/20 hover:bg-indigo-500/30 rounded-md border border-indigo-500/20 hover:border-indigo-500/30 transition-colors cursor-pointer"
                    >
                      {isFullscreen ? (
                        <XIcon className="w-3 h-3" />
                      ) : (
                        <Maximize2Icon className="w-3 h-3" />
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    Toggle fullscreen
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </TabsList>

        {mapAgentsToTabs()}
      </Tabs>

      {/* <Tabs
        contentClassName="h-full "
        tabs={mapAgentsToTabs()}
        addAgent={addAgent}
        currentIndex={currentAgentIndex}
        setCurrentAgentIndex={setCurrentAgentIndex}
        localStateObject={localStateObject}
      /> */}
    </div>
  ) : (
    <div>Loading...</div>
  );
}

export default ACFramework;
