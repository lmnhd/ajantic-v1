"use client";

import { CoreTool, StreamTextResult, type CoreMessage } from "ai";
import { useEffect, useState } from "react";

import { readStreamableValue } from "ai/rsc";
import {
  SERVER_getGeneralPurposeDataMany,
  SERVER_getMySongs,
} from "@/src/lib/server";
import { useToast } from "../ui/use-toast";
import { useUser } from "@clerk/nextjs";
import { AILyrics } from "@prisma/client";
import { useActions, useUIState, useAIState } from "ai/rsc";

import { send } from "process";

import LyricContainer from "./lyric/lyric-container";
import { Button } from "../ui/button";
import { BlockarizeText } from "@/src/app/api/blockarize/index";
//import { testData } from "@/src/app/api/blockarize/data";
import { Blockarize } from "@/src/app/api/blockarize";
import { BlockLyricType } from "./lyric/block";
import { LineLyricType } from "./lyric/line";
import AIModal from "../global/aiModal";
import MySongs from "./mysongs";
import ReferenceStateView from "../global/reference-stateview";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { FuncProps, RuleProps } from "./lyric/functionpanel";
import { db } from "@/src/lib/db";
import { AISessionState, WordPlay2 } from "@/src/lib/types";
import {
  AxeIcon,
  BotIcon,
  CogIcon,
  CpuIcon,
  DnaIcon,
  LucideIcon,
  PiIcon,
  PlayIcon,
} from "lucide-react";
import CustomFunctionsPanel from "./lyric/customfunctionspanel";
import { string } from "zod";
import { useGlobalStore } from "@/src/lib/store/GloabalStoreState";
import {
  __initAIState,
  __initAppState,
  __updateAIState,
} from "@/src/lib/lyric-helpers";
import { getGlobalAIState } from "@/app/(main)/dashboard/editoractions/globalstatestore";
import { rulesArray } from "./rules";
import StateHistorySelect from "../global/state-history-select";
import { BackgroundGradientAnimationNOBG } from "../ui/background-animation-nobg";
import { BackgroundGradientAnimation } from "../ui/background-animation";
import ModelSelectGroup from "../global/model-provider-select";
import { cn } from "@/src/lib/utils";
import { storeCustomFunction } from "@/src/lib/server-actions";
//import { processLineOrGroup } from "@/app/aicontext";

export default function SongEditor() {
  const user = useUser();

  const [customRequestInput, setCustomRequestInput] = useState("");

  const { appState, globalMessages, setAppState, setGlobalMessages } =
    useGlobalStore();

  return (
    <BackgroundGradientAnimationNOBG>
      {/* <div className="bg-dot-white/[0.2] fixed">
        <div className="absolute pointer-events-none inset-0 flex items-center h-[1000px] justify-center dark:bg-black bg-white [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]"></div>
      </div> */}
      <div className="w-full bg-dot-white/[0.2]? flex flex-col justify-between p-12 mb-10?">
        {/* <div className="flex justify-center">
          <Button variant={"outline"}>test</Button>
        </div> */}
        {/* <div className="fixed right-0 mt-20 mr-20 top-0">
          <CustomFunctionsPanel/>
        </div> */}
        <div
        //className={cn("grid grid-rows-4? grid-cols-4 bg-gray-800/40")}
        >
          {globalMessages.currentState && (
            <div
              className={cn(
                "grid w-5/6 rounded-sm h-full text-blue-500 bg-gray-800/40 border-[1px] mx-auto border-pink-500/10 p-1"
              )}
              //className="grid grid-rows-4 col-span-4 h-full text-blue-500"
            >
              <MySongs setLyrics={async () => {}} />
              <Collapsible>
                <CollapsibleTrigger>
                  research|reference|reflection
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ReferenceStateView
                    onClick={() => {}}
                    mode="wordplay"
                    setBlock={() => {}}
                  />
                </CollapsibleContent>
              </Collapsible>

              {globalMessages.currentState.customRequests &&
                globalMessages.currentState.customRequests.length > 0 && (
                  <CustomFunctionsPanel
                  // setRequests={(
                  //   requests: { name: string; value: string }[]
                  // ) => {
                  //   const _aIStates = [...aIStates];
                  //   _aIStates[aIStates.length - 1].customRequests = requests;
                  //   setAIStates(_aIStates);
                  // }}
                  />
                )}
              {/* <div
                className={cn(
                  "flex flex-row gap-4 w-1/2 h-fit mx-auto items-center justify-center",
                  globalMessages.currentState.currentModels && globalMessages.currentState.currentModels.length > 0 ? "" : ""
                )}
                > */}
              <StateHistorySelect />
              <ModelSelectGroup
                localState={globalMessages.currentState}
                setLocalState={(state: AISessionState) => {
                  setGlobalMessages({ ...globalMessages, currentState: state });
                }}
              />
              {/* </div> */}
            </div>
          )}
          {globalMessages.currentState && (
            <LyricContainer
              songName={globalMessages.currentState.songName}
              text={globalMessages.currentState.currentSong}
              mode="edit"
            />
          )}
        </div>
        {/* <div className="flex flex-col gap-4">
          {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
          {aIStates.length > 0 && globalMessages.currentState.messages &&
            globalMessages.currentState.messages.map((m: any, i: number) => (
              <div key={i} className="whitespace-pre-wrap">
                {m.role === "user" ? "User: " : "AI: "}
                {m.content as string}
              </div>
            ))}
        </div> */}
        <form
          onSubmit={async () => {
            if (!appState.currentUser) return;
            console.log(
              "submitting: ",
              globalMessages.currentState,
              globalMessages.currentState.customRequests
            );
            const newStates = {
              ...globalMessages,
              currentState: {
                ...globalMessages.currentState,
                customRequests: [
                  ...globalMessages.currentState.customRequests,
                  { name: customRequestInput, value: customRequestInput },
                ],
              },
            };
            const newFunc = {
              name: customRequestInput,
              value: customRequestInput,
              userId: globalMessages.currentState.userId,
              isModifier: false,
            };
            await storeCustomFunction(newFunc);
            console.log("newStates: ", newStates);
            setCustomRequestInput("");
            setGlobalMessages({
              ...globalMessages,
              //history: [...globalMessages.history, newStates.currentState],
              currentState: newStates.currentState,
            });
          }}
        >
          <div className="flex fixed bottom-0 w-full ">
            <input
              className="p-2 mb-8 border w-[500px] border-gray-300 rounded shadow-xl"
              value={customRequestInput}
              placeholder="+Instruct..."
              onChange={(e) => setCustomRequestInput(e.target.value)}
            />
            <Button
              type="submit"
              className="w-16 h-full bg-black text-lime-500 max-w-md p-2 mb-8 border border-gray-300 rounded shadow-xl hover:bg-violet-800"
            >
              <PlayIcon className="text-xl " />
            </Button>
          </div>
        </form>
        {globalMessages.currentState && <AIModal />}
      </div>
    </BackgroundGradientAnimationNOBG>
  );
}
