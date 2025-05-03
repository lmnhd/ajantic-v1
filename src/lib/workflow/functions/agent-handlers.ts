import {
  SERVER_deleteTeam,
  SERVER_getAgent,
  SERVER_getTeam,
  SERVER_saveTeam,
} from "@/src/lib/server2";
import { toast } from "@/components/ui/use-toast";
import { SERVER_saveCommonAgentState } from "@/src/lib/server";

export function setCurrentAgentIndex(index: number, set: Function) {
  set({ currentAgentIndex: index });
}

export async function loadTeam(teamId: number, get: Function, set: Function) {
  let mergeOrOverwrite: "merge" | "overwrite" = "overwrite";
  const lineSetOption = window.confirm("Keep current Line Sets?");

  if (!lineSetOption) {
    if (
      window.confirm(
        "Would you like to merge these line sets with the current line sets?"
      )
    ) {
      mergeOrOverwrite = "merge";
    }
    const state = get();
    const team = await SERVER_getTeam(teamId);
    
    // Update the team data in localState
    set({
      localState: {
        ...state.localState,
        currentAgents: team,
        contextSet: {
          teamName: team.name,
          sets: mergeOrOverwrite === "merge"
            ? [...(state.localState.contextSet?.sets || []), ...(team.contextSets || [])]
            : team.contextSets || []
        }
      }
    });
  } else {
    const state = get();
    const team = await SERVER_getTeam(teamId);
    set({
      localState: {
        ...state.localState,
        currentAgents: team,
      },
    });
  }
}

export async function deleteTeam(teamId: number, get: Function, set: Function) {
  if (window.confirm("Are you sure you want to delete this team?")) {
    const state = get();
    const team = await SERVER_deleteTeam(teamId, true);
   
    if (team) {
      toast({
        title: "Team Deleted",
        description: "Team deleted successfully",
      });
      get().refreshAgentStates();
    } else {
      toast({
        title: "Team Deletion Failed",
        description: "Team deletion failed",
      });
    }
  }
}

export async function loadAgent(agentId: number, get: Function, set: Function) {
  const state = get();
  const agent = await SERVER_getAgent(agentId);
  set({
    localState: {
      ...state.localState,
      currentAgents: {
        ...state.localState.currentAgents,
        agents: [...state.localState.currentAgents.agents, agent],
      },
    },
  });
}

export async function saveAgentState(get: Function, set: Function) {
  let _name =
    get().localState.currentAgents.agents[get().currentAgentIndex].name;

  const allOrOne: "all" | "one" = window.prompt(
    "Do you want to save all agents in this team or just this one?",
    "all"
  ) as "all" | "one";

  if (allOrOne === "all") {
    _name =
      window.prompt(
        "Enter a name for this team",
        `${get().localState.currentAgents.name}`
      ) || `${get().localState.currentAgents.name}`;
  } else {
    _name =
      window.prompt("Enter a name for this agent", (_name = `${_name}`)) ||
      `${_name}`;
  }

  if (_name) {
    if (_name.startsWith("COMMON_")) {
      _name = _name.replace("COMMON_", "");
      const res = await SERVER_saveCommonAgentState(
        _name,
        get().localState.currentAgents.agents[get().currentAgentIndex]
      );
      if (res) {
        toast({
          title: "Common Agent State Saved",
          description: res,
        });
      }
      return;
    }

    const _newState = {
      ...get().localState,
      currentAgents: {
        ...get().localState.currentAgents,
        name: _name,
      },
    };
    set({ localState: _newState });

    SERVER_saveTeam(
      _newState.currentAgents,
      _newState.contextSet.sets,
      _newState.userId,
      allOrOne as "all" | "one"
    );

    get().refreshAgentStates();

    toast({
      title: "Agent State Saved",
      description: "Agent state saved successfully",
    });
  }
}
