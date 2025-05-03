import { ContextContainerProps, GeneralPurpose } from "@/src/lib/types";
import { AnalysisState } from "../../store/analysis-store";
import { AnalysisStorage } from "../../storage/analysis-storage";
import { AppFrozenState } from "@/src/lib/types";

// Handle adding text to a line set
export const handlePromptTextToSet = (text: string, get: () => AnalysisState, set: any) => {
  const newLineSets = [
    ...(get().localState.contextSet?.sets || []),
    {
      setName: `Set ${(get().localState.contextSet?.sets?.length || 0) + 1}`,
      lines: [],
      text,
      isDisabled: false,
    },
  ];

  set((state: any) => {
    return {
      ...state,
      localState: {
        ...state.localState,
        contextSet: {
          ...state.localState.contextSet,
          sets: newLineSets
        }
      }
    };
  });

  // Save to IndexedDB when adding new lineSet
  const frozenState: AppFrozenState = {
    localState: get().localState,
    currentConversation: get().currentConversation,
    contextSet: {sets: newLineSets, teamName: get().localState.currentAgents?.name || ""},
    analysisSet: {
      contextSet: {sets: newLineSets, teamName: get().localState.currentAgents?.name || ""},
      analysisName: get().localState.currentAgents?.name || "",
      userId: get().localState.userId,
    },
  };
  AnalysisStorage.FROZEN_STATE_saveToIndexDB(frozenState);
};

// Handle deleting text from a line set
export const deleteTextFromSet = (text: string, get: () => AnalysisState, set: any) => {
  const newLineSets = (get().localState.contextSet?.sets || []).filter(
    (set: ContextContainerProps) => set.text !== text
  );
  
  set((state: any) => {
    return {
      ...state,
      localState: {
        ...state.localState,
        contextSet: {
          ...state.localState.contextSet,
          sets: newLineSets
        }
      }
    };
  });

  // Save state after lineset change
  AnalysisStorage.FROZEN_STATE_saveToIndexDB({
    localState: get().localState,
    currentConversation: get().currentConversation,
    contextSet: {sets: newLineSets, teamName: get().localState.currentAgents?.name || ""},
    analysisSet: {
      contextSet: {sets: newLineSets, teamName: get().localState.currentAgents?.name || ""},
      analysisName: get().localState.currentAgents?.name || "",
      userId: get().localState.userId,
    },
  });
};

// export function setCurrentContextItem(index: number, set: Function) {
//   set({ currentContextItem: index });
// }

// Handle setting line set state
export const setLineSetState = (states: GeneralPurpose[], set: any) => {
  set({ lineSetStates: states });
}; 