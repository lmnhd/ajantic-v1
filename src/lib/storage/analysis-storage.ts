
// lib/storage/analysis-storage.ts
import {
  AppFrozenState,
  AISessionState,
  Team,
  LoadFromServerReturn,
} from "@/src/lib/types";
import {
  INDEXEDDB_retrieveGenericData,
  INDEXEDDB_storeGenericData,
} from "@/src/lib/indexDB";
import {
  SERVER_getGeneralPurposeDataMany,
  SERVER_getGeneralPurposeDataSingle,
  SERVER_storeGeneralPurposeData,
} from "@/src/lib/server";
import { __initAIState } from "@/src/lib/lyric-helpers";
import { GeneralPurpose } from "@prisma/client";
import { DYNAMIC_NAMES } from "../dynamic-names";
import { OAuth2TokenSet } from "../oauth2/core-service";

export const AnalysisStorage = {
  async FROZEN_STATE_saveToIndexDB(state: AppFrozenState) {
    try {
      await INDEXEDDB_storeGenericData({ data: state, id: "analysis-state" });
      return true;
    } catch (error) {
      console.error("Failed to save to IndexDB:", error);
      return false;
    }
  },

  async FROZEN_STATE_loadFromIndexDB(): Promise<AppFrozenState | null> {
    try {
      const data = await INDEXEDDB_retrieveGenericData("analysis-state");
      if (data) {
        return data.data as AppFrozenState;
      }
    } catch (error) {
      console.error("Failed to load from IndexDB:", error);
    }
    return null;
  },

  async INDEX_DB_save(userId:string, nameSpace:string, data:any) {
    try {
      const fullNameSpace = await DYNAMIC_NAMES.namespace_generic(userId, nameSpace);
      await INDEXEDDB_storeGenericData({ data: data, id: fullNameSpace });
      return true;
    } catch (error) {
      console.error("Failed to save to IndexDB:", error);
      return false;
    }
  },

  async INDEX_DB_load(userId:string, nameSpace:string) {
    try {
      const fullNameSpace = await DYNAMIC_NAMES.namespace_generic(userId, nameSpace);
      const data = await INDEXEDDB_retrieveGenericData(fullNameSpace);
      return data?.data;
    } catch (error) {
      console.error("Failed to load from IndexDB:", error);
      return null;
    }
  },

  async loadFromServer(userId: string): Promise<AppFrozenState | null> {
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second

    console.log(
      "[AnalysisStorage] Starting loadFromServer with userId:",
      userId
    );
    //AgentState-user_2f9RkJTtkBd0nQl3aCQw0PLf9x4
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Load last agent state
        const dbName = `AgentState-${userId}`;
        console.log(
          "[AnalysisStorage] Attempting to load agent state:",
          dbName,
          "Attempt:",
          attempt
        );

        let savedAgentStates;
        try {
          savedAgentStates = await SERVER_getGeneralPurposeDataSingle(
            dbName,
            "all"
          );
          console.log(
            "[AnalysisStorage] Agent state loaded:",
            savedAgentStates ? "success" : "null"
          );
        } catch (error) {
          console.error("[AnalysisStorage] Failed to load agent state:", error);
          throw new Error(
            `Database error loading agent state: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }

        let team: Team | null = null;

        if (savedAgentStates?.content) {
          console.log(
            "[AnalysisStorage] Parsing agent data, content length:",
            savedAgentStates.content.length
          );
          try {
            const agentData = JSON.parse(savedAgentStates.content);
            console.log("[AnalysisStorage] Agent data parsed successfully");

            team =
              agentData.agents && !agentData.agents.name
                ? {
                    name: `${agentData.agents[0].name}s Team`,
                    objectives: "",
                    agents: agentData.agents,
                  }
                : agentData.agents;
            console.log(
              "[AnalysisStorage] Team structure created:",
              team?.name
            );
          } catch (parseError) {
            console.error(
              "[AnalysisStorage] Failed to parse agent data:",
              parseError
            );
            team = null;
          }
        }

        console.log("[AnalysisStorage] Loading saved agent states...");
        let savedStates;
        try {
          savedStates = await SERVER_getGeneralPurposeDataMany(dbName);
          console.log(
            "[AnalysisStorage] Saved states loaded, count:",
            savedStates.length
          );
        } catch (statesError) {
          console.error(
            "[AnalysisStorage] Failed to load saved states:",
            statesError
          );
          savedStates = [];
        }

        console.log("[AnalysisStorage] Creating base state...");
        const baseState = __initAIState().currentState;
        console.log("[AnalysisStorage] Base state created successfully");

        console.log("[AnalysisStorage] Constructing return state...");
        const returnState: LoadFromServerReturn = {
          localState: {
            ...baseState,
            userId,
            currentAgents: team || baseState.currentAgents,
            genericData: {
              ...baseState.genericData,
            },
          },
          currentConversation: [],
          contextSet: {sets: [], teamName: baseState.currentAgents?.name || ""},
          conversationDays: [],
          latestConversations: [],
        };

        // Load conversations

        console.log("[AnalysisStorage] Return state constructed successfully");
        return returnState;
      } catch (error) {
        console.error(
          `[AnalysisStorage] Critical error in loadFromServer (attempt ${attempt}/${maxRetries}):`,
          error
        );

        if (attempt === maxRetries) {
          console.log(
            "[AnalysisStorage] Max retries reached, returning fallback state"
          );
          return {
            localState: {
              ...__initAIState().currentState,
              userId,
              currentAgents: {
                name: "Default Team",
                objectives: "",
                agents: [],
              },
              genericData: {
                savedAgentStates: [],
              },
            },
            currentConversation: [],
            contextSet: {sets: [], teamName: "Default Team"},
          };
        }

        await new Promise((resolve) =>
          setTimeout(resolve, retryDelay * attempt)
        );
      }
    }

    return null;
  },

  async loadSavedAgentStates(userId: string): Promise<GeneralPurpose[]> {
    const dbName = `AgentState-${userId}`;
    let savedAgentStates;
    try {
      savedAgentStates = await SERVER_getGeneralPurposeDataMany(dbName);
      console.log(
        "[AnalysisStorage] Agent state loaded:",
        savedAgentStates ? "success" : "null"
      );
    } catch (error) {
      console.error("[AnalysisStorage] Failed to load agent state:", error);
      //throw new Error(`Database error loading agent state: ${error instanceof Error ? error.message : String(error)}`);
    }
    return savedAgentStates || [];
  },

  async storeOAuthData(platform: string, userId: string, tokens: OAuth2TokenSet) {
    const namespace = await DYNAMIC_NAMES.namespace_generic(userId, `${platform}Auth`);
    await SERVER_storeGeneralPurposeData(JSON.stringify(tokens), userId, platform, "", namespace, false);
  },

  async loadOAuthData(platform: string, userId: string): Promise<OAuth2TokenSet | null> {
    const namespace = await DYNAMIC_NAMES.namespace_generic(userId, `${platform}Auth`);
    const data = await SERVER_getGeneralPurposeDataSingle(namespace, "all");
    return data ? JSON.parse(data.content) : null;
  },
};

