import ModelSelectGroup, {
  ModelProviderSelect,
} from "@/components/global/model-provider-select"; // Needs migration
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
import { useAnalysisStore } from "@/src/lib/store/analysis-store";
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
  UTILS_getAgentToolsEmulatorsByName,
  UTILS_getRandomColor,
  UTILS_getRandomTailwindColor,
  UTILS_isToolAgent,
  UTILS_putGenericData,
  UTILS_updateModelNameAfterProviderChange,
} from "@/src/lib/utils"; // Needs migration for specific UTILS
import React, { useState, useEffect, useCallback } from "react";
import PromptWindowControl from "@/components/promptwindocontrol"; // Placeholder
import { Button } from "@/components/ui/button";
import {
  AxeIcon,
  DeleteIcon,
  Disc2Icon,
  PlusIcon,
  Trash2Icon,
  SpeakerIcon,
} from "lucide-react";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { BoxIcon } from "@radix-ui/react-icons";

import { CoreTool, Message } from "ai";
import { z } from "zod";
import AgentTester from "@/components/agent-tester"; // Placeholder
import { GeneralPurpose } from "@prisma/client"; // Assuming Prisma setup
import { toast } from "@/components/ui/use-toast";
import AgentVoiceSelect from "@/components/agent-voices/agent-voice-select"; // Placeholder

import AgentStoredInfo from "@/components/agent-stored-info"; // Placeholder

import KB_LiveQueryComponent from "@/src/lib/agent-kb/kb-livequery"; // Needs migration/refactor
import KnowledgeBaseComponent from "@/src/lib/agent-kb/kb-component"; // Needs migration/refactor
import { useFullscreen } from "@/src/lib/hooks/useFullscreen"; // Placeholder
import OauthPanel from "@/components/oauth-panel"; // Placeholder
import AllowedContacts from "@/components/allowed-contacts"; // Placeholder
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PromptComp from "./prompt_comp";
import { Badge } from "@/components/ui/badge";
import { fetchCustomToolNames } from "@/src/lib/agent-tools/tool-registry/tool-metadata";
import { getCustomToolId } from "@/src/lib/agent-tools/tool-registry/custom-tool-ref";

const debugState = (tag: string, agentIndex: number, state: any) => {
  console.group(`🔍 DEBUG [${tag}]`);
  if (state?.currentAgents?.agents && state.currentAgents.agents[agentIndex]) {
    console.log('Agent index:', agentIndex);
    console.log('Agent name:', state.currentAgents.agents[agentIndex].name);
    console.log('Model args:', state.currentAgents.agents[agentIndex].modelArgs);
    console.log('Provider:', state.currentAgents.agents[agentIndex].modelArgs?.provider);
    console.log('Model name:', state.currentAgents.agents[agentIndex].modelArgs?.modelName);
  } else {
    console.error('Agent not found in state');
    console.log('State:', state);
  }
  console.groupEnd();
};

const AgentComponentField = ({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode; // Changed type to React.ReactNode
}) => {
  return (
    <div className="grid grid-cols-8 items-center justify-start gap-2 w-full my-1 border-b border-white/20 pb-2">
      <Label className="col-span-2 text-xs text-right border-r border-white/20 pr-2">
        {name}
      </Label>
      <div className="col-span-6 ">{children}</div>
    </div>
  );
};

