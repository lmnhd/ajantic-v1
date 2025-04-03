"use client";
import React from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Disc3Icon } from "lucide-react";
import { useGlobalStore } from "@/src/lib/store/GloabalStoreState";
import { ServerMessage, Team } from "@/src/lib/types";
import {
  AgentComponentProps,
  AISessionState,
  GlobalMessages,
} from "@/src/lib/types";
import { toast } from "@/components/ui/use-toast";
import { UTILS_setServerMessagesCurrentState } from "@/src/lib/utils";
import { GeneralPurpose } from "@prisma/client";
import { SERVER_getCommonAgents } from "@/src/lib/server";
import {
  SERVER_getAgent,
  SERVER_getTeam,
  SERVER_deleteTeam,
} from "@/src/lib/server2";
import { Button } from "@/components/ui/button";
import {
  CollapsibleTrigger,
  CollapsibleContent,
  Collapsible,
} from "@/components/ui/collapsible";

function SavedAgentSelector({
  currentConversation,
  setServerMessages,
  localState,
  setLocalState,
  savedAgents,
  handleChangeIndex,
  saveAgentState,
  loadTeam,
  deleteTeam,
}: {
  currentConversation: ServerMessage[];
  setServerMessages: (messages: ServerMessage[]) => void;
  localState: AISessionState;
  setLocalState: (state: AISessionState) => void;
  savedAgents: {
    agents: {
      id: number;
      name: string;
      roleDescription: string;
      title: string;
    }[];
    teams: { id: number; name: string; objectives: string }[];
  };
  handleChangeIndex: () => void;
  saveAgentState: () => void;
  loadTeam: (teamId: number) => void;
  deleteTeam: (teamId: number) => void;
}) {
  const [commonAgents, setCommonAgents] = React.useState<GeneralPurpose[]>([]);

  React.useEffect(() => {
    console.log("USE_EFFECT_LOAD_COMMON_AGENTS");
    const loadCommonAgents = async () => {
      console.log("LOADING_COMMON_AGENTS");
      const _commonAgents = await SERVER_getCommonAgents();
      console.log("COMMON_AGENTS_LOADED", _commonAgents);
      setCommonAgents(_commonAgents);
    };
    loadCommonAgents();
  }, []);

  return (
    <Popover>
      <PopoverTrigger className="w-10 px-2 flex items-center justify-cener bg-pink-500/10 hover:cursor-pointer hover:bg-pink-500/60 rounded-md">
        <Disc3Icon className="w-6 h-6" />
      </PopoverTrigger>
      <PopoverContent>
        <div className="flex flex-col gap-2">
          <div>
            <label
              htmlFor="savedSingleAgents"
              className="block text-sm font-medium text-gray-700"
            >
              My Agents
            </label>
            <select
              id="savedSingleAgents"
              name="savedSingleAgents"
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-black border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              onChange={async (e) => {
                const _newState = localState;
                const _agent = await SERVER_getAgent(parseInt(e.target.value));
                _newState.currentAgents.agents.push(_agent);
                setLocalState(_newState);
                console.log("Agent Loaded");
                // setServerMessages(
                //   UTILS_setServerMessagesCurrentState(currentConversation, _newState)
                // );
                toast({
                  title: "Agent Loaded",
                  description: "Agent has been loaded",
                });
              }}
            >
              {savedAgents.agents.map((agent, index) => (
                <option
                  className="bg-black text-white"
                  key={index}
                  value={agent.id}
                >
                  {agent.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="savedTeams"
              className="block text-sm font-medium text-gray-700"
            >
              My Teams
            </label>
            <select
              id="savedTeams"
              name="savedTeams"
              //value={}
              className="mt-1 block w-full bg-black pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              onChange={async (e) => {
                loadTeam(parseInt(e.target.value));
              }}
            >
              {savedAgents.teams.map((team, index) => (
                <option
                  className="bg-black text-white"
                  key={index}
                  value={team.id}
                >
                  {team.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="savedCommonAgents"
              className="block text-sm font-medium text-gray-700"
            >
              Common Agents
            </label>
            <select
              id="savedCommonAgents"
              name="savedCommonAgents"
              className="mt-1 block w-full bg-black pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              onChange={(e) => {
                console.log("Common Agent Selected - ", e.target.value);
                try {
                  const _gp: GeneralPurpose = JSON.parse(e.target.value);
                  console.log("General Purpose Object - ", _gp);
                  //_newAgent.name = _newAgent.name;
                  const _newState = localState;
                  _newState.currentAgents.agents.push(JSON.parse(_gp.content));
                  setLocalState(_newState);
                  handleChangeIndex();
                  toast({
                    title: "Common Agent Loaded",
                    description: `Common Agent ${_gp.meta2} has been loaded`,
                  });
                } catch (error) {
                  console.log(error);
                  toast({
                    title: "Error",
                    description: "Error loading common agent" + error,
                  });
                }
              }}
            >
              {commonAgents &&
                commonAgents.map((gp, index) => (
                  <option
                    className="bg-black text-white"
                    key={index}
                    value={JSON.stringify(gp)}
                  >
                    {gp.meta1} - {gp.meta2} - {gp.meta3}
                  </option>
                ))}
            </select>
          </div>
          <div className="w-full flex flex-col items-center justify-between gap-2 my-2">
            <div>
              <Button
                variant={"outline"}
                className="p-2 inset bg-black/50 backdrop-blur-md rounded-none"
                onClick={() => {
                  console.log("Save Agent State");
                  saveAgentState();
                }}
              >
                Save Team|Agent
              </Button>
            </div>

            <div>
              <Collapsible>
                <CollapsibleTrigger>
                  <Button className="border border-red-500 text-red-400" variant={"outline"}>Cancel Team</Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="flex flex-col gap-2 mt-2">
                    {savedAgents.teams.map((team, index) => (
                      <Button
                        key={index}
                        variant="destructive"
                        size="sm"
                        className="w-full justify-start text-left hover:bg-red-700/90"
                        onClick={async () => {
                          if (
                            confirm(
                              `Are you sure you want to delete team "${team.name}"?`
                            )
                          ) {
                            deleteTeam(team.id);
                          }
                        }}
                      >
                        {team.name}
                      </Button>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default SavedAgentSelector;
