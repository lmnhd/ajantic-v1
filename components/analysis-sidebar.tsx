import { Users, MessageSquare, Settings, Plus, XIcon } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroupAction,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { GlobalStoreState, useGlobalStore } from "@/src/lib/store/GloabalStoreState";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

import { toast } from "@/components/ui/use-toast";
import {
  Select,
  SelectItem,
  SelectContent,
  SelectValue,
  SelectTrigger,
} from "@/components/ui/select";
import { AISessionState, AppFrozenState, ServerMessage } from "@/src/lib/types";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useEffect, useState } from "react";

import { useAnalysisStore } from '../src/lib/store/analysis-store';

export function AnalysisSidebar() {
  const {
    localState,
    currentConversation,
    contextSet,
    saveGlobalState,
    loadFrozenGlobalState,
    deleteFrozenGlobalState,
    frozenStates,
    loadAllFrozenStateNames,
    changeIndex,
    currentAgentIndex,
    agentActive,
    agentGlobalChatInput,

  } = useAnalysisStore();

  const team = localState?.currentAgents || { agents: [], name: "", objectives: "" };
  const [globalStateManagementOpen, setGlobalStateManagementOpen] = useState<boolean>(false);
  const [localFrozenStates, setLocalFrozenStates] = useState(frozenStates);

  useEffect(() => {
    console.log("Frozen states updated:", frozenStates);
    setLocalFrozenStates(frozenStates);
  }, [frozenStates]);

  useEffect(() => {
    if (localState?.userId) {
      console.log("Loading frozen states for userId:", localState.userId);
      loadAllFrozenStateNames(localState.userId);
    }
  }, [localState?.userId, loadAllFrozenStateNames]);

  return (
    <Sidebar className="mt-20 h-[calc(100vh-70px)] z-[20] bg-indigo-800/70" variant="floating" data-collapsible="offcanvas" >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton>
              <Settings className="w-4 h-4 mr-2" />
              <span>Analysis Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Team Members Group */}
        <SidebarGroup>
          <SidebarGroupLabel>Team Members</SidebarGroupLabel>
          <SidebarGroupAction title="Add Agent">
            <Plus className="w-4 h-4" />
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu>
              {team && team.agents && team.agents.map((agent) => (
                <SidebarMenuItem key={agent.name}>
                  <SidebarMenuButton>
                    <Users className="w-4 h-4 mr-2" />
                    <span>{agent.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Line Sets Group */}
        <SidebarGroup>
          <SidebarGroupLabel>Context Sets</SidebarGroupLabel>
          <SidebarGroupAction title="Add Context Set">
            <Plus className="w-4 h-4" />
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu>
              {contextSet && contextSet.sets && contextSet.sets.map((_contextSet, i) => (
                <SidebarMenuItem key={i}>
                  <SidebarMenuButton>
                    <MessageSquare className="w-4 h-4 mr-2" />
                    <span>
                      {_contextSet.setName || `Context Set ${i}`}
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => setGlobalStateManagementOpen(!globalStateManagementOpen)}>
              <Settings className="w-4 h-4 mr-2" />
              <span>Global State</span>
            </SidebarMenuButton>
            <SidebarContent>
              <SidebarGroup>
                <Collapsible open={globalStateManagementOpen}>
                  <CollapsibleContent className="w-full text-sm bg-black/50 backdrop-blur-2xl">
                    <div className="flex flex-col w-full gap-2 items-center justify-center p-1 rounded-sm">
                      <Button 
                        variant="outline" 
                        className="w-full p-1 text-xs bg-gradient-to-r from-indigo-950/70  via-violet-950/70 to-violet-700/70 mix-blend-color-dodge text-indigo-300"
                        onClick={saveGlobalState}
                      >
                        Save Global State
                      </Button>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button 
                            variant="outline" 
                            className="w-full p-1 text-xs bg-gradient-to-r from-indigo-950/70 via-violet-950/70 to-violet-700/70 mix-blend-color-dodge text-indigo-300"
                          >
                            Delete States
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full bg-black/50 backdrop-blur-2xl">
                          <div className="flex flex-col gap-1 items-start justify-center p-1 py-8 text-sm max-h-[400px] overflow-y-auto w-full">
                            <Button variant="outline" className="mt-4 flex justify-between items-center w-full p-1 text-xs bg-gradient-to-r from-red-950/70 via-red-800/70 to-red-700/70 mix-blend-color-dodge text-red-300 hover:bg-red-900/50" >-------</Button>
                              {frozenStates && frozenStates.length > 0 &&
                                frozenStates.map(
                                (gs, i) => (
                                  <Button
                                    key={i}
                                    variant="outline"
                                    className="flex justify-between items-center w-full p-1 text-xs bg-gradient-to-r from-red-950/70 via-red-800/70 to-red-700/70 mix-blend-color-dodge text-red-300 hover:bg-red-900/50"
                                    onClick={async () => {
                                      if (confirm("Are you sure you want to delete this state?")) {
                                        await deleteFrozenGlobalState(gs.id);
                                        await loadAllFrozenStateNames();
                                        
                                        toast({
                                          title: "State Deleted",
                                          description: `Successfully deleted state "${gs.name}"`,
                                        });
                                      }
                                    }}
                                  >
                                    <span>{gs.name}</span>
                                    <XIcon className="h-4 w-4 ml-2" />
                                  </Button>
                                )
                              )}
                          </div>
                        </PopoverContent>
                      </Popover>
                      <Button 
                        variant="outline" 
                        className="w-full p-1 text-xs bg-gradient-to-r from-indigo-700/70  via-violet-950/70 to-violet-700/70 mix-blend-color-dodge text-indigo-300"
                        onClick={() => {
                          console.log('Current frozen states:', frozenStates);
                          console.log('Current local state:', localState);
                          console.log('Current server messages:', currentConversation);
                          console.log('Current context set:', contextSet);
                          console.log("Curent Agent Index: ", currentAgentIndex)
                          console.log("Agent Active: ", agentActive)
                          console.log("Agent Global Chat Input: ", agentGlobalChatInput)
                          
                        }}
                      >
                        Log All States
                      </Button>
                      <Select
                        onValueChange={async (value) => {
                          await loadFrozenGlobalState(Number(value));
                        }}
                      >
                        <SelectTrigger className="w-full p-1 text-xs text-center bg-gradient-to-r from-indigo-700/70  via-violet-950/70 to-violet-700/70 mix-blend-color-dodge text-indigo-300">
                          <SelectValue placeholder="Select a global state" />
                        </SelectTrigger>
                        <SelectContent>
                          {frozenStates.map((af, i: number) => (
                              <SelectItem
                                key={i}
                                value={String(af.id)}
                                // onContextMenu={async (e) => {
                                //   e.preventDefault();
                                //   if (confirm("Are you sure you want to delete this global state?")) {
                                //     await deleteFrozenGlobalState(af.id);
                                //     await loadAllFrozenStateNames();
                                //   }
                                // }}
                              >
                                <div className="w-full flex items-center justify-between">
                                  <p>{af.name}</p>
                                </div>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarGroup>
            </SidebarContent>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
