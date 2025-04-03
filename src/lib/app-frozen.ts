"use server";

import { db } from "./db";
import { AppFrozenState } from "./types";

export async function APP_FROZEN_store(name: string, userId: string, appFreeze: AppFrozenState) {
  try {
    await db.appFreeze.create({
      data: {
        name: name,
        userId: userId,
        localState: JSON.stringify(appFreeze.localState),
        currentConversation: JSON.stringify(appFreeze.currentConversation.map((message) => ({...message, currentState: ""}))),
        serverMessages: JSON.stringify(appFreeze.currentConversation || []),
        orchestrationState: JSON.stringify(appFreeze.orchestrationState),
      },
    });
    return true;
  } catch (error) {
    console.error("Error storing app freeze:", error);
    return false;
  }
}
  
export async function APP_FROZEN_getById(id: number) {
  try {
    const appFreeze = await db.appFreeze.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        userId: true,
        localState: true,
        currentConversation: true,
        serverMessages: true,
        orchestrationState: true,
      },
    });
    return appFreeze;
  } catch (error) {
    console.error("Error getting app freeze by id:", error);
    return null;
  }
}

export async function APP_FROZEN_getAll(userId: string) {
  try {
    const globalStates = await db.appFreeze.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        id: 'desc',
      },
    });
    return globalStates;
  } catch (error) {
    console.error("Error getting all app freezes:", error);
    return [];
  }
}
  
export async function APP_FROZEN_getByName(name: string, userId: string) {
  try {
    const appFreeze = await db.appFreeze.findFirst({
      where: { name, userId },
      select: {
        id: false,
        name: true,
        userId: true,
        localState: true,
        currentConversation: true,
        serverMessages: true,
        orchestrationState: true,
      },
    });
    return appFreeze;
  } catch (error) {
    console.error("Error getting app freeze by name:", error);
    return null;
  }
}
  
export async function APP_FROZEN_delete(id: number) {
  try {
    await db.appFreeze.delete({ where: { id } });
    return true;
  } catch (error) {
    console.error("Error deleting app freeze:", error);
    return false;
  }
}
  
export async function APP_FROZEN_deleteByName(name: string, userId: string) {
  try {
    await db.appFreeze.deleteMany({ where: { name, userId } });
    return true;
  } catch (error) {
    console.error("Error deleting app freeze by name:", error);
    return false;
  }
}