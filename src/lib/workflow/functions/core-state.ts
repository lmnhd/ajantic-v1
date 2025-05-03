import {
  AISessionState,
  AppFrozenState,
  ServerMessage,
  ContextSet,
  ContextContainerProps,
} from "@/src/lib/types";
import { OrchestrationType2 } from "@/src/lib/orchestration/types/base";
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
    
    // Explicitly remove contextSets if it exists on the loaded object
    if (indexDBState && (indexDBState as any).contextSets) {
      console.warn("[AnalysisStore] Found and removing deprecated 'contextSets' property from loaded IndexDB state.");
      delete (indexDBState as any).contextSets;
    }

    // Flag to track if we successfully loaded from IndexedDB
    const loadedFromIndexDB = !!indexDBState;

    // Load frozen states sync
    get().loadAllFrozenStateNames();

    if (loadedFromIndexDB) {
      console.log("[AnalysisStore] Found IndexDB state, setting initial state");
      
      // Handle contextSet carefully based on what's available in indexDBState
      let contextSetToUse;
      
      if ((indexDBState as any).contextSet) {
        console.log("[AnalysisStore] Using existing contextSet from IndexDB");
        contextSetToUse = (indexDBState as any).contextSet;
      } else if ((indexDBState as any).lineSets) {
        console.log("[AnalysisStore] Found legacy lineSets, converting to contextSet format");
        // Convert old lineSets to new contextSet format
        contextSetToUse = {
          teamName: "Default Team",
          sets: (indexDBState as any).lineSets.map((set: any) => ({
            lines: set.lines || [],
            text: set.text || "",
            isDisabled: set.isDisabled || false,
            setName: set.setName || set.lineSetName || `Set_${Date.now()}`,
          })),
        };
      } else {
        console.log("[AnalysisStore] No contextSet or lineSets found, using empty context");
        contextSetToUse = {
          teamName: indexDBState.localState?.currentAgents?.name || "Default Team",
          sets: []
        };
      }
      
      // Extract and sanitize orchestration state
      type OrchSettings = {
        agentOrder?: "sequential" | "seq-reverse" | "random" | "auto" | string | null;
        rounds?: number;
        maxRounds?: number;
        orchestrationMode?: OrchestrationType2;
        customAgentSet?: string[];
      };
      
      const orchestrationState = ((indexDBState as any).orchestrationState || {}) as OrchSettings;
      
      // Handle empty or "auto" agent order
      const safeAgentOrder = (!orchestrationState.agentOrder || 
                             orchestrationState.agentOrder === "" || 
                             orchestrationState.agentOrder === "auto") 
        ? "sequential" 
        : orchestrationState.agentOrder;
      
      // Create orchestration settings object
      const orchestrationSettings = {
        agentOrder: safeAgentOrder as "sequential" | "seq-reverse" | "random",
        rounds: orchestrationState.rounds || 1,
        maxRounds: orchestrationState.maxRounds || 10,
        orchestrationMode: orchestrationState.orchestrationMode || OrchestrationType2.DIRECT_AGENT_INTERACTION,
        customAgentSet: orchestrationState.customAgentSet || [],
      };
      
      // Include orchestration settings in localState, preserving all existing properties
      const updatedLocalState = {
        ...indexDBState.localState,
        userId,
        genericData: indexDBState.localState.genericData || {},
        orchestrationSettings
      };
      
      console.log("[AnalysisStore] Orchestration settings:", orchestrationSettings);
      
      set({
        localState: updatedLocalState,
        currentConversation: indexDBState.currentConversation,
        contextSet: contextSetToUse,
        savedAgentStates: {
          agents: [],
          teams: [],
        },
        isInitialized: true,
        converationsForDay: [],
        conversationHistory: [],
        // Include orchestration settings in the top level for UI components
        ...orchestrationSettings
      });
      
      // Save to localStorage as backup
      try {
        localStorage.setItem('orchestrationSettings', JSON.stringify(orchestrationSettings));
      } catch (error) {
        console.error("Failed to save orchestration settings to localStorage", error);
      }
      
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
      const serverStateResponse = await AnalysisStorage.loadFromServer(
        state.localState.userId
      );
      
      // Extract orchestration state from server with proper typing
      type OrchSettings = {
        agentOrder?: "sequential" | "seq-reverse" | "random" | string | null;
        rounds?: number;
        maxRounds?: number;
        orchestrationMode?: OrchestrationType2 | string;
        customAgentSet?: string[];
      };
      
      const orchestrationState = (serverStateResponse?.orchestrationState || {}) as OrchSettings;
      
      // Simple direct mapping with defaults
      const orchestrationSettings = {
        // Handle empty or "auto" agent order
        agentOrder: (!orchestrationState.agentOrder || 
                     orchestrationState.agentOrder === "" || 
                     orchestrationState.agentOrder === "auto") 
          ? "sequential" 
          : orchestrationState.agentOrder as "sequential" | "seq-reverse" | "random",
          
        // Use values or defaults
        rounds: orchestrationState.rounds || 1,
        maxRounds: orchestrationState.maxRounds || 10,
        orchestrationMode: orchestrationState.orchestrationMode as OrchestrationType2 || 
                          OrchestrationType2.DIRECT_AGENT_INTERACTION,
        customAgentSet: orchestrationState.customAgentSet || [],
      };
      
      // Update localState with server state plus orchestration settings
      const updatedLocalState = {
        ...(serverStateResponse?.localState || {} as AISessionState),
        genericData: (serverStateResponse?.localState?.genericData || {}),
        orchestrationSettings
      };
      
      console.log("[AnalysisStore] Orchestration settings from server:", orchestrationSettings);
      
      set({
        localState: updatedLocalState,
        // Only use server's currentConversation if we didn't load from IndexDB
        currentConversation: loadedFromIndexDB ? 
          (indexDBState as AppFrozenState).currentConversation : 
          (serverStateResponse?.currentConversation || []),
        //contextSet: serverStateResponse?.contextSet || {
        //  teamName: "Default Team",
        //  sets: [],
        //},
        savedAgentStates: {
          agents: [],
          teams: [],
        },
        isInitialized: true,
        converationsForDay: [],
        conversationHistory: [],
        // Include orchestration settings in the top level for UI components
        ...orchestrationSettings
      });
      
      // Save to localStorage as backup
      try {
        localStorage.setItem('orchestrationSettings', JSON.stringify(orchestrationSettings));
      } catch (error) {
        console.error("Failed to save orchestration settings to localStorage", error);
      }
      
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
      
      // Extract orchestration state from IndexDB if available
      type OrchSettings = {
        agentOrder?: "sequential" | "seq-reverse" | "random" | "auto" | string | null;
        rounds?: number;
        maxRounds?: number;
        orchestrationMode?: OrchestrationType2;
        customAgentSet?: string[];
      };
      
      const orchestrationState = (loadedFromIndexDB && (indexDBState as any).orchestrationState) ? 
        (indexDBState as any).orchestrationState as OrchSettings : {} as OrchSettings;
      
      // Handle empty or "auto" agent order
      const safeAgentOrder = (!orchestrationState.agentOrder || 
                              orchestrationState.agentOrder === "" || 
                              orchestrationState.agentOrder === "auto") 
        ? "sequential" 
        : orchestrationState.agentOrder;
      
      // Create orchestration settings object
      const orchestrationSettings = {
        agentOrder: safeAgentOrder as "sequential" | "seq-reverse" | "random",
        rounds: orchestrationState.rounds || 1,
        maxRounds: orchestrationState.maxRounds || 10,
        orchestrationMode: orchestrationState.orchestrationMode || OrchestrationType2.DIRECT_AGENT_INTERACTION,
        customAgentSet: orchestrationState.customAgentSet || [],
      };
      
      // Create localState with embedded orchestration settings
      // Start with a minimal base state
      let updatedLocalState: AISessionState;
      
      if (loadedFromIndexDB) {
        // If we loaded from IndexDB, preserve all existing properties
        updatedLocalState = {
          ...(indexDBState as AppFrozenState).localState,
          userId,
          genericData: (indexDBState as AppFrozenState).localState.genericData || {},
          orchestrationSettings
        };
      } else {
        // Otherwise create a minimal valid state
        updatedLocalState = {
          userId,
          genericData: {},
          orchestrationSettings,
          // Add minimum required properties from AISessionState
          role: "user",
          processType: "line",
          content: "",
          currentFunction: "",
          lastFunction: "",
          currentSong: [],
          currentTryCount: 0,
          curBlockNum: 0,
          curLineNum: 0,
          groupLines: [],
          currentModels: [],
          currentAgents: { name: "", objectives: "", agents: [] },
          contextSet: { teamName: "Default Team", sets: [] },
          resultData: { options: [], data: {} },
          previousData: { options: [], data: {} },
          rules: [],
          numOptions: 1,
          customRequests: [],
          customRequestModifiers: [],
          useCustomRequests: false,
          songId: 0,
          songName: "",
          referenceLyricsBlocks: [],
          referenceWordPlayBlocks: [],
          newSeeds: false
        };
      }
      
      set({
        localState: updatedLocalState,
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
        // Preserve orchestration settings from indexDBState if available
        agentOrder: safeAgentOrder as "sequential" | "seq-reverse" | "random",
        rounds: orchestrationState.rounds || 1,
        maxRounds: orchestrationState.maxRounds || 10,
        orchestrationMode: orchestrationState.orchestrationMode || OrchestrationType2.DIRECT_AGENT_INTERACTION,
        customAgentSet: orchestrationState.customAgentSet || [],
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
    // Try to load from IndexDB first
    const indexDBState = await AnalysisStorage.FROZEN_STATE_loadFromIndexDB();
    
    // Prepare default data structure
    type SafeDataSource = {
      localState: AISessionState;
      currentConversation: ServerMessage[];
      //contextSet: { teamName: string; sets: any[] };
      orchestrationState?: {
        agentOrder?: string;
        rounds?: number;
        maxRounds?: number;
        orchestrationMode?: string | OrchestrationType2;
        customAgentSet?: string[];
      };
    };
    
    // Initialize with defaults
    let dataSource: SafeDataSource = {
      localState: { userId: state.localState.userId } as AISessionState,
      currentConversation: [],
      //contextSet: { teamName: "Default Team", sets: [] }
    };
    
    if (indexDBState) {
      // Use IndexDB data if available
      dataSource = indexDBState;
      console.log("Loading state from IndexDB");
    } else {
      // Try loading from server if not in IndexDB
      try {
        const serverStateResponse = await AnalysisStorage.loadFromServer(state.localState.userId);
        // Check if serverStateResponse exists and is not null before assigning
        if (serverStateResponse && typeof serverStateResponse === 'object') {
          dataSource = serverStateResponse as SafeDataSource;
          console.log("Loading state from server");
        } else {
          console.log("No server state found, using fallback");
        }
      } catch (error) {
        console.error("Error loading from server:", error);
        console.log("Using minimal fallback state due to error");
      }
    }
    
    // Extract orchestration settings with fallbacks
    const orchestrationSettings = {
      // Handle invalid agent orders with default
      agentOrder: (() => {
        const order = dataSource.orchestrationState?.agentOrder;
        if (!order || order === "" || order === "auto") {
          return "sequential";
        }
        return order as "sequential" | "seq-reverse" | "random";
      })(),
      
      // Use values or defaults for other properties
      rounds: dataSource.orchestrationState?.rounds || 1,
      maxRounds: dataSource.orchestrationState?.maxRounds || 10,
      orchestrationMode: (dataSource.orchestrationState?.orchestrationMode as OrchestrationType2) || 
                        OrchestrationType2.DIRECT_AGENT_INTERACTION,
      customAgentSet: dataSource.orchestrationState?.customAgentSet || [],
    };
    
    console.log("Using orchestration settings:", orchestrationSettings);
    
    // Create complete local state with orchestration settings
    const updatedLocalState = {
      ...dataSource.localState,
      userId: state.localState.userId, // Ensure userId is set
      genericData: dataSource.localState?.genericData || {},
      orchestrationSettings
    };
    
    // Update state with all values
    set({
      localState: updatedLocalState, 
      currentConversation: dataSource.currentConversation,
      //contextSet: dataSource.contextSet,
      isInitialized: true,
      // Set top-level orchestration properties for UI components
      ...orchestrationSettings
    });
    
    // Save consistent state back to IndexDB if not loaded from there
    if (!indexDBState) {
      const frozenState: AppFrozenState = {
        localState: updatedLocalState,
        currentConversation: dataSource.currentConversation,
        //contextSet: dataSource.contextSet,
        orchestrationState: orchestrationSettings,
        analysisSet: {
          //contextSet: dataSource.contextSet,
          analysisName: updatedLocalState.currentAgents?.name || "",
          userId: updatedLocalState.userId,
        },
      };
      
      await AnalysisStorage.FROZEN_STATE_saveToIndexDB(frozenState);
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

  // Create properly typed orchestration settings type
  type OrchestrationSettings = {
    agentOrder: "sequential" | "seq-reverse" | "random";
    rounds: number;
    maxRounds: number;
    orchestrationMode: OrchestrationType2;
    customAgentSet: string[];
  };

  // Destructure known properties handled separately or to be ignored
  const {
    orchestrationSettings: _, // handled below
    currentAgents: __,        // handled below
    genericData: ___,         // handled below
    // Also capture the intended contextSet if provided
    contextSet: incomingContextSet,
    ...allowedTopLevelUpdates // Capture the rest of the allowed top-level properties
  } = newState;

  // Perform immutable deep merge with properly created new object references
  const updatedLocalState: AISessionState = {
    // Start with a new copy of the full existing state
    ...state.localState,

    // Handle orchestrationSettings immutably
    orchestrationSettings: newState.orchestrationSettings
      ? { // If new state includes orchestrationSettings, create a new object with the merged values
          ...(state.localState.orchestrationSettings || {
            agentOrder: state.agentOrder as "sequential" | "seq-reverse" | "random",
            rounds: state.rounds,
            maxRounds: state.maxRounds,
            orchestrationMode: state.orchestrationMode,
            customAgentSet: state.customAgentSet
          }),
          ...newState.orchestrationSettings
        }
      : state.localState.orchestrationSettings || {
          // If no orchestrationSettings in new state, ensure defaults are maintained
          agentOrder: state.agentOrder as "sequential" | "seq-reverse" | "random",
          rounds: state.rounds,
          maxRounds: state.maxRounds,
          orchestrationMode: state.orchestrationMode,
          customAgentSet: state.customAgentSet
        },

    // Handle currentAgents immutably if included in the update
    currentAgents: newState.currentAgents
      ? {
          ...(state.localState.currentAgents || { name: '', objectives: '', agents: [] }),
          ...newState.currentAgents,
          // If agents array is being updated, ensure it's a new array reference
          agents: newState.currentAgents.agents
            ? [...newState.currentAgents.agents] // Create a new array
            : state.localState.currentAgents?.agents
              ? [...state.localState.currentAgents.agents] // Create a new array copy of existing
              : []
        }
      : state.localState.currentAgents,

    // Handle genericData immutably
    genericData: newState.genericData
      ? { ...(state.localState.genericData || {}), ...newState.genericData }
      : state.localState.genericData || {},

    // Apply only the allowed top-level updates, excluding ignored ones
    ...allowedTopLevelUpdates,

    // Explicitly handle the correct 'contextSet' property
    // Use incomingContextSet if provided, otherwise keep the existing one
    contextSet: incomingContextSet !== undefined ? incomingContextSet : state.localState.contextSet
  };

  console.log("[core-state] Updating local state...", {
    hasOrchestrSettings: !!updatedLocalState.orchestrationSettings,
    orchestrationMode: updatedLocalState.orchestrationSettings?.orchestrationMode,
    sameRef: updatedLocalState === state.localState, // Should be false
    sameOrchestrRef: updatedLocalState.orchestrationSettings === state.localState.orchestrationSettings // Should be false if changed
  });

  // Update localState in the store
  set({
    localState: updatedLocalState,
    // Also update top-level orchestration state for UI components
    agentOrder: updatedLocalState.orchestrationSettings?.agentOrder || state.agentOrder,
    rounds: updatedLocalState.orchestrationSettings?.rounds || state.rounds,
    maxRounds: updatedLocalState.orchestrationSettings?.maxRounds || state.maxRounds,
    orchestrationMode: updatedLocalState.orchestrationSettings?.orchestrationMode || state.orchestrationMode,
    customAgentSet: updatedLocalState.orchestrationSettings?.customAgentSet || state.customAgentSet
  });

  await saveState(get, set);
  get().handleChangeIndex();
}
