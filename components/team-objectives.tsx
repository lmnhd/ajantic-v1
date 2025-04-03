import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { useGlobalStore } from "@/src/lib/store/GloabalStoreState";
import { SERVER_storeGeneralPurposeData } from "@/src/lib/server";
import React, { useEffect, useRef, useState } from "react";
import AutoPromptSettings from "./auto-prompt-settings";
import { AISessionState, ModelArgs, ModelProviderEnum } from "@/src/lib/types";

import { cn, UTILS_putGenericData } from "@/src/lib/utils";

const TeamObjectives = ({
  localStateObject,
  setlocalStateObject,
  handleChangeIndex,
}: {
  localStateObject: AISessionState;
  setlocalStateObject: (state: AISessionState) => void;
  handleChangeIndex: () => void;
}) => {
  //const { localStateObject, setlocalStateObject } = useGlobalStore();
  const [autoPromptModel, setAutoPromptModel] = useState<ModelArgs>({
    modelName: "gpt-4o-mini",
    provider: ModelProviderEnum.OPENAI,
    temperature: 0.5,
  });

  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const handleHandleChangeIndex = () => {
    handleChangeIndex();
  };
  useEffect(() => {
    // console.log(
    //   "TEAM-OBJECTIVES-localStateObject",
    //   localStateObject.currentAgents.name
    // );
    if (localStateObject && localStateObject.currentAgents && localStateObject.currentAgents.name) {
      document.title = `${localStateObject.currentAgents.name} Team Objectives`;
      if (textAreaRef.current) {
        textAreaRef.current.value =
          localStateObject.currentAgents.objectives ?? "";
      }
    }
  }, [localStateObject]);
  return (
    <div className="flex flex-col gap-2 overflow-y-auto">
      <div className="font-bold text-lg">
        {localStateObject.currentAgents && localStateObject.currentAgents.name
          ? localStateObject.currentAgents.name
          : "Team"}{" "}
        Objectives
      </div>
      {/* <input type="text" placeholder="Enter team objectives" /> */}

      <textarea
        ref={textAreaRef}
        defaultValue={localStateObject?.currentAgents?.objectives ?? ""}
        className="bg-black text-white"
        rows={5}
        placeholder="Enter team objectives"
        onBlur={(e) => {
          const _newState = localStateObject;
          _newState.currentAgents.objectives = e.target.value;
          setlocalStateObject(_newState);
        }}
      ></textarea>
      <Button
        variant="outline"
        onClick={async () => {
          await UTILS_putGenericData(
            textAreaRef.current?.value,
            "teamObjectives",
            { history: [], currentState: localStateObject }
          );
          const _agents = localStateObject.currentAgents;
          _agents.objectives = textAreaRef.current?.value ?? "";
          setlocalStateObject({ ...localStateObject, currentAgents: _agents });
          toast({
            title: "Objective Saved",
            description: "Team objective has been saved successfully",
          });
        }}
      >
        Save Objective
      </Button>
      <Button
        className="mt-2 bg-indigo-500 text-pink-200"
        variant={"secondary"}
        onClick={async () => {
          // We are developing next level techniques and technologies that generate new age lyrics, lines, rythms, and rhymes
          const genericObjective = "We are experimenting with the power of AI!";
          const _objective = window.prompt(
            "What are we doing?",
            genericObjective
          );
          await UTILS_putGenericData(_objective, "teamObjectives", {
            history: [],
            currentState: localStateObject,
          });
          const _name = window.prompt(
            "What is the name of this team?",
            "New Team"
          );
          const _newState = localStateObject;
          _newState.currentAgents.agents = [
            {
              name: "Agent Chief",
              type: "agent",
              modelArgs: {
                modelName: "gpt-4o-mini",
                provider: ModelProviderEnum.OPENAI,
                temperature: 0.5,
              },
              tools: [],
              index: 0,
              title: "Agent Chief",
              listSets: [],
              roleDescription:
                "You are the chief of the team, you are responsible for the overall success of the team.",
              messages: [],
              systemPrompt:
                "You are responsible for organizing and monitoring tasks assigned to the team.",
            },
          ];
          _newState.currentAgents.name = _name ?? "New Team";
          _newState.currentAgents.objectives = _objective ?? genericObjective;
          textAreaRef.current!.value = _objective ?? genericObjective;
          setlocalStateObject(_newState);
          handleHandleChangeIndex();
        }}
      >
        New Team
      </Button>
      <div className="h-1 border-b border-white/10" />
      <div>
        <div className="font-bold text-lg m-4">Team Members</div>
        <ul className="flex flex-row flex-wrap gap-2 font-medium h-5/6? overflow-y-auto">
          {localStateObject &&
            localStateObject?.currentAgents?.agents?.length > 0 &&
            localStateObject?.currentAgents?.agents?.map((agent, index) => (
              <li
                className="p-2 bg-black/20 rounded-2xl hover:bg-black/40 transition-all duration-300 cursor-pointer"
                key={index}
              >
                {agent.name}
              </li>
            ))}
        </ul>
      </div>
      <div
        className={cn(
          "flex flex-row items-center justify-center m-2 space-y-3"
        )}
      >
        <div className="flex flex-col items-center justify-center">
          <AutoPromptSettings
            autoPromptModel={autoPromptModel}
            setAutoPromptModel={setAutoPromptModel}
            currentAgentIndex={0}
            globalMessages={{ history: [], currentState: localStateObject }}
            setGlobalMessages={(globalMessages) =>
              setlocalStateObject(globalMessages.currentState)
            }
          />
        </div>
      </div>
    </div>
  );
};

export default TeamObjectives;
