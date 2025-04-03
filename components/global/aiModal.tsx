"use client";
import React, { useEffect, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { FunctionName } from "@/src/lib/types";
import { BoxIcon, PiIcon } from "lucide-react";
import { GlobalMessages } from "@/src/lib/types";
import { useGlobalStore } from "@/src/lib/store/GloabalStoreState";
import { __updateStreamData } from "../songeditor/lyric/line";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Checkbox } from "../ui/checkbox";
import {
  __storeHistoryFromClient,
  handleProcessLineOrGroup,
  storeCustomFunction,
} from "@/src/lib/server-actions";

export default function AIModal() {
  const [modifier, setModifier] = useState("");
  const [mergeValues, setMergeValues] = useState<string[]>([]);
  const [useNewSeed, setUseNewSeed] = useState(false);
  const [mergeMode, setMergeMode] = useState(false);

  const { appState, setAppState, globalMessages, setGlobalMessages } =
    useGlobalStore();

  useEffect(() => {
    setGlobalMessages({
      ...globalMessages,
      currentState: { ...globalMessages.currentState, newSeeds: useNewSeed },
    });
  }, [useNewSeed, globalMessages, setGlobalMessages]);

  useEffect(() => {
    setGlobalMessages({
      ...globalMessages,
      currentState: { ...globalMessages.currentState, newSeeds: false },
    });
  }, [globalMessages, setGlobalMessages]);

  useEffect(() => {
    setGlobalMessages({
      ...globalMessages,
      currentState: {
        ...globalMessages.currentState,
        resultData: {
          options: globalMessages.currentState.resultData.options,
          data: {
            ...globalMessages.currentState.resultData.data,
            mergeMode: mergeMode,
          },
        },
      },
    });
  }, [mergeMode, globalMessages, setGlobalMessages]);

  useEffect(() => {
    if (globalMessages.currentState.resultData.data.valuesToMerge) {
      setMergeValues(globalMessages.currentState.resultData.data.valuesToMerge);
    }
  }, [globalMessages.currentState.resultData.data]);

  return (
    <div>
      <AlertDialog open={appState.dialogOpen}>
        <AlertDialogContent className="h-2/3 w-full? max-w-full? p-12  dark:text-blue-300 transition-all ease-in-out duration-100">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {globalMessages.currentState.currentFunction}
            </AlertDialogTitle>
          </AlertDialogHeader>
          <div>
            <div>
              {appState._streamData ? (
                appState._streamData
              ) : (
                <div>loading...</div>
              )}
            </div>
          </div>
          <AlertDialogFooter>
            {globalMessages.currentState.currentFunction ===
              FunctionName.NEW_LINE && (
              <div className="flex text-xs p-2 items-center justify-center gap-4 h-8 border-[1px] rounded-md mx-2">
                <p>new seed</p>
                <Checkbox
                  className="h-6 w-6"
                  checked={useNewSeed}
                  onClickCapture={() => setUseNewSeed(!useNewSeed)}
                />
              </div>
            )}
            <AlertDialogCancel
              className="p-2 rounded-md cursor-pointer border-[1px] border-blue-300"
              onClick={async () => {
                const resultOBJ = await handleProcessLineOrGroup({
                  globalMessages: {
                    ...globalMessages,
                    currentState: {
                      ...globalMessages.currentState,
                      role: "cancel_function",
                    },
                  } as GlobalMessages,
                });
                await __updateStreamData({
                  appState: appState,
                  result: resultOBJ,
                  setAppState: setAppState,
                  setGlobalMessages: setGlobalMessages,
                  storeHistoryFromClient: __storeHistoryFromClient,
                });
                setAppState({ ...appState, dialogOpen: false });
              }}
            >
              Cancel
            </AlertDialogCancel>
            {!mergeMode && (
              <AlertDialogAction
                className="hover:bg-yellow-500 p-2 rounded-md cursor-pointer border-[1px] border-blue-300"
                onClick={async () => {
                  const resultOBJ = (await handleProcessLineOrGroup({
                    globalMessages: {
                      ...globalMessages,
                      currentState: {
                        ...globalMessages.currentState,
                        role: "try_again",
                        currentTryCount:
                          globalMessages.currentState.currentTryCount + 1,
                      },
                    } as GlobalMessages,
                  })) as {
                    globalMessages: GlobalMessages;
                    _streamData: JSX.Element;
                  };
                  await __updateStreamData({
                    appState: appState,
                    result: resultOBJ,
                    setAppState: setAppState,
                    setGlobalMessages: setGlobalMessages,
                    storeHistoryFromClient: __storeHistoryFromClient,
                  });
                }}
              >
                More Choices...
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
