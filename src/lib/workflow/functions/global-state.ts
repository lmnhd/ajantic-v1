import {
  AISessionState,
  AppFrozenState,
  ContextContainerProps,
  ContextSet,
  OrchestrationType,
  ServerMessage,
  LineLyricType
} from "@/src/lib/types";
import { OrchestrationType2 } from "@/src/lib/orchestration/types/base";
import { toast } from "@/components/ui/use-toast";
import {
  APP_FROZEN_delete,
  APP_FROZEN_getById,
  APP_FROZEN_getAll,
  APP_FROZEN_store,
} from "@/src/lib/app-frozen";
import { INDEXEDDB_storeGenericData } from "@/src/lib/indexDB";

//import { LOCAL_STATE_GlobalSave, LOCAL_STATE_GlobalDelete, LOCAL_STATE_GetAllGlobalStates } from "../analysis-store";

export async function saveGlobalState(get: Function) {
  const state = get();
  
  // Make sure we have a valid default value by checking if it evaluates to a truthy value
  const defaultName = state.localState.currentAgents?.name || new Date().toLocaleDateString();
  // Log the default value to help debug
  console.log("Default name for prompt:", defaultName);
  
  const name = prompt("Enter a name for this global state", defaultName);
  if (!name) return;

  console.log("Saving global state with contextSets:", state.contextSets);

  // Save to IndexedDB
  const frozenState: AppFrozenState = {
    localState: state.localState,
    currentConversation: state.currentConversation,
    //contextSet: state.contextSet,
    analysisSet: {
      //contextSet: state.contextSet,
      analysisName: state.localState.currentAgents?.name || "",
      userId: state.localState.userId,
    },
    orchestrationState: {
      agentOrder: state.agentOrder,
      rounds: state.rounds,
      maxRounds: state.maxRounds,
      orchestrationMode: state.orchestrationMode,
      customAgentSet: state.customAgentSet,
    },
  };

  await APP_FROZEN_store(name, state.localState.userId, frozenState);

  toast({
    title: "Global State Saved",
    description: "Global state saved successfully",
  });

  // refresh frozen states
  get().loadAllFrozenStateNames(state.localState.userId);
}

type LineSet = {
  lineSetName: string;
  lines: LineLyricType[];
  isDisabled: boolean;
  text: string;
};
export async function loadFrozenGlobalState(
  id: number, 
  set: (state: Partial<AppFrozenState>) => void
) {
  console.log("LOAD_FROZEN_GLOBAL_STATE - id", id);
  const loadedState: {
    name: string;
    id: number;
    userId: string;
    localState: string;
    currentConversation: string;
    serverMessages: string;
    orchestrationState: string;
  } | null = await APP_FROZEN_getById(id);

  if (loadedState) {
    console.log("Loading global state:", loadedState);
    try {
      // Parse the full state object
      const _sessionState: AISessionState = JSON.parse(loadedState.localState);
      console.log("Parsed full state:", _sessionState);

      const _serverMessages: ServerMessage[] = JSON.parse(
        loadedState.serverMessages
      );
      let _orchestrationState: {
        agentOrder: "sequential" | "seq-reverse" | "random";
        rounds: number;
        maxRounds: number;
        orchestrationMode: OrchestrationType2;
        customAgentSet: string[];
      };
      
      try {
        _orchestrationState = JSON.parse(loadedState.orchestrationState) || {
          agentOrder: "sequential",
          rounds: 0,
          maxRounds: 10,
          orchestrationMode: OrchestrationType2.DIRECT_AGENT_INTERACTION,
          customAgentSet: [],
        };
        
        // Sanitize agent order - convert legacy "auto" to "sequential" if found
        if (_orchestrationState.agentOrder === "auto" as any) {
          console.log("Converting legacy 'auto' agent order to 'sequential'");
          _orchestrationState.agentOrder = "sequential";
        }
        
        // Convert legacy OrchestrationType to OrchestrationType2
        if (_orchestrationState.orchestrationMode) {
          const legacyMode = _orchestrationState.orchestrationMode;
          if (legacyMode === OrchestrationType2.DIRECT_AGENT_INTERACTION) {
            _orchestrationState.orchestrationMode = OrchestrationType2.DIRECT_AGENT_INTERACTION;
          } else if (legacyMode === OrchestrationType2.SEQUENTIAL_WORKFLOW) {
            // Map based on agent order
            if (_orchestrationState.agentOrder === "sequential") {
              _orchestrationState.orchestrationMode = OrchestrationType2.SEQUENTIAL_WORKFLOW;
            } else if (_orchestrationState.agentOrder === "seq-reverse") {
              _orchestrationState.orchestrationMode = OrchestrationType2.REVERSE_WORKFLOW;
            } else {
              _orchestrationState.orchestrationMode = OrchestrationType2.RANDOM_WORKFLOW;
            }
          } else if (legacyMode === OrchestrationType2.LLM_ROUTED_WORKFLOW) {
            _orchestrationState.orchestrationMode = OrchestrationType2.LLM_ROUTED_WORKFLOW;
          } else if (legacyMode === OrchestrationType2.MANAGER_DIRECTED_WORKFLOW) {
            _orchestrationState.orchestrationMode = OrchestrationType2.MANAGER_DIRECTED_WORKFLOW;
          } else {
            // Default to SEQUENTIAL_WORKFLOW if unknown
            _orchestrationState.orchestrationMode = OrchestrationType2.SEQUENTIAL_WORKFLOW;
          }
          console.log(`Converted legacy mode '${legacyMode}' to '${_orchestrationState.orchestrationMode}'`);
        }
      } catch (error) {
        console.error("Error parsing orchestration state:", error);
        _orchestrationState = {
          agentOrder: "sequential",
          rounds: 0,
          maxRounds: 10,
          orchestrationMode: OrchestrationType2.DIRECT_AGENT_INTERACTION,
          customAgentSet: [],
        };
      }
      
      console.log("Loaded orchestration state:", _orchestrationState);

      // Extract components, handling both old and new formats

      // check if loadedState has a lineSets property and if so, convert it to contextSets
      let _contextSet: ContextSet = {
        teamName: _sessionState.currentAgents?.name || "",
        sets: [],
      };
      console.log("LOAD_FROZEN_GLOBAL_STATE - _contextSet", _contextSet);
      try {
        console.log("LOAD_FROZEN_GLOBAL_STATE - _sessionState", _sessionState);
        if (_sessionState.contextSet) {
          console.log('_sessionState.contextSet.sets.length', _sessionState.contextSet.sets.length);
          _contextSet = _sessionState.contextSet;
        } else {
          console.log("LOAD_FROZEN_GLOBAL_STATE - no contextSet, using lineSets", _sessionState);
          // _contextSet.sets = _sessionState.contextSet.sets.map((lineSet:any) => {
          //   return {
          //     setName: lineSet.setName,
          //     isDisabled: lineSet.isDisabled || false,
          //     text: lineSet.text || "",
          //     lines: lineSet.lines || [],
          //   } as ContextContainerProps;
          // });
        }
      } catch (error) {
        console.error("Error parsing global state:", error);
        _contextSet.sets = [] as ContextContainerProps[];
      }

      

      console.log("Extracted state components:", {
        _sessionState,
        _serverMessages,
        _contextSet,
        _orchestrationState,
      });

      const _newFrozenState = {
        localState: { ..._sessionState, contextSet: _contextSet },
        currentConversation: _serverMessages,
        contextSet: _contextSet,
        orchestrationState: _orchestrationState,
      } as AppFrozenState;
      
      // Set the entire state at once
      set(_newFrozenState);
      
      // Save to IndexedDB
      const frozenState: AppFrozenState = {
        localState: _sessionState,
        currentConversation: _serverMessages,
        //contextSet: _contextSet,
        analysisSet: {
          //contextSet: _contextSet,
          analysisName: _sessionState.currentAgents?.name || "",
          userId: _sessionState.userId,
        },
        orchestrationState: {
          agentOrder: _orchestrationState?.agentOrder || "sequential",
          rounds: _orchestrationState?.rounds || 0,
          maxRounds: _orchestrationState?.maxRounds || 0,
          orchestrationMode: _orchestrationState?.orchestrationMode || "agent-orchestrator",
          customAgentSet: _orchestrationState?.customAgentSet || [],
        },
      };
      await INDEXEDDB_storeGenericData({
        data: frozenState,
        id: "analysis-state",
      });

      // Update UI with success message
      toast({
        title: "State Loaded",
        description: "Global state loaded successfully",
      });
    } catch (error) {
      console.error("Error parsing global state:", error);
      toast({
        title: "Error Loading State",
        description: "Failed to parse saved state",
      });
    }
  }
}

export async function deleteFrozenGlobalState(id: number, get: Function) {
  const state = get();
  await APP_FROZEN_delete(id);

  toast({
    title: "State Deleted",
    description: "Successfully deleted state",
  });
}

export async function loadAllFrozenStateNames(
  get: Function,
  set: Function,
  userId?: string
) {
  console.log("[AnalysisStore] Starting loadAllFrozenStateNames");
  const state = get();
  const effectiveUserId = userId || state.localState?.userId;

  if (!effectiveUserId) {
    console.log("[AnalysisStore] No userId available, skipping frozen states load");
    set({ frozenStates: [] });
    return;
  }

  console.log("[AnalysisStore] Loading frozen states for user:", effectiveUserId);

  try {
    // Run synchronously in development, async in production
    if (process.env.NODE_ENV === 'development') {
      console.log("CALLING APP_FROZEN_getAll synchronously in development");
      const loadedFrozenStateNames = await APP_FROZEN_getAll(effectiveUserId);
      set({ frozenStates: loadedFrozenStateNames || [] });
    } else {
      // Original non-blocking code for production
      const timeoutMs = 120000;
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Timeout loading frozen states")), timeoutMs);
      });
      const loadPromise = await APP_FROZEN_getAll(effectiveUserId);
      const loadedFrozenStateNames = (await Promise.race([loadPromise, timeoutPromise])) as
        | { name: string; id: number }[]
        | undefined;
      set({ frozenStates: loadedFrozenStateNames || [] });
    }

    console.log("[AnalysisStore] Frozen states set in store:", get().frozenStates);
  } catch (error) {
    console.error("[AnalysisStore] Failed to load frozen states:", error);
    set({ frozenStates: [] });
  }
}
