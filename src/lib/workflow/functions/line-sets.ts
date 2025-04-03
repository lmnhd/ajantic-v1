import { AppFrozenState, ContextContainerProps } from "@/src/lib/types";
import { AnalysisStorage } from "../../storage/analysis-storage";
import { GeneralPurpose } from "@prisma/client";

export function handlePromptTextToSet(text: string, get: Function, set: Function) {
  const state = get();
  const newLineSets = [
    ...state.contextSets,
    {
      text,
      setName: `Set ${state.contextSets.length + 1}`,
      lines: [],
      isDisabled: false,
    },
  ];
  const newState = { ...state, contextSets: newLineSets };
  set(newState);

  // Save to IndexedDB when adding new lineSet
  const frozenState: AppFrozenState = {
    localState: newState.localState,
    currentConversation: newState.currentConversation,
    contextSet: {sets: newLineSets, teamName: state.localState.currentAgents?.name || ""},
    analysisSet: {
      contextSet: {sets: newLineSets, teamName: state.localState.currentAgents?.name || ""},
      analysisName: state.localState.currentAgents?.name || "",
      userId: state.localState.userId,
    },
  };
  AnalysisStorage.FROZEN_STATE_saveToIndexDB(frozenState);
}

export function deleteTextFromSet(text: string, get: Function, set: Function) {
  const state = get();
  const newLineSets = state.contextSets.filter((set: ContextContainerProps) => set.text !== text);
  const newState = { ...state, contextSets: newLineSets };
  set(newState);

  // Save state after lineset change
  AnalysisStorage.FROZEN_STATE_saveToIndexDB({
    localState: newState.localState,
    currentConversation: newState.currentConversation,
    contextSet: {sets: newLineSets, teamName: state.localState.currentAgents?.name || ""},
    analysisSet: {
      contextSet: {sets: newLineSets, teamName: state.localState.currentAgents?.name || ""},
      analysisName: state.localState.currentAgents?.name || "",
      userId: state.localState.userId,
    },
  });
}

// export function setCurrentContextItem(index: number, set: Function) {
//   set({ currentContextItem: index });
// }

export function setLineSetState(states: GeneralPurpose[], set: Function) {
  set({ lineSetStates: states });
} 