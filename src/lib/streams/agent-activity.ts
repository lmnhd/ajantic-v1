'use client';

import { create } from 'zustand';

interface ActivityState {
  messages: string[];
  addMessage: (message: string) => void;
  setMessages: (messages: string[]) => void;
  reset: () => void;
}

export const useActivityStore = create<ActivityState>((set) => ({
  messages: ['Initializing agent activity...'],
  addMessage: (message) => set((state) => ({ 
    messages: [...state.messages, message] 
  })),
  setMessages: (messages) => set({ messages }),
  reset: () => set({ messages: ['Initializing agent activity...'] }),
})); 