"use client"
import { createContext, useContext, ReactNode, useState } from "react";
import { ServerMessage, LineSet } from "./types";
import * as serverActions from './server-actions';

export type ClientMessage = {
  id: string;
  role: "user" | "assistant";
  display: ReactNode;
};

export type AIState = ServerMessage[];
export type UIState = ClientMessage[];

type AIContextType = {
  state: ServerMessage[];
  setState: (state: ServerMessage[]) => void;
  actions: typeof serverActions;
};

const AIContext = createContext<AIContextType | undefined>(undefined);

export function AIProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ServerMessage[]>([]);

  const value = {
    state,
    setState,
    actions: serverActions,
  };

  return <AIContext.Provider value={value}>{children}</AIContext.Provider>;
}

export function useAI() {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error("useAI must be used within an AIProvider");
  }
  return context;
}
