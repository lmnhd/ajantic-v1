import {
  AISessionState,
  AppFrozenState,
  ServerMessage,
  ContextSet,
  ContextContainerProps,
} from "@/src/lib/types";
import { AnalysisStorage } from "../../storage/analysis-storage";
import { INDEXEDDB_initDB } from "@/src/lib/indexDB";
import { toast } from "@/components/ui/use-toast";
import { SERVER_getGeneralPurposeDataSingle } from "@/src/lib/server";


export async function initialize(userId: string, set: Function, get: Function) {
  const state = get();
  if (state.isInitialized) {
    console.log("[AnalysisStore] Already initialized, skipping initialization");
    return;
  }

  //   const testWrite = await db.user.update({
  //     where: { id: 1 },
  //     data: {
  //       updatedAt: new Date()
  //     }
  //   });
  //   console.log('Write test result:', testWrite);

  console.log("[AnalysisStore] Starting initialization for userId:", userId);
  set({ isLoading: true });

  try {
    console.log("[AnalysisStore] Initializing IndexDB...");
    await INDEXEDDB_initDB();
    console.log("[AnalysisStore] IndexDB initialized successfully");

    //let dbName = `AgentState-${userId}`;
    console.log("[AnalysisStore] Loading IndexDB state...");
    const indexDBState = await AnalysisStorage.FROZEN_STATE_loadFromIndexDB();
    
    // Flag to track if we successfully loaded from IndexedDB
    const loadedFromIndexDB = !!indexDBState;

    // Load frozen states sync
    get().loadAllFrozenStateNames();

    if (loadedFromIndexDB) {
      console.log("[AnalysisStore] Found IndexDB state, setting initial state");
      
      // Handle contextSet carefully based on what's available in indexDBState
      let contextSetToUse;
      
      if ((indexDBState as any).lineSets) {
        console.log("[AnalysisStore] Found legacy lineSets, converting to contextSet format");
        // Convert old lineSets to new contextSet format
        contextSetToUse = {
          teamName: "Default Team",
          sets: (indexDBState as any).lineSets.map((set: any) => ({
            lines: set.lines || [],
            text: set.text || "",
            isDisabled: set.isDisabled || false,
            setName: set.setName || set.lineSetName || "",
          })),
        };
      } else if ((indexDBState as any).contextSet) {
        console.log("[AnalysisStore] Using existing contextSet");
        contextSetToUse = (indexDBState as any).contextSet;
      } else {
        console.log("[AnalysisStore] No contextSet or lineSets found, using empty context");
        contextSetToUse = {
          teamName: "Default Team",
          sets: []
        };
      }
      
      set({
        localState: { ...indexDBState.localState, userId, genericData: {} },
        currentConversation: indexDBState.currentConversation,
        contextSet: contextSetToUse,
        savedAgentStates: {
          agents: [],
          teams: [],
        },
        isInitialized: true,
        converationsForDay: [],
        conversationHistory: [],
        ...(indexDBState.orchestrationState
          ? {
              agentOrder: indexDBState.orchestrationState.agentOrder,
              rounds: indexDBState.orchestrationState.rounds,
              maxRounds: indexDBState.orchestrationState.maxRounds,
              orchestrationMode: indexDBState.orchestrationState.orchestrationMode,
              customAgentSet: indexDBState.orchestrationState.customAgentSet,
            }
          : {
              agentOrder: "sequential",
              rounds: 1,
              maxRounds: 10,
              orchestrationMode: "agent-orchestrator",
              customAgentSet: [],
            }),
      });
      console.log("[AnalysisStore] Initial state set from IndexDB");
      set({ isLoading: false });

      get().loadEssentialData(userId);

      // Load frozen states sync
      get().loadAllFrozenStateNames(userId);
      //   // Load frozen states in background
      //   get()
      //     .loadAllFrozenStateNames(userId)
      //     .catch((error: unknown) => {
      //       console.error("[AnalysisStore] Background frozen states load failed:", error);
      //     });

      return;
    }

    console.log(
      "[AnalysisStore] No IndexDB state found, loading from server..."
    );
    const timeoutMs = 20000; // 20 second timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error("Timeout loading server state")),
        timeoutMs
      );
    });

    try {
      const serverStatePromise = AnalysisStorage.loadFromServer(userId);
      const serverState = (await Promise.race([
        serverStatePromise,
        timeoutPromise,
      ])) as AppFrozenState;

      if (serverState?.localState) {
        console.log("[AnalysisStore] Server state loaded successfully");
        set({
          localState: serverState.localState,
          // Only use server's currentConversation if we didn't load from IndexDB
          currentConversation: loadedFromIndexDB ? 
            (indexDBState as AppFrozenState).currentConversation : 
            (serverState.currentConversation || []),
          contextSet: serverState.contextSet || {
            teamName: "Default Team",
            sets: [],
          },
          savedAgentStates: {
            agents: [],
            teams: [],
          },
          isInitialized: true,
          converationsForDay: [],
          conversationHistory: [],
        });
        console.log("[AnalysisStore] State initialized from server");

        get().loadEssentialData(userId);

        // Load frozen states in background
        get()
          .loadAllFrozenStateNames(userId)
          .catch((error: unknown) => {
            console.error(
              "[AnalysisStore] Background frozen states load failed:",
              error
            );
          });
      } else {
        console.error("[AnalysisStore] Failed to load state from server");
        throw new Error("Failed to load state from server");
      }
    } catch (serverError) {
      console.error("[AnalysisStore] Error loading from server:", serverError);
      // Initialize with empty state rather than failing completely
      
      // Make sure we have a valid contextSet even in the error case
      let contextSetToUse = {
        teamName: "Default Team",
        sets: []
      };
      
      if (loadedFromIndexDB) {
        if ((indexDBState as any).lineSets) {
          contextSetToUse = {
            teamName: "Default Team",
            sets: (indexDBState as any).lineSets.map((set: any) => ({
              lines: set.lines || [],
              text: set.text || "",
              isDisabled: set.isDisabled || false,
              setName: set.setName || set.lineSetName || "",
            })),
          };
        } else if ((indexDBState as any).contextSet) {
          contextSetToUse = (indexDBState as any).contextSet;
        }
      }
      
      set({
        localState: { userId } as AISessionState,
        // If we loaded from IndexDB (but then had server error), use that conversation 
        currentConversation: loadedFromIndexDB ? 
          (indexDBState as AppFrozenState).currentConversation : 
          [],
        contextSet: contextSetToUse,
        savedAgentStates: {
          agents: [],
          teams: [],
        },
        isInitialized: true,
        converationsForDay: [],
        conversationHistory: [],
      });
      console.log(
        "[AnalysisStore] Initialized with empty state due to server error"
      );
    }
  } catch (error) {
    console.error("[AnalysisStore] Critical initialization error:", error);
    set({ isLoading: false });
    throw error;
  }

  set({ isLoading: false });
  console.log("[AnalysisStore] Initialization complete");
}

