import { create } from "zustand";
import { AppState, GlobalMessages, AppFrozenState } from "../types";

export type GlobalStoreState = {
 globalMessages: GlobalMessages;
 appState: AppState;
 appFrozenState: AppFrozenState;
 setGlobalMessages: (messages: GlobalMessages) => void;
setAppState: (state: AppState) => void;
setAppFrozenState: (appFrozenState: AppFrozenState) => void;
};

export const useGlobalStore = create<GlobalStoreState>((set) => ({
  globalMessages: {} as GlobalMessages,
  appState: {} as AppState,
  appFrozenState: {} as AppFrozenState,
  setGlobalMessages: (messages) => set({ globalMessages: messages }),
  setAppState: (state) => set({ appState: state }),
  setAppFrozenState: (appFrozenState) => set({ appFrozenState: appFrozenState }),
  
}));