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
  OrchestrationType,
} from "@/src/lib/types";
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
import { AutoGenWorkflowProps, TEAM_autogen_create_workflow } from "@/src/lib/autogen/autogen";

export interface AnalysisState {
  // Core state
  localState: AISessionState;
  setLocalState: (state: AISessionState) => void;

  // Agent orchestration state
  agentOrder: "sequential" | "seq-reverse" | "random" | "auto";
  rounds: number;
  maxRounds: number;
  orchestrationMode: OrchestrationType;
  customAgentSet: string[];
  setAgentOrder: (order: "sequential" | "seq-reverse" | "random" | "auto") => void;
  setRounds: (rounds: number) => void;
  setMaxRounds: (maxRounds: number) => void;
  setOrchestrationMode: (mode: OrchestrationType) => void;
  setCustomAgentSet: (agents: string[]) => void;

  contextSet: ContextSet;
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
    chatMode: OrchestrationType,
    numRounds: number,
    maxRounds: number,
    order: "sequential" | "seq-reverse" | "random" | "auto",
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
}

export const useAnalysisStore = create<AnalysisState>()((set, get): AnalysisState => ({
  // Initial state
  localState: {} as AISessionState,
  setLocalState: (state: AISessionState) => set({ localState: state }),

  // Agent orchestration state
  agentOrder: "sequential",
  rounds: 1,
  maxRounds: 10,
  orchestrationMode: "agent-orchestrator",
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
    set({ orchestrationMode: mode });
    setTimeout(() => get().saveState(), 1000);
  },
  setCustomAgentSet: (agents) => {
    set({ customAgentSet: agents });
    setTimeout(() => get().saveState(), 1000);
  },

  handleTeamAutoGen: async (props: AutoGenWorkflowProps) => {
    console.log("!!!HANDLE_TEAM_AUTOGEN!!!", props);
    return await TEAM_autogen_create_workflow(props, get().localState.userId)
    //return props;
  },

  currentConversation: [],
  contextSet: { sets: [] as ContextContainerProps[], teamName: "Default Team" },
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
    set({
      converationsForDay: _daysConvos,
      currentConversation: _currentConvo,
    });
  },

  // Actions
  initialize: async (userId: string) => await initialize(userId, set, get),
  saveState: async () => await saveState(get, set),
  megaLoadStateFromBrowserOrServer: async () => {
    await megaLoadStateFromBrowserOrServer(get, set);
    
    // After loading other state data, also check for orchestration settings
    const savedOrchestrationSettings = localStorage.getItem('orchestrationSettings');
    if (savedOrchestrationSettings) {
      try {
        const parsedSettings = JSON.parse(savedOrchestrationSettings);
        set({
          orchestrationMode: parsedSettings.orchestrationMode || "agent-orchestrator",
          agentOrder: parsedSettings.agentOrder || "sequential",
          rounds: parsedSettings.rounds || 1,
          maxRounds: parsedSettings.maxRounds || 10,
          customAgentSet: parsedSettings.customAgentSet || []
        });
      } catch (error) {
        console.error("Failed to parse saved orchestration settings", error);
      }
    }
  },
  updateLocalState: (state: Partial<AISessionState>) =>
    updateLocalState(state, get, set),
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
    chatMode: OrchestrationType,
    numRounds: number, // 0 means unlimited rounds up to maxRounds - will stop when a natural conclusion is reached
    maxRounds: number = 10, // Only has effect if numRounds is 0
    order: "sequential" | "seq-reverse" | "random" | "auto" = "sequential",
    customAgentSet: string[] = []
  ) => {
    const _allAgents = get().localState.currentAgents.agents;
    const _customAgentSet = get().customAgentSet;
    // make sure all names in cusomset are actually available in all agents
    const _validCustomAgentSet = _customAgentSet.filter((agentName) => _allAgents.some((agent) => agent.name === agentName));
    //await get().saveState();
    await handleOrchestratedChatSubmit(
      chatMode,
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
    
    // After the main state is loaded, we need to explicitly set orchestration state properties
    const frozenStateFromDB = await APP_FROZEN_getById(id);
    
    if (frozenStateFromDB && frozenStateFromDB.orchestrationState) {
      try {
        const orchestrationState = JSON.parse(frozenStateFromDB.orchestrationState);
        console.log("Explicitly setting orchestration state:", orchestrationState);
        
        // Explicitly set each orchestration property
        set({
          agentOrder: orchestrationState.agentOrder || "sequential",
          rounds: orchestrationState.rounds || 0,
          maxRounds: orchestrationState.maxRounds || 10,
          orchestrationMode: orchestrationState.orchestrationMode || "agent-orchestrator",
          customAgentSet: orchestrationState.customAgentSet || []
        });
      } catch (error) {
        console.error("Error setting orchestration state properties:", error);
      }
    }
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
      set({ savedAgentStates });

      // Load conversation history && conversation history names
      console.log("!!!LOAD_ESSENTIAL_DATA!!!", userId);
      const converationsForDay = await CONVERSATION_loadLatestDayConversations({
        userId,
      });
      const conversationHistory =
        await CONVERSATION_getAllConversationDaysForUser({ userId });
      const _currentConvo = JSON.parse(
        (await CONVERSATION_getById({
          id: converationsForDay[converationsForDay.length - 1].id,
        })) || "{}"
      );
      set({
        converationsForDay,
        conversationHistory,
        currentConversation: _currentConvo,
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
    set({ converationsForDay: _conversationHistory });
  },

  handleDeleteContextSet: async (id: number) => 
    await handleDeleteContextSet(id, get, set),
  handleDeleteMultipleContextSets: async (ids: number[]) => 
    await handleDeleteMultipleContextSets(ids, get, set),
}));