export async function saveState(get: Function, set: Function) {
  const state = get();
  //set({ isLoading: true });
  try {
    const frozenState: AppFrozenState = {
      localState: state.localState,
      currentConversation: state.currentConversation,
      contextSet: state.contextSet,
      analysisSet: {
        contextSet: state.contextSet,
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
    await AnalysisStorage.FROZEN_STATE_saveToIndexDB(frozenState);
  } finally {
    //set({ isLoading: false });
  }
}

export async function megaLoadStateFromBrowserOrServer(
  get: Function,
  set: Function
) {
  const state = get();
  //set({ isLoading: true });
  try {
    const indexDBState = await AnalysisStorage.FROZEN_STATE_loadFromIndexDB();
    if (indexDBState) {
      set({
        localState: indexDBState.localState,
        currentConversation: indexDBState.currentConversation,
        contextSet: indexDBState.contextSet,
        isInitialized: true,
        // Load orchestration state with defaults if not present
        ...(indexDBState.orchestrationState
          ? {
              agentOrder: indexDBState.orchestrationState.agentOrder,
              rounds: indexDBState.orchestrationState.rounds,
              maxRounds: indexDBState.orchestrationState.maxRounds,
              orchestrationMode:
                indexDBState.orchestrationState.orchestrationMode,
              customAgentSet: indexDBState.orchestrationState.customAgentSet,
            }
          : {
              agentOrder: "sequential",
              rounds: 1,
              maxRounds: 10,
              orchestrationMode: "agent-orchestrator",
              customAgentSet: [],
            }),
      });
    } else {
      const serverState = await AnalysisStorage.loadFromServer(
        state.localState.userId
      );
      set({
        localState: serverState?.localState || ({} as AISessionState),
        currentConversation: serverState?.currentConversation || [],
        contextSet: serverState?.contextSet || {
          teamName: "Default Team",
          sets: [],
        },
        isInitialized: true,
        // Set default orchestration state for new or server states
        agentOrder: "sequential",
        rounds: 1,
        maxRounds: 10,
        orchestrationMode: "agent-orchestrator",
        customAgentSet: [],
      });
    }
  } finally {
    //set({ isLoading: false });
  }
}

export async function updateLocalState(
  newState: Partial<AISessionState>,
  get: Function,
  set: Function
) {
  const state = get();
  const updatedState = {
    localState: { ...state.localState, ...newState },
  };

  // Update both localState and contextSets in the store
  set({
    ...updatedState,
    contextSet: newState.contextSet || state.contextSet,
  });

  await saveState(get, set);
  get().handleChangeIndex();
}
