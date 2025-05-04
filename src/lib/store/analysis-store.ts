// Create a new file: lib/state/analysis-store.ts
import { create } from "zustand";
import {
  AISessionState,
  ServerMessage,
  Team,
  AgentTypeEnum,
  AppFrozenState,
  GlobalMessages,
  AgentComponentProps,
  ContextContainerProps,
  ContextSet,
} from "@/src/lib/types";
import { OrchestrationType2 } from "@/src/lib/orchestration/types/base";
import { GeneralPurpose } from "@prisma/client";
import { SERVER_getAgentsAndTeams } from "@/src/lib/server2";
import {
  CONVERSATION_loadLatestDayConversations,
  CONVERSATION_getAllConversationDaysForUser,
  CONVERSATION_loadByDay,
  CONVERSATION_getById,
} from "../conversation";

// Import functions from separate files
import {
  initialize,
  saveState,
  megaLoadStateFromBrowserOrServer,
  updateLocalState,
} from "../workflow/functions/core-state";

import {
  updateMessages,
  handleClearMessages,
  syncWithGlobalMessages,
} from "../workflow/functions/message-handlers";

import {
  handlePromptTextToSet,
  deleteTextFromSet,
  setLineSetState,
} from "../workflow/functions/line-sets";

import {
  setCurrentAgentIndex,
  loadTeam,
  loadAgent,
  saveAgentState,
  deleteTeam,
} from "../workflow/functions/agent-handlers";

import {
  saveGlobalState,
  loadFrozenGlobalState,
  deleteFrozenGlobalState,
  loadAllFrozenStateNames,
} from "../workflow/functions/global-state";
import { Message } from "ai";
import {
  handleLoadContextSet,
  handleSaveContextSet,
  setContextSetStore,
  setCurrentContextItem,
  handleDeleteContextSet,
  handleDeleteMultipleContextSets,
} from "../workflow/functions/context-sets";
import { toast } from "@/components/ui/use-toast";
import { handleAgentChatSubmit } from "../workflow/functions/message-handlers/agent-chat-submit";
import { handleOrchestratedChatSubmit } from "../workflow/functions/message-handlers/orchestrated-chat";

import { APP_FROZEN_getById } from "@/src/lib/app-frozen";
import { TEAM_autogen_create_workflow } from "@/src/lib/autogen/autogen";
import { AutoGenWorkflowProps } from "../autogen/autogen-types";

// Helper function to calculate agent disabled states based on orchestration settings
const updateAgentDisabledStates = (
  agents: AgentComponentProps[],
  orchestrationMode: OrchestrationType2,
  customAgentSet: string[]
) => {
  const isDirectMode = orchestrationMode === OrchestrationType2.DIRECT_AGENT_INTERACTION;
  const hasCustomSet = customAgentSet && customAgentSet.length > 0;
  
  return agents.map(agent => {
    let calculatedDisabled = false;
    
    if (!isDirectMode) {
      const isSequentialType = [
        OrchestrationType2.SEQUENTIAL_WORKFLOW,
        OrchestrationType2.REVERSE_WORKFLOW,
        OrchestrationType2.RANDOM_WORKFLOW
      ].includes(orchestrationMode);
      
      const isAdvancedType = [
        OrchestrationType2.LLM_ROUTED_WORKFLOW,
        OrchestrationType2.MANAGER_DIRECTED_WORKFLOW
      ].includes(orchestrationMode);
      
      const isManager = agent.type === AgentTypeEnum.MANAGER;
      const isInCustomSet = hasCustomSet && customAgentSet.includes(agent.name);
      
      if (isSequentialType) {
        if (hasCustomSet) {
          calculatedDisabled = isManager || !isInCustomSet;
        } else {
          calculatedDisabled = isManager;
        }
      } else if (isAdvancedType) {
        if (hasCustomSet) {
          calculatedDisabled = !isManager && !isInCustomSet;
        }
      }
    }
    
    return {
      ...agent,
      disabled: calculatedDisabled
    };
  });
};

export interface AnalysisState {
  // Core state
  localState: AISessionState;
  setLocalState: (state: AISessionState) => void;

  // Agent orchestration state
  agentOrder: "sequential" | "seq-reverse" | "random";
  rounds: number;
  maxRounds: number;
  orchestrationMode: OrchestrationType2;
  customAgentSet: string[];
  setAgentOrder: (order: "sequential" | "seq-reverse" | "random") => void;
  setRounds: (rounds: number) => void;
  setMaxRounds: (maxRounds: number) => void;
  setOrchestrationMode: (mode: OrchestrationType2) => void;
  setCustomAgentSet: (agents: string[]) => void;

  currentAgentIndex: number;
  currentContextSetItem: number;
  setCurrentContextSetItem: (index: number) => void;
  contextSetStore: { id: number; teamName: string }[];

  // Autogen state
  handleTeamAutoGen: (props: AutoGenWorkflowProps) => Promise<AutoGenWorkflowProps>;

  // UI state
  llmMode: "chat" | "agent";

  // Loading states
  isInitialized: boolean;
  isLoading: boolean;
  agentActive: boolean;
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
  agentGlobalChatInput: string;
  agentGlobalChatInputChanged: (input: string) => void;
  changeIndex: number;
  lineSetStates: GeneralPurpose[];
  frozenStates: { name: string; id: number }[];

  // Messages and Message history
  currentConversation: ServerMessage[];
  converationsForDay: { id: number; dayName: string }[];
  conversationHistory: string[];
  changeMessageHistory: (dayName: string) => void;
  updateMessages: (messages: ServerMessage[]) => void;
  handleClearMessages: () => void;
  setMessageHistory: (dayName: string) => void;

  // Actions
  setCurrentAgentIndex: (index: number) => void;
  handlePromptTextToSet: (text: string) => void;
  handleDeleteTextFromSet: (text: string) => void;
  saveAgentState: () => Promise<void>;
  handleChangeIndex: () => void;
  setCurrentContextItem: (index: number) => void;
  setLineSetState: (states: GeneralPurpose[]) => void;
  setContextSetStore: (store: { id: number; teamName: string }[]) => void;
  handleLoadContextSet: (id: number) => void;
  handleSaveContextSet: (contextSet: ContextSet, name: string) => Promise<void>;
  deleteTextFromSet: (text: string) => void;
  handleAgentChatSubmit: (e: any) => Promise<void>;
  handleOrchestratedChatSubmit: (
    orchType: OrchestrationType2,
    numRounds: number,
    maxRounds: number,
    order: "sequential" | "seq-reverse" | "random",
    customAgentSet?: string[]
  ) => Promise<void>;
  refreshAgentStates: () => void;
  setAgentActive: (active: boolean) => void;

  initialize: (userId: string) => Promise<void>;
  saveState: () => Promise<void>;
  megaLoadStateFromBrowserOrServer: () => Promise<void>;
  updateLocalState: (state: Partial<AISessionState>) => void;
  loadTeam: (teamId: number) => void;
  loadAgent: (agentId: number) => void;
  deleteTeam: (teamId: number) => Promise<void>;
  syncWithGlobalMessages: (globalMessages: GlobalMessages) => void;
  saveGlobalState: () => Promise<void>;
  loadFrozenGlobalState: (id: number) => Promise<void>;
  deleteFrozenGlobalState: (id: number) => Promise<void>;
  loadAllFrozenStateNames: (userId?: string) => Promise<void>;
  loadEssentialData: (userId: string) => Promise<void>;

  handleDeleteContextSet: (id: number) => Promise<void>;
  handleDeleteMultipleContextSets: (ids: number[]) => Promise<void>;

