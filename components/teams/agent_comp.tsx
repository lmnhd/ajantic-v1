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
  // setAIMessages: (globalMessages: GlobalMessages) => void; // Likely handled by setLocalStateObject
  // handleChangeIndex: () => void; // Likely handled by parent
  handleAutoPrompt: (data: string) => Promise<void>;
  autoPromptModel: ModelArgs;
  handleAutoPromptModelChange: (e: string) => void;
  autoPromptExtraInfo: string;
  setAutoPromptExtraInfo: (e: string) => void;
  handlePromptTextToSet: (text: string) => void;
  handleOnBlur: (field: keyof AgentComponentProps, value: string) => void;
}> = ({
  system,
  agent_index,
  localStateObject,
  setLocalStateObject,
  // setAIMessages,
  // handleChangeIndex,
  handleAutoPrompt,
  autoPromptModel,
  handleAutoPromptModelChange,
  autoPromptExtraInfo,
  setAutoPromptExtraInfo,
  handlePromptTextToSet,
  handleOnBlur,
}) => {
  const [fullscreenRef, toggleFullscreen, isFullscreen] = useFullscreen(); // Needs migration

  // Helper to update agent prompts
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
      
      {/* System Prompt */}
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
  // inputChanged, // Likely unused in this specific component
  localStateObject,
  setLocalStateObject,
  // setAIMessages, // Use setLocalStateObject instead
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
  // handleChangeIndex, // Handled by parent
  refreshAgentStates,
}: {
  agent_index: number;
  saveAgentState: () => void;
  localStateObject: AISessionState;
  setLocalStateObject: (localStateObject: AISessionState) => void;
  // inputChanged: (input: string) => void;
  // setAIMessages: (globalMessages: GlobalMessages) => void;
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
  // handleChangeIndex: () => void;
  refreshAgentStates: () => void;
}) {
  const [agentTesterPopoverOpen, setAgentTesterPopoverOpen] = useState(false);
  const [roleDescription, setRoleDescription] = useState<string>("");
  const [fullscreenRef, toggleFullscreen, isFullscreen] = useFullscreen();
  const [isKnowledgeBaseOpen, setIsKnowledgeBaseOpen] = useState(false);

  // Centralized way to update agent state
  const updateAgentState = useCallback(
    (updateFn: (agent: AgentComponentProps) => AgentComponentProps) => {
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
    },
    [localStateObject, agent_index, setLocalStateObject]
  );

  useEffect(() => {
    const currentAgent = localStateObject.currentAgents.agents[agent_index];
    setRoleDescription(currentAgent?.roleDescription || "");
    // Add other state initializations if needed, e.g., for modelArgs, tools
  }, [agent_index, localStateObject]);

  // Generic handler for simple field updates
  const handleFieldUpdate = useCallback(
    (field: keyof AgentComponentProps, value: any) => {
       console.log(`Updating field ${field} for agent ${agent_index} with value:`, value);
       updateAgentState(agent => ({ ...agent, [field]: value }));
       toast({
          title: "Agent Updated",
          description: `${String(field)} updated.`,
          duration: 2000, // Shorter duration
       });
    },
    [updateAgentState, toast, agent_index]
  );

  // Specific handler for modelArgs updates
  const handleModelArgsUpdate = useCallback(
    (argsUpdate: Partial<ModelArgs>) => {
      updateAgentState(agent => ({
        ...agent,
        modelArgs: { ...(agent.modelArgs || {}), ...argsUpdate },
      }));
    },
    [updateAgentState]
  );

  const deleteAgent = () => {
    if (window.confirm("Are you sure you want to delete this agent?")) {
      const currentAgentName = localStateObject.currentAgents.agents[agent_index]?.name;
      if (!currentAgentName) return; // Safety check
      
      const newState = {
        ...localStateObject,
        currentAgents: {
          ...localStateObject.currentAgents,
          agents: localStateObject.currentAgents.agents.filter((_, idx) => idx !== agent_index),
        },
      };
      setLocalStateObject(newState);
       toast({ title: "Agent Deleted", description: `Agent ${currentAgentName} removed.`, variant: "destructive" });
       // Consider resetting agent index in parent if needed
    }
  };

  const handleVoiceChange = (voice: AgentVoice) => {
    updateAgentState(agent => ({ ...agent, voice }));
  };

  const toggleTool = (toolName: AI_Agent_Tools) => {
      updateAgentState(agent => {
          const currentTools = agent.tools || [];
          const newTools = currentTools.includes(toolName)
              ? currentTools.filter(t => t !== toolName)
              : [...currentTools, toolName];
          return { ...agent, tools: newTools };
      });
  };

  const currentAgent = localStateObject.currentAgents.agents[agent_index];

  // Render null or a placeholder if the agent doesn't exist (e.g., after deletion)
  if (!currentAgent) {
      return <div className="p-4 text-center text-gray-500">Agent not found.</div>;
  }

  const isToolAgentType = UTILS_isToolAgent(currentAgent.type as AgentTypeEnum); // Needs migration

  return (
    <div
      className={cn(
        "flex flex-col w-full h-full overflow-y-auto rounded-lg border border-white/5",
        "bg-gradient-to-br from-slate-950/40 to-slate-900/40 backdrop-blur-md",
        "shadow-lg shadow-black/20",
        currentAgent.disabled ? "opacity-60" : "",
        !isToolAgentType ? "hover:shadow-indigo-900/20" : "hover:shadow-violet-900/20",
        currentAgent.training ? "ring-2 ring-yellow-500/50" : ""
      )}
    >
      {/* Status Bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-1.5 bg-black/10 border-b border-white/5">
        <div className="flex items-center space-x-2">
          <Badge variant={isToolAgentType ? "secondary" : "default"} className="text-xs">
             {isToolAgentType ? "TOOL AGENT" : "TASK AGENT"}
          </Badge>
          <Badge variant={currentAgent.disabled ? "destructive" : currentAgent.training ? "outline" : "secondary"} className="text-xs">
            {currentAgent.disabled ? "Disabled" : currentAgent.training ? "Training" : "Active"}
          </Badge>
        </div>
         {/* Save/Load/Delete for individual agent */}
        <div className="flex items-center gap-1">
            <Button variant="ghost" size="xs" onClick={saveAgentState} title="Save Agent State"><Disc2Icon className="w-3 h-3" /></Button>
             <Select onValueChange={(e) => manualLoadAgentState(parseInt(e))}>
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

      {/* Main Content Area with Tabs */}
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

          {/* Basic Info Tab */}
          <TabsContent value="basic" className="space-y-3">
             <AgentComponentField name="Type">
                 <Select
                  defaultValue={currentAgent.type}
                  onValueChange={(e) => handleFieldUpdate("type", e)}
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
                  onBlur={(e) => handleFieldUpdate("name", e.target.value)}
                />
            </AgentComponentField>
            <AgentComponentField name="Title">
                <Input
                  className="w-full bg-slate-900/50 border-white/5 text-xs"
                  placeholder="ex. Lead Researcher"
                  defaultValue={currentAgent.title}
                  onBlur={(e) => handleFieldUpdate("title", e.target.value)}
                />
            </AgentComponentField>
            <AgentComponentField name="Role Desc">
                <textarea
                  className="w-full bg-slate-900/50 border border-white/5 rounded-md p-1.5 text-xs"
                  placeholder="ex. Finds information, analyzes data..."
                  defaultValue={currentAgent.roleDescription}
                  rows={3}
                  onBlur={(e) => handleFieldUpdate("roleDescription", e.target.value)}
                />
            </AgentComponentField>
          </TabsContent>

           {/* Model Tab */}
          <TabsContent value="model">
              <ModelProviderSelect
                localState={localStateObject} // Pass full state if needed by component
                setLocalState={setLocalStateObject} // Pass state setter
                model={currentAgent.modelArgs}
                index={agent_index} // Pass index to identify agent
                modelNameChanged={(modelName) => handleModelArgsUpdate({ modelName: modelName as ModelNames })}
                modelProviderChanged={(provider) => {
                  const newModelName = UTILS_updateModelNameAfterProviderChange(provider as ModelProviderEnum); // Needs migration
                  handleModelArgsUpdate({ provider: provider as ModelProviderEnum, modelName: newModelName as ModelNames });
                }}
                temperatureChanged={(temp) => handleModelArgsUpdate({ temperature: temp })}
              />
          </TabsContent>

          {/* Voice Tab */}
          <TabsContent value="voice">
              <AgentVoiceSelect
                onChange={handleVoiceChange}
                elevenLabsVoices={elevenLabsVoices}
                voicesLoaded={voicesLoaded}
                agentIndex={agent_index}
                localState={localStateObject}
              />
          </TabsContent>

          {/* Prompts Tab */}
          <TabsContent value="prompts">
              <AgentPromptsContainer
                system={currentAgent.systemPrompt as string}
                agent_index={agent_index}
                localStateObject={localStateObject}
                setLocalStateObject={setLocalStateObject}
                // setAIMessages={setAIMessages} // Removed
                // handleChangeIndex={handleChangeIndex} // Removed
                handleAutoPrompt={handleAutoPrompt}
                autoPromptModel={autoPromptModel}
                handleAutoPromptModelChange={handleAutoPromptModelChange}
                autoPromptExtraInfo={autoPromptExtraInfo}
                setAutoPromptExtraInfo={setAutoPromptExtraInfo}
                handlePromptTextToSet={handlePromptTextToSet}
                handleOnBlur={(field, value) => handleFieldUpdate(field, value)} // Use generic handler
              />
          </TabsContent>

          {/* Memory Tab */}
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
                        setHasKnowledgeBase={(val: boolean) => handleFieldUpdate("hasKnowledgeBase", val)}
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

          {/* Tools Tab (Conditional) */}
          {isToolAgentType && (
            <TabsContent value="tools">
                <div className="space-y-1">
                    {Object.values(AI_Agent_Tools)
                      .filter(tool => tool !== AI_Agent_Tools.AGENT_GLOBAL_STATE) // Exclude internal tool
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
                </div>
                {/* OAuth Panel (Conditional) */}
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