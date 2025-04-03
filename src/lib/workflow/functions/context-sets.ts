import { SERVER_getSavedContextSet, SERVER_getSavedContextSets, SERVER_saveContextSet, SERVER_deleteSavedContextSet, SERVER_deleteMultipleContextSets } from "@/src/lib/server2";
import { ContextContainerProps, ContextSet } from "@/src/lib/types";
// import { ContextSet } from "@prisma/client";

export async function setContextSetStore(userId: string, set: Function) {
    const _store = await SERVER_getSavedContextSets(userId);
    set({ contextSetStore: _store });
  }

export function setCurrentContextItem(index: number, set: Function) {
  set({ currentContextItem: index });
}

export async function handleLoadContextSet(id: number, get: Function, set: Function) {
  const contextSet: ContextSet | null = await SERVER_getSavedContextSet(id);
  if (contextSet) {
    set({ contextSet: contextSet });
  }
}

export async function handleSaveContextSet(contextSet: ContextSet, name: string, userId: string, get: Function, set: Function) {
  await SERVER_saveContextSet(contextSet,userId, name);
  
}

export async function handleDeleteContextSet(id: number, get: Function, set: Function) {
  await SERVER_deleteSavedContextSet(id);
  const userId = get().localState.userId;
  await setContextSetStore(userId, set);
}

export async function handleDeleteMultipleContextSets(ids: number[], get: Function, set: Function) {
  await SERVER_deleteMultipleContextSets(ids);
  const userId = get().localState.userId;
  await setContextSetStore(userId, set);
}