  // New actions
  updateContextSet: (updates: Partial<ContextSet>) => void;
  addContextContainer: () => void;
  updateContextContainer: (index: number, updates: Partial<ContextContainerProps>) => void;
  deleteContextContainer: (index: number) => void;
  toggleAgentVisibility: (agentName: string, index: number, allAgentNames: string[], soloInstead?: boolean) => void;
  shiftContextContainer: (index: number, direction: "up" | "down") => void;
  clearContextText: (index: number) => void;
}

export const useAnalysisStore = create<AnalysisState>()((set, get): AnalysisState => ({
  // Initial state
  localState: {} as AISessionState,
  setLocalState: (state: AISessionState) => set({ localState: state }),

  // Agent orchestration state
  agentOrder: "sequential",
  rounds: 1,
  maxRounds: 10,
  orchestrationMode: OrchestrationType2.DIRECT_AGENT_INTERACTION,
  customAgentSet: [],
  setAgentOrder: (order) => {
    set({ agentOrder: order });
    setTimeout(() => get().saveState(), 1000);
  },
  setRounds: (rounds) => {
    set({ rounds });
    setTimeout(() => get().saveState(), 1000);
  },
  setMaxRounds: (maxRounds) => {
    set({ maxRounds });
    setTimeout(() => get().saveState(), 1000);
  },
  setOrchestrationMode: (mode) => {
    const state = get();
    const updatedAgents = updateAgentDisabledStates(
      state.localState.currentAgents.agents,
      mode,
      state.customAgentSet
    );
    
    set({ 
      orchestrationMode: mode,
      localState: {
        ...state.localState,
        currentAgents: {
          ...state.localState.currentAgents,
          agents: updatedAgents
        }
      }
    });
    
    setTimeout(() => get().saveState(), 1000);
  },
  setCustomAgentSet: (agents) => {
    const state = get();
    const updatedAgents = updateAgentDisabledStates(
      state.localState.currentAgents.agents,
      state.orchestrationMode,
      agents
    );
    
    set({ 
      customAgentSet: agents,
      localState: {
        ...state.localState,
        currentAgents: {
          ...state.localState.currentAgents,
          agents: updatedAgents
        }
      }
    });
    
    setTimeout(() => get().saveState(), 1000);
  },

  handleTeamAutoGen: async (props: AutoGenWorkflowProps) => {
    console.log("!!!HANDLE_TEAM_AUTOGEN!!!", props);
    const result = await TEAM_autogen_create_workflow(props, get().localState.userId);
    
    // If we have results and they've been approved, update the store with the new team and context
    if (result.outlineApproved && result.resultTeam) {
      console.log("UPDATING STORE WITH TEAM:", {
        teamName: result.resultTeam.name,
        agents: result.resultTeam.agents.map(a => a.name),
        orchestrationType: result.resultTeam.orchestrationType,
        contextSets: result.resultContext || []
      });
      
      set({ 
        localState: {
          ...get().localState,
          currentAgents: result.resultTeam as Team,
          contextSet: {
            teamName: result.resultTeam.name,
            sets: result.resultContext || []
          }
        },
        // Remove this line
        // contextSet: {
        //   teamName: result.resultTeam.name,
        //   sets: result.resultContext || []
        // },
        // Set orchestration mode from the team
        orchestrationMode: result.resultTeam.orchestrationType || OrchestrationType2.SEQUENTIAL_WORKFLOW,
        // Reset the agent set to include all agents
        customAgentSet: result.resultTeam.agents.map(agent => agent.name)
      });
      
      // Save state to persist changes
      setTimeout(() => {
        console.log("SAVING STATE AFTER TEAM UPDATE");
        get().saveState();
      }, 500);
    }
    
    return result;
  },

  currentConversation: [],
  currentAgentIndex: 0,
  currentContextSetItem: 0,

  contextSetStore: [],

  converationsForDay: [],
  conversationHistory: [],
  llmMode: "agent",
  isInitialized: false,
  isLoading: false,
  agentActive: false,
  stateLoaded: false,
  savedAgentStates: {
    agents: [],
    teams: [],
  },
  agentGlobalChatInput: "",
  agentGlobalChatInputChanged: (input: string) => {
    set({ agentGlobalChatInput: input });
  },
  changeIndex: 0,
  lineSetStates: [],
  frozenStates: [],
  changeMessageHistory: async (dayName: string) => {
    console.log("changeMessageHistory", dayName);
    const _daysConvos: { id: number; dayName: string }[] =
      await CONVERSATION_loadByDay({
        dayName,
        userId: get().localState.userId,
      });
    const _currentConvo = JSON.parse(
      (await CONVERSATION_getById({
        id: _daysConvos[_daysConvos.length - 1].id,
      })) || "{}"
    );
    
    // Get current orchestration settings before updating state
    const state = get();
    
    set({
      converationsForDay: _daysConvos,
      currentConversation: _currentConvo,
      // Preserve orchestration settings
      agentOrder: state.agentOrder,
      rounds: state.rounds,
      maxRounds: state.maxRounds,
      orchestrationMode: state.orchestrationMode,
      customAgentSet: state.customAgentSet
    });
  },

  // Actions
  initialize: async (userId: string) => await initialize(userId, set, get),
  saveState: async () => await saveState(get, set),
  megaLoadStateFromBrowserOrServer: async () => {
    await megaLoadStateFromBrowserOrServer(get, set);
    
    // REMOVED: No longer need to check localStorage since orchestration settings 
    // are now properly saved directly in IndexedDB within the AISessionState
  },
  updateLocalState: (newState) => {
    set((state) => {
      // Start with a shallow merge
      let finalLocalState = { ...state.localState, ...newState };

      // Special handling for contextSet updates to preserve client-side disabled sets
      if (newState.contextSet && state.localState.contextSet) {
        const incomingSets = newState.contextSet.sets ?? [];
        const currentClientSets = state.localState.contextSet.sets ?? [];

        // Create a map of incoming sets for efficient lookup, keyed by setName
        const incomingSetsMap = new Map(incomingSets.map(set => [set.setName, set]));
        
        // Create a set of setNames from the incoming update to efficiently check existence
        const incomingSetNames = new Set(incomingSets.map(set => set.setName));
        
        // Get the current set names to detect intentional deletions
        const currentSetNames = new Set(currentClientSets.map(set => set.setName));
        
        // Find set names that were in the previous state but not in the new state
        // These are likely intentionally deleted sets
        const deletedSetNames = new Set(
          [...currentSetNames].filter(name => !incomingSetNames.has(name))
        );
        
        console.log("Context sets - incoming:", incomingSets.length, 
                    "current:", currentClientSets.length, 
                    "detected deletions:", deletedSetNames.size);

        // Only preserve disabled sets that weren't intentionally deleted
        const disabledSetsToPreserve = currentClientSets.filter(
          set => set.isDisabled && 
                !incomingSetsMap.has(set.setName) && 
                !deletedSetNames.has(set.setName)
        );
        
        if (disabledSetsToPreserve.length > 0) {
          console.log("Preserving disabled sets:", disabledSetsToPreserve.map(s => s.setName));
        }

        // Combine the incoming sets with the disabled sets that need preserving
        const finalMergedSets = [...incomingSets, ...disabledSetsToPreserve];

        // Update the contextSet within the final state object
        finalLocalState = {
          ...finalLocalState,
          contextSet: {
            // Keep other properties like teamName from the incoming update
            ...(newState.contextSet || {}),
            sets: finalMergedSets // Use the merged set list
          }
        };
      } else if (newState.contextSet) {
         // If there was no previous contextSet, just use the incoming one directly
         finalLocalState = {
           ...finalLocalState,
           contextSet: newState.contextSet
         };
      }

      // Return the final state update object for Zustand
      return { localState: finalLocalState };
    });
    // Consider if saveState needs to be called conditionally based on what changed
    // get().saveState(); 
  },
  updateMessages: (messages: ServerMessage[]) =>
    updateMessages(messages, get, set),

  setCurrentAgentIndex: (index: number) => setCurrentAgentIndex(index, set),
  loadTeam: async (teamId: number) => await loadTeam(teamId, get, set),
  loadAgent: async (agentId: number) => await loadAgent(agentId, get, set),
  deleteTeam: async (teamId: number) => await deleteTeam(teamId, get, set),
  saveAgentState: async () => await saveAgentState(get, set),

  handlePromptTextToSet: (text: string) =>
    handlePromptTextToSet(text, get, set),
  handleDeleteTextFromSet: (text: string) => deleteTextFromSet(text, get, set),
  deleteTextFromSet: (text: string) => deleteTextFromSet(text, get, set),
  setCurrentContextItem: (index: number) => setCurrentContextItem(index, set),
  setLineSetState: (states: GeneralPurpose[]) => setLineSetState(states, set),
  setContextSetStore: (store: { id: number; teamName: string }[]) =>
    setContextSetStore(get().localState.userId, set),
  handleLoadContextSet: async (id: number) =>
    await handleLoadContextSet(id, get, set),
  setCurrentContextSetItem: (index: number) =>
    set({ currentContextSetItem: index }),
  handleSaveContextSet: async (contextSet: ContextSet, name: string) =>
    await handleSaveContextSet(
      contextSet,
      name,
      get().localState.userId,
      get,
      set
    ),

  handleAgentChatSubmit: async (e: any) =>
    await handleAgentChatSubmit(e, get, set),
  handleOrchestratedChatSubmit: async (
    orchType: OrchestrationType2,
    numRounds: number, 
    maxRounds: number = 10,
    order: "sequential" | "seq-reverse" | "random" = "sequential",
    customAgentSet: string[] = []
  ) => {
    const _allAgents = get().localState.currentAgents.agents;
    const _customAgentSet = customAgentSet.length > 0 ? customAgentSet : get().customAgentSet;
    // make sure all names in cusomset are actually available in all agents
    const _validCustomAgentSet = _customAgentSet.filter((agentName) => _allAgents.some((agent) => agent.name === agentName));
    //await get().saveState();
    await handleOrchestratedChatSubmit(
      orchType,
      numRounds,
      maxRounds,
      order,
      get,
      set,
      _validCustomAgentSet
    );
  },
  handleClearMessages: () => handleClearMessages(get, set),

  syncWithGlobalMessages: (globalMessages: GlobalMessages) =>
    syncWithGlobalMessages(globalMessages, get, set),

  saveGlobalState: async () => await saveGlobalState(get),
  loadFrozenGlobalState: async (id: number) => {
    await loadFrozenGlobalState(id, set);
    
    // REMOVED: No longer need this explicit orchestration state override
    // since orchestration settings are now properly included in the loaded state
  },
  deleteFrozenGlobalState: async (id: number) =>
    await deleteFrozenGlobalState(id, get),
  loadAllFrozenStateNames: async (userId?: string) =>
    await loadAllFrozenStateNames(get, set, userId),

  handleChangeIndex: () =>
    set((state) => ({ changeIndex: state.changeIndex + 1 })),

  refreshAgentStates: async () => {
    const _savedAgentStates = await SERVER_getAgentsAndTeams(
      get().localState.userId
    );
    set({ savedAgentStates: _savedAgentStates });
  },

  loadEssentialData: async (userId: string) => {
    // Load Saved Agent States
    try {
      const savedAgentStates = await SERVER_getAgentsAndTeams(userId);
      
      // Get current orchestration settings before updating state
      const state = get();
      
      // Load conversation history && conversation history names
      console.log("!!!LOAD_ESSENTIAL_DATA!!!", userId);
      const converationsForDay = await CONVERSATION_loadLatestDayConversations({
        userId,
      });
      const conversationHistory =
        await CONVERSATION_getAllConversationDaysForUser({ userId });
      
      let _currentConvo = [];
      if (converationsForDay && converationsForDay.length > 0) {
        try {
          _currentConvo = JSON.parse(
            (await CONVERSATION_getById({
              id: converationsForDay[converationsForDay.length - 1].id,
            })) || "[]"
          );
        } catch (error) {
          console.error("Error parsing conversation:", error);
          _currentConvo = [];
        }
      }
      
      set({
        savedAgentStates,
        converationsForDay,
        conversationHistory,
        currentConversation: _currentConvo,
        // Preserve orchestration settings
        agentOrder: state.agentOrder,
        rounds: state.rounds,
        maxRounds: state.maxRounds,
        orchestrationMode: state.orchestrationMode,
        customAgentSet: state.customAgentSet
      });
    } catch (error) {
      console.error("Error loading essential data:", error);
      toast({
        title: "Error loading essential data",
        description: "Please try again later",
        variant: "destructive",
      });
    }
  },

  setAgentActive: (active: boolean) => {
    console.log("Setting agentActive:", active);
    set({ agentActive: active });
  },

  setMessageHistory: async (dayName: string) => {
    console.log("!!!SET_MESSAGE_HISTORY!!!", dayName);
    const _conversationHistory = await CONVERSATION_loadByDay({
      dayName,
      userId: get().localState.userId,
    });
    
    // Get current orchestration settings before updating state
    const state = get();
    
    set({
      converationsForDay: _conversationHistory,
      // Preserve orchestration settings
      agentOrder: state.agentOrder,
      rounds: state.rounds,
      maxRounds: state.maxRounds,
      orchestrationMode: state.orchestrationMode,
      customAgentSet: state.customAgentSet
    });
  },

  handleDeleteContextSet: async (id: number) => 
    await handleDeleteContextSet(id, get, set),
  handleDeleteMultipleContextSets: async (ids: number[]) => 
    await handleDeleteMultipleContextSets(ids, get, set),

  // Context operations
  updateContextSet: (updates: Partial<ContextSet>) => {
    set(state => {
      if (!state.localState.contextSet) return state;
      
      // Check if sets are actually changing before updating
      if (updates.sets) {
        // If the sets being updated are identical to current sets, don't trigger update
        if (state.localState.contextSet.sets && 
            JSON.stringify(state.localState.contextSet.sets) === JSON.stringify(updates.sets)) {
          // If there are other properties besides sets, update only those
          const { sets, ...otherUpdates } = updates;
          if (Object.keys(otherUpdates).length === 0) {
            return state; // No changes at all
          }
          
          // Update only non-sets properties
          return {
            ...state,
            localState: {
              ...state.localState,
              contextSet: {
                ...state.localState.contextSet,
                ...otherUpdates
              }
            }
          };
        }
      }
      
      // Normal update with changes
      return {
        ...state,
        localState: {
          ...state.localState,
          contextSet: {
            ...state.localState.contextSet,
            ...updates
          }
        }
      };
    });
  },

  addContextContainer: () => {
    set(state => {
      if (!state.localState.contextSet) return state;
      
      const newSet: ContextContainerProps = {
        setName: `Set ${(state.localState.contextSet.sets?.length ?? 0) + 1}`,
        lines: [],
        text: "",
        isDisabled: false,
        hiddenFromAgents: []
      };
      
      // Get updated sets arrays
      const updatedLocalStateSets = [...(state.localState.contextSet.sets || []), newSet];
      
      return {
        ...state,
        // Always update nested contextSet
        localState: {
          ...state.localState,
          contextSet: {
            ...state.localState.contextSet,
            sets: updatedLocalStateSets
          }
        }
      };
    });
  },

  updateContextContainer: (index: number, updates: Partial<ContextContainerProps>) => {
    set(state => {
      if (!state.localState.contextSet?.sets || index < 0 || index >= state.localState.contextSet.sets.length) {
        return state;
      }
      
      // Add identity check to prevent unnecessary updates
      const currentSet = state.localState.contextSet.sets[index];
      const updatedSet = { ...currentSet, ...updates };
      
      // Check if any actual changes happened
      let hasChanges = false;
      for (const key in updates) {
        if (JSON.stringify(currentSet[key as keyof ContextContainerProps]) !== 
            JSON.stringify(updates[key as keyof ContextContainerProps])) {
          hasChanges = true;
          break;
        }
      }
      
      // If nothing changed, return same state to prevent rerender
      if (!hasChanges) {
        return state;
      }
      
      const updatedSets = [...state.localState.contextSet.sets];
      updatedSets[index] = updatedSet;
      
      return {
        ...state,
        localState: {
          ...state.localState,
          contextSet: {
            ...state.localState.contextSet,
            sets: updatedSets
          }
        }
      };
    });
  },

  deleteContextContainer: (index: number) => {
    console.log("Store deleteContextContainer called with index:", index);
    set(state => {
      // Exit if no contextSet in localState
      if (!state.localState.contextSet?.sets) {
        console.error("No contextSet or sets found in state");
        return state;
      }
      
      // Create new arrays without the item at the specified index
      const updatedLocalStateSets = state.localState.contextSet.sets.filter((_, i) => i !== index);
      
      console.log(`Updating both context sets:
        - localState.contextSet.sets: ${state.localState.contextSet.sets.length} -> ${updatedLocalStateSets.length}`);
      
      // Return updated state with both context sets updated
      return {
        ...state,
        localState: {
          ...state.localState,
          contextSet: {
            ...state.localState.contextSet,
            sets: updatedLocalStateSets
          }
        }
      };
    });
  },

  toggleAgentVisibility: (agentName: string, index: number, allAgentNames: string[], soloInstead?: boolean) => {
    set(state => {
      if (!state.localState.contextSet?.sets) return state;
      
      const updatedSets = state.localState.contextSet.sets.map((set, i) => {
        if (i !== index) return set;
        
        let hiddenFromAgents = set.hiddenFromAgents || [];
        
        if (soloInstead) {
          // Only show to this agent (hide from all others)
          hiddenFromAgents = allAgentNames.filter(a => a !== agentName);
        } else {
          // Toggle this agent's visibility
          const isHidden = hiddenFromAgents.includes(agentName);
          hiddenFromAgents = isHidden
            ? hiddenFromAgents.filter(a => a !== agentName)
            : [...hiddenFromAgents, agentName];
        }
        
        return { ...set, hiddenFromAgents };
      });
      
      return {
        ...state,
        localState: {
          ...state.localState,
          contextSet: {
            ...state.localState.contextSet,
            sets: updatedSets
          }
        }
      };
    });
  },

  shiftContextContainer: (index: number, direction: "up" | "down") => {
    set(state => {
      if (!state.localState.contextSet?.sets) return state;
      const sets = state.localState.contextSet.sets;
      
      if (direction === "up" && index === 0) return state;
      if (direction === "down" && index === sets.length - 1) return state;
      
      const newSets = [...sets];
      const [movedSet] = newSets.splice(index, 1);
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      newSets.splice(targetIndex, 0, movedSet);
      
      return {
        ...state,
        localState: {
          ...state.localState,
          contextSet: {
            ...state.localState.contextSet,
            sets: newSets
          }
        }
      };
    });
  },

  clearContextText: (index: number) => {
    set(state => {
      if (!state.localState.contextSet?.sets) return state;
      
      const updatedSets = state.localState.contextSet.sets.map((set, i) =>
        i === index ? { ...set, text: "" } : set
      );
      
      return {
        ...state,
        localState: {
          ...state.localState,
          contextSet: {
            ...state.localState.contextSet,
            sets: updatedSets
          }
        }
      };
    });
  },
}));

// If in browser context, expose the store globally for direct access
if (typeof window !== 'undefined') {
  (window as any).__ANALYSIS_STORE__ = useAnalysisStore;
}
