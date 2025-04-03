import React, { useState } from "react";
import LineLyric, { LineLyricType, __updateStreamData } from "./line";
import { useActions } from "ai/rsc";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AIState } from "@/src/lib/aicontext";
import { LyricContainerProps } from "./lyric-container";
import { Button } from "@/components/ui/button";
import { AtomIcon } from "lucide-react";

import { AISessionState, FunctionName, ProcessLyricProps } from "@/src/lib/types";
import { GlobalMessages } from "@/src/lib/types";
import { useGlobalStore } from "@/src/lib/store/GloabalStoreState";
import { BackgroundGradientAnimation } from "@/components/ui/background-animation";
import { __storeHistoryFromClient, processLineOrGroup } from "@/src/lib/server-actions";

export type BlockLyricType = {
  text: LineLyricType[];
  length: number;
  name: string;
  blockNum: number;
  customFunctions: { name: string; value: string }[];
  editMode?: "edit" | "reference";

  addSingleLineToWPReferences?: (blockNum: number, lineNum: number) => void;
  handleGroupSelection?: (
    blockNum: number,
    lineNum: number,
    selected: boolean
  ) => void;
  addGroupLinesToReference?: () => void;
  handleAddBlockToReference?: (blockNum: number) => void;
  groupSelected: boolean;
  selectedLines: { blockNum: number; lineNum: number }[];
};
export default function BlockLyric({
  text,
  length,
  name,
  blockNum,
  customFunctions,
  addSingleLineToWPReferences,
  handleGroupSelection,
  addGroupLinesToReference,
  handleAddBlockToReference,
  groupSelected,
  selectedLines,
  editMode,
}: BlockLyricType) {
  
  const { appState, globalMessages, setAppState, setGlobalMessages } =
    useGlobalStore();

  async function handleBlockSubmit(functionName: string, block: number) {
    // const _state = JSON.stringify(aIStates[aIStates.length - 1]);
    // const _rules = JSON.stringify(aIStates[aIStates.length - 1].rules);
    // setProcessType("block");
    console.log("HandleBlockSubmit: ", globalMessages);
    //return;
    const resultOBJ = await processLineOrGroup({
      globalMessages: {
        ...globalMessages,
        currentState: {
          ...globalMessages.currentState,
          role: "function",

          curBlockNum: blockNum,
          curLineNum: -1,
          currentFunction: functionName,
          processType: "block",
        },
      },
    });

    console.log("resultOBJ:", resultOBJ);

    __updateStreamData({appState, result: resultOBJ, setAppState, setGlobalMessages, storeHistoryFromClient: __storeHistoryFromClient});
    //return
    // const newMessages: GlobalMessages = {
    //   history: [...globalMessages.history, resultOBJ.aiState.currentState],
    //   currentState: resultOBJ.aiState.currentState,
    // };
    // setGlobalMessages(newMessages);

    // setAppState({
    //   ...appState,
    //   _streamData: resultOBJ.appState._streamData,
    //   dialogOpen: true,
    // });

   // appState.dialogOpen = true;
  }

  return (
    <div 
    // // gradientBackgroundStart="rgb(5, 50, 102)"
    // gradientBackgroundEnd="rgb(54, 30, 109)"
    // gradientBackgroundStart={UTILS_getRandomRGBColorString(true)}
    // //gradientBackgroundEnd={UTILS_getRandomRGBColorString()}
    // firstColor={UTILS_getRandomRGBColorString(false)} 
    // secondColor={UTILS_getRandomRGBColorString(false)}
    // thirdColor={UTILS_getRandomRGBColorString(false)}
    // fourthColor={UTILS_getRandomRGBColorString(false)}
    // interactive={true}
    >
      <div className="flex ">
        <div className="flex flex-col border-[1px] hover:bg-red-600/10 border-slate-700/50 p-2 w-full">
          {text.map((line, index) => (
            <LineLyric
              key={index}
              text={line.text}
              type={index === 0 ? "label" : "line"}
              blockNum={blockNum}
              blockLength={text.length}
              lineNum={index}
              addGroupLinesToReference={addGroupLinesToReference}
              addSingleLineToWPReferences={(line: number) => {
                if (addSingleLineToWPReferences) {
                  addSingleLineToWPReferences(blockNum, line);
                }
              }}
              handleGroupSelection={(blockNum, index, selected) => {
                if (handleGroupSelection) {
                  handleGroupSelection(blockNum, index, selected);
                }
              }}
              containerEditMode={editMode}
              isSelected={false}
              groupSelected={groupSelected}
              selectedLines={selectedLines}
            />
          ))}
        </div>
        {text.length > 1 && <div className="flex items-center justify-center rounded-md bg-slate-950/90 mix-blend-difference w-[3rem] my-4 hover:bg-black">
          <Button
            disabled={editMode === "reference" || text.length < 2}
            onClick={async () => {
              if (editMode === "edit") {
                handleBlockSubmit(globalMessages.currentState.currentFunction, blockNum);
              } else if (editMode === "reference") {
                if (handleAddBlockToReference) {
                  handleAddBlockToReference(blockNum);
                }
              }
            }}
          >
            <AtomIcon size={24} color="pink" />
          </Button>
        </div>}
      </div>
    </div>
  );
}