const AgentPromptsContainer: React.FC<{
  system: string;
  agent_index: number;
  localStateObject: AISessionState;
  setLocalStateObject: (localStateObject: AISessionState) => void;
  handleAutoPrompt: (data: string) => Promise<void>;
  autoPromptModel: ModelArgs;
  handleAutoPromptModelChange: (e: string) => void;
  autoPromptExtraInfo: string;
  setAutoPromptExtraInfo: (e: string) => void;
  handlePromptTextToSet: (text: string) => void;
  handleOnBlur: (field: keyof AgentComponentProps, value: string | boolean) => void;
}> = ({
  system,
  agent_index,
  localStateObject,
  setLocalStateObject,
  handleAutoPrompt,
  autoPromptModel,
  handleAutoPromptModelChange,
  autoPromptExtraInfo,
  setAutoPromptExtraInfo,
  handlePromptTextToSet,
  handleOnBlur,
}) => {
  const [fullscreenRef, toggleFullscreen, isFullscreen] = useFullscreen(); // Needs migration

  const updateAgentPrompts = (updateFn: (agent: AgentComponentProps) => AgentComponentProps) => {
    const newState = {
        ...localStateObject,
        currentAgents: {
            ...localStateObject.currentAgents,
            agents: localStateObject.currentAgents.agents.map((agent, idx) =>
                idx === agent_index ? updateFn(agent) : agent
            ),
        },
    };
    setLocalStateObject(newState);
    setTimeout(() => useAnalysisStore.getState().saveState(), 100);
  };

  const newDirective = () => {
    updateAgentPrompts(agent => ({
        ...agent,
        promptDirectives: [...(agent.promptDirectives || []), ""]
    }));
  };

  const deleteDirective = (directiveIndex: number) => {
      updateAgentPrompts(agent => ({
          ...agent,
          promptDirectives: agent.promptDirectives?.filter((_, i) => i !== directiveIndex)
      }));
  };

  const updateDirective = (directiveIndex: number, value: string) => {
      updateAgentPrompts(agent => ({
          ...agent,
          promptDirectives: agent.promptDirectives?.map((d, i) => i === directiveIndex ? value : d)
      }));
  };

  return (
    <div className="space-y-4">
      
      <PromptComp
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
        handleInputChange={ (value: string) => handleOnBlur("systemPrompt", value)}
      />

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
              <div className="absolute -left-10 top-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteDirective(directiveIndex)}
                  className="h-6 w-6 text-red-400 hover:text-red-300 hover:bg-red-900/20"
                >
                  <Trash2Icon className="w-3 h-3" />
                </Button>
              </div>
              <textarea
                defaultValue={directive}
                onBlur={(e) => updateDirective(directiveIndex, e.target.value)}
                className="w-full h-20 bg-indigo-900 border border-white/10 rounded-md p-3 text-sm text-indigo-200 resize-none focus:ring-1 focus:ring-indigo-500/20 focus:border-indigo-500/20"
                placeholder={`Directive ${directiveIndex + 1}...`}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default function Agent_comp({
  agent_index,
  saveAgentState,
  localStateObject,
  setLocalStateObject,
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
  refreshAgentStates,
  isVisuallyDisabled,
}: {
  agent_index: number;
  saveAgentState: () => void;
  localStateObject: AISessionState;
  setLocalStateObject: (localStateObject: AISessionState) => void;
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
  refreshAgentStates: () => void;
  isVisuallyDisabled?: boolean;
}) {
  const [agentTesterPopoverOpen, setAgentTesterPopoverOpen] = useState(false);
  const [roleDescription, setRoleDescription] = useState<string>("");
  const [fullscreenRef, toggleFullscreen, isFullscreen] = useFullscreen();
  const [isKnowledgeBaseOpen, setIsKnowledgeBaseOpen] = useState(false);
  const [customToolNames, setCustomToolNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const currentAgent = localStateObject.currentAgents.agents[agent_index];
    setRoleDescription(currentAgent?.roleDescription || "");
  }, [agent_index, localStateObject]);

  const handleDirectUpdate = useCallback(
    (field: keyof AgentComponentProps, value: any) => {
       console.log(`Directly updating field ${field} for agent ${agent_index} with value:`, value);

       const currentAgent = localStateObject.currentAgents.agents[agent_index];
       const updatedAgent = {
         ...currentAgent,
         [field]: value,
       };

       const newState = {
         ...localStateObject,
         currentAgents: {
           ...localStateObject.currentAgents,
           agents: localStateObject.currentAgents.agents.map((agent, idx) =>
             idx === agent_index ? updatedAgent : agent
           ),
         },
       };
       setLocalStateObject(newState);

       setTimeout(() => useAnalysisStore.getState().saveState(), 100);

       toast({
          title: "Agent Updated",
          description: `${String(field)} updated.`,
          duration: 1500,
       });
    },
    [localStateObject, agent_index, setLocalStateObject, toast]
  );

  const deleteAgent = () => {
    if (window.confirm("Are you sure you want to delete this agent?")) {
      const currentAgentName = localStateObject.currentAgents.agents[agent_index]?.name;
      if (!currentAgentName) return;

      const newState = {
        ...localStateObject,
        currentAgents: {
          ...localStateObject.currentAgents,
          agents: localStateObject.currentAgents.agents.filter((_, idx) => idx !== agent_index),
        },
      };
      setLocalStateObject(newState);
      setTimeout(() => useAnalysisStore.getState().saveState(), 100);
      toast({ title: "Agent Deleted", description: `Agent ${currentAgentName} removed.`, variant: "destructive" });
    }
  };

  const handleVoiceChange = (voice: AgentVoice) => {
     const currentAgent = localStateObject.currentAgents.agents[agent_index];
     const updatedAgent = {
       ...currentAgent,
       voice: voice,
     };
     const newState = {
       ...localStateObject,
       currentAgents: {
         ...localStateObject.currentAgents,
         agents: localStateObject.currentAgents.agents.map((agent, idx) =>
           idx === agent_index ? updatedAgent : agent
         ),
       },
     };
     setLocalStateObject(newState);
     setTimeout(() => useAnalysisStore.getState().saveState(), 100);
  };

  const toggleTool = (toolName: AI_Agent_Tools | string) => {
      const currentAgent = localStateObject.currentAgents.agents[agent_index];
      const currentTools = currentAgent.tools || [];
      const newTools = currentTools.includes(toolName)
          ? currentTools.filter(t => t !== toolName)
          : [...currentTools, toolName];

      const updatedAgent = { ...currentAgent, tools: newTools };

      const newState = {
        ...localStateObject,
        currentAgents: {
          ...localStateObject.currentAgents,
          agents: localStateObject.currentAgents.agents.map((agent, idx) =>
            idx === agent_index ? updatedAgent : agent
          ),
        },
      };
      setLocalStateObject(newState);
      setTimeout(() => useAnalysisStore.getState().saveState(), 100);
  };

  const currentAgent = localStateObject.currentAgents.agents[agent_index];

  if (!currentAgent) {
      return <div className="p-4 text-center text-gray-500">Agent not found.</div>;
  }

  const isToolAgentType = UTILS_isToolAgent(currentAgent.type as AgentTypeEnum);

  useEffect(() => {
    async function loadCustomToolNames() {
      const currentAgent = localStateObject.currentAgents.agents[agent_index];
      if (!currentAgent?.tools) return;
      
      const customToolRefs = currentAgent.tools.filter(
        tool => typeof tool === 'string' && tool.toString().startsWith('CUSTOM_TOOL:')
      ) as string[];
      
      if (customToolRefs.length === 0) return;
      
      const names = await fetchCustomToolNames(customToolRefs);
      setCustomToolNames(names);
    }
    
    loadCustomToolNames();
  }, [localStateObject.currentAgents.agents, agent_index]);

  useEffect(() => {
    if (currentAgent?.modelArgs) {
      console.log("🔄 Model args changed:", currentAgent.modelArgs);
      console.log("Provider:", currentAgent.modelArgs.provider);
      console.log("Model name:", currentAgent.modelArgs.modelName);
    }
  }, [currentAgent?.modelArgs?.provider, currentAgent?.modelArgs?.modelName]);

  const handleManualLoad = (id: number) => {
    console.log("Loading agent with ID:", id);
    debugState('BEFORE_LOAD', agent_index, localStateObject);
    manualLoadAgentState(id);
    setTimeout(() => {
      debugState('AFTER_LOAD', agent_index, localStateObject);
    }, 1000);
  };

  return (
    <div
      className={cn(
        "flex flex-col w-full h-full overflow-y-auto rounded-lg border border-white/5",
        "bg-gradient-to-br from-slate-950/40 to-slate-900/40 backdrop-blur-md",
        "shadow-lg shadow-black/20",
        isVisuallyDisabled ? "opacity-60" : "",
        currentAgent.training ? "ring-2 ring-yellow-500/50" : "",
        !isToolAgentType ? "hover:shadow-indigo-900/20" : "hover:shadow-violet-900/20"
      )}
    >
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-1.5 bg-black/10 border-b border-white/5">
        <div className="flex items-center space-x-2">
          <Badge variant={isToolAgentType ? "secondary" : "default"} className="text-xs">
             {isToolAgentType ? "TOOL AGENT" : "TASK AGENT"}
          </Badge>
          <Badge variant={currentAgent.disabled ? "destructive" : currentAgent.training ? "outline" : "secondary"} className="text-xs">
            {currentAgent.disabled ? "Disabled" : currentAgent.training ? "Training" : "Active"}
          </Badge>
          {isVisuallyDisabled && !currentAgent.disabled && (
            <Badge variant="outline" className="text-xs text-gray-400 border-gray-600">Inactive</Badge>
          )}
        </div>
         <div className="flex items-center gap-1">
            <Button variant="ghost" size="xs" onClick={() => {
              debugState('MANUAL_SAVE_CLICK', agent_index, localStateObject);
              useAnalysisStore.getState().saveState(); 
              toast({ title: "State Saved", description: "Current agent team state persisted.", duration: 1500 });
            }} title="Save Current State"><Disc2Icon className="w-3 h-3" /></Button>
             <Select onValueChange={(e) => handleManualLoad(parseInt(e))}>
              <SelectTrigger className="w-auto h-6 px-2 text-[10px] bg-transparent border-none text-gray-400 hover:text-white">
                <SelectValue placeholder="Load" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel className="text-xs">Saved Agents</SelectLabel>
                  {storedAgentStates.agents.map((state) => (
                    <SelectItem key={state.id} value={state.id.toString()} className="text-xs">
                      {state.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="xs" onClick={deleteAgent} title="Delete Agent" className="text-red-400 hover:text-red-300"><Trash2Icon className="w-3 h-3" /></Button>
        </div>
      </div> 
      <div className="flex-grow p-3 overflow-y-auto">
        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid grid-cols-3 sm:grid-cols-6 gap-1 mb-3 bg-black/10 p-1 h-auto">
            <TabsTrigger value="basic" className="h-6 px-1.5 text-[10px] data-[state=active]:bg-slate-800"><BoxIcon className="w-3 h-3 mr-1" />Basic</TabsTrigger>
            <TabsTrigger value="model" className="h-6 px-1.5 text-[10px] data-[state=active]:bg-slate-800"><Disc2Icon className="w-3 h-3 mr-1" />Model</TabsTrigger>
            <TabsTrigger value="voice" className="h-6 px-1.5 text-[10px] data-[state=active]:bg-slate-800"><SpeakerIcon className="w-3 h-3 mr-1" />Voice</TabsTrigger>
            <TabsTrigger value="prompts" className="h-6 px-1.5 text-[10px] data-[state=active]:bg-slate-800"><BoxIcon className="w-3 h-3 mr-1" />Prompts</TabsTrigger>
            <TabsTrigger value="memory" className="h-6 px-1.5 text-[10px] data-[state=active]:bg-slate-800"><BoxIcon className="w-3 h-3 mr-1" />Memory</TabsTrigger>
            {isToolAgentType && <TabsTrigger value="tools" className="h-6 px-1.5 text-[10px] data-[state=active]:bg-slate-800"><AxeIcon className="w-3 h-3 mr-1" />Tools</TabsTrigger>}
          </TabsList>

          <TabsContent value="basic" className="space-y-3">
             <AgentComponentField name="Type">
                 <Select
                  defaultValue={currentAgent.type}
                  onValueChange={(e) => handleDirectUpdate("type", e)}
                >
                  <SelectTrigger className="w-full bg-slate-900/50 border-white/5 text-xs">
                    <SelectValue placeholder="Select Agent Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(AgentTypeEnum).map((type) => (
                      <SelectItem key={type} value={type} className="text-xs">
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
             </AgentComponentField>
            <AgentComponentField name="Name">
                 <Input
                  className="w-full bg-slate-900/50 border-white/5 text-xs"
                  defaultValue={currentAgent.name}
                  onBlur={(e) => handleDirectUpdate("name", e.target.value)}
                />
            </AgentComponentField>
            <AgentComponentField name="Title">
                <Input
                  className="w-full bg-slate-900/50 border-white/5 text-xs"
                  placeholder="ex. Lead Researcher"
                  defaultValue={currentAgent.title}
                  onBlur={(e) => handleDirectUpdate("title", e.target.value)}
                />
            </AgentComponentField>
            <AgentComponentField name="Role Desc">
                <textarea
                  className="w-full bg-slate-900/50 border border-white/5 rounded-md p-1.5 text-xs"
                  placeholder="ex. Finds information, analyzes data..."
                  defaultValue={currentAgent.roleDescription}
                  rows={3}
                  onBlur={(e) => handleDirectUpdate("roleDescription", e.target.value)}
                />
            </AgentComponentField>
          </TabsContent>

           <TabsContent value="model">
              <ModelProviderSelect
                localState={localStateObject}
                model={currentAgent.modelArgs}
                index={agent_index}
                modelNameChanged={(modelName) => {
                  console.log("Model name changing to:", modelName);
                  const updatedAgent = {
                    ...currentAgent,
                    modelArgs: { ...(currentAgent.modelArgs || {}), modelName: modelName as ModelNames },
                  };
                  const newState = {
                    ...localStateObject,
                    currentAgents: {
                      ...localStateObject.currentAgents,
                      agents: localStateObject.currentAgents.agents.map((agent, idx) =>
                        idx === agent_index ? updatedAgent : agent
                      ),
                    },
                  };
                  setLocalStateObject(newState);
                  setTimeout(() => useAnalysisStore.getState().saveState(), 100);
                  toast({ title: "Model Name Updated", duration: 1500 });
                }}
                modelProviderChanged={(provider) => {
                  console.log("Provider changing to:", provider);
                  const newModelName = UTILS_updateModelNameAfterProviderChange(provider as ModelProviderEnum);
                  const updatedAgent = {
                    ...currentAgent,
                    modelArgs: {
                      ...(currentAgent.modelArgs || {}),
                      provider: provider as ModelProviderEnum,
                      modelName: newModelName as ModelNames
                    },
                  };
                  const newState = {
                    ...localStateObject,
                    currentAgents: {
                      ...localStateObject.currentAgents,
                      agents: localStateObject.currentAgents.agents.map((agent, idx) =>
                        idx === agent_index ? updatedAgent : agent
                      ),
                    },
                  };
                  setLocalStateObject(newState);
                  setTimeout(() => useAnalysisStore.getState().saveState(), 100);
                  toast({ title: "Model Provider Updated", duration: 1500 });
                }}
                temperatureChanged={(temp) => {
                   const updatedAgent = {
                    ...currentAgent,
                    modelArgs: { ...(currentAgent.modelArgs || {}), temperature: temp },
                  };
                  const newState = {
                    ...localStateObject,
                    currentAgents: {
                      ...localStateObject.currentAgents,
                      agents: localStateObject.currentAgents.agents.map((agent, idx) =>
                        idx === agent_index ? updatedAgent : agent
                      ),
                    },
                  };
                  setLocalStateObject(newState);
                  setTimeout(() => useAnalysisStore.getState().saveState(), 100);
                  toast({ title: "Temperature Updated", duration: 1500 });
                }}
              />
          </TabsContent>

          <TabsContent value="voice">
              <AgentVoiceSelect
                onChange={handleVoiceChange}
                elevenLabsVoices={elevenLabsVoices}
                voicesLoaded={voicesLoaded}
                agentIndex={agent_index}
                localState={localStateObject}
              />
          </TabsContent>

          <TabsContent value="prompts">
              <AgentPromptsContainer
                system={currentAgent.systemPrompt as string}
                agent_index={agent_index}
                localStateObject={localStateObject}
                setLocalStateObject={setLocalStateObject}
                handleAutoPrompt={handleAutoPrompt}
                autoPromptModel={autoPromptModel}
                handleAutoPromptModelChange={handleAutoPromptModelChange}
                autoPromptExtraInfo={autoPromptExtraInfo}
                setAutoPromptExtraInfo={setAutoPromptExtraInfo}
                handlePromptTextToSet={handlePromptTextToSet}
                handleOnBlur={handleDirectUpdate}
              />
          </TabsContent>

          <TabsContent value="memory" className="space-y-3">
             <AgentComponentField name="Stored Info">
                 <Popover>
                  <PopoverTrigger asChild>
                      <Button variant="outline" size="xs" className="w-full justify-start text-left font-normal">View Stored Info</Button>
                   </PopoverTrigger>
                  <PopoverContent className="w-80">
                    <AgentStoredInfo
                      agent={currentAgent}
                      teamName={localStateObject.currentAgents.name}
                      userId={localStateObject.userId}
                    />
                  </PopoverContent>
                </Popover>
            </AgentComponentField>
            <AgentComponentField name="Knowledge Base">
                 <Collapsible
                  open={isKnowledgeBaseOpen}
                  onOpenChange={setIsKnowledgeBaseOpen}
                  className="w-full"
                >
                  <CollapsibleTrigger asChild>
                      <Button variant="outline" size="xs" className="w-full justify-between text-left font-normal">
                          <span>{currentAgent.hasKnowledgeBase ? "View KB" : "Setup KB"}</span>
                          <span className="text-slate-500">{isKnowledgeBaseOpen ? "↑" : "↓"}</span>
                      </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 border-t border-white/10 pt-2">
                    <div ref={fullscreenRef as unknown as React.RefObject<HTMLDivElement>}>
                      <KnowledgeBaseComponent
                        isEnabled={true}
                        namespace={`agent-kb-${localStateObject.userId}-${currentAgent.name}`}
                        agentName={currentAgent.name}
                        userId={localStateObject.userId}
                        onKnowledgeBaseUpdate={() => console.log("KB Updated")}
                        setHasKnowledgeBase={(val: boolean) => handleDirectUpdate("hasKnowledgeBase", val)}
                        autoKBArgs={{
                          agentTitle: currentAgent.title,
                          agentRole: currentAgent.roleDescription,
                          teamObjectives: localStateObject.currentAgents.objectives,
                        }}
                        localState={localStateObject}
                        toggleFullScreen={toggleFullscreen}
                      />
                      {currentAgent.hasKnowledgeBase && (
                        <div className="mt-2">
                          <KB_LiveQueryComponent
                            agentName={currentAgent.name}
                            userId={localStateObject.userId}
                          />
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
            </AgentComponentField>
          </TabsContent>

          {isToolAgentType && (
            <TabsContent value="tools">
                <div className="space-y-1">
                    <div className="mb-2 border-b border-white/10 pb-1">
                      <h4 className="text-xs font-medium text-slate-300">Standard Tools</h4>
                    </div>
                    {Object.values(AI_Agent_Tools)
                      .filter(tool => tool !== AI_Agent_Tools.AGENT_GLOBAL_STATE)
                      .map((tool) => (
                        <Button
                            key={tool}
                            variant={currentAgent.tools?.includes(tool) ? "secondary" : "ghost"}
                            size="xs"
                            onClick={() => toggleTool(tool)}
                            className="w-full justify-start text-left"
                        >
                           {tool}
                           {currentAgent.tools?.includes(tool) && <span className="ml-auto text-green-400">✓</span>}
                        </Button>
                    ))}
                    
                    {currentAgent.tools?.some(tool => typeof tool === 'string' && tool.startsWith('CUSTOM_TOOL:')) && (
                      <>
                        <div className="mt-4 mb-2 border-b border-white/10 pb-1">
                          <h4 className="text-xs font-medium text-slate-300">Custom Tools</h4>
                        </div>
                        {currentAgent.tools
                          .filter(tool => typeof tool === 'string' && tool.startsWith('CUSTOM_TOOL:'))
                          .map((toolRef) => (
                            <Button
                              key={toolRef}
                              variant="secondary"
                              size="xs"
                              onClick={() => toggleTool(toolRef)}
                              className="w-full justify-start text-left"
                            >
                              {customToolNames[toolRef as string] || 
                                (typeof toolRef === 'string' ? `Custom: ${toolRef.split(':')[1] || toolRef}` : String(toolRef))}
                              <span className="ml-auto text-green-400">✓</span>
                            </Button>
                          ))
                        }
                      </>
                    )}
                </div>
                {currentAgent.tools?.includes(AI_Agent_Tools.OAUTH_PROVIDER) && (
                    <div className="mt-4 border-t border-white/10 pt-3">
                    <Label className="text-xs font-medium text-slate-300 mb-1 block">OAuth Configuration</Label>
                    <OauthPanel userId={localStateObject.userId} />
                    </div>
                )}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
} 