import React, { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ExitIcon, Pencil2Icon } from "@radix-ui/react-icons";
import { LampIcon } from "lucide-react";
import { UTILS_cleanTitle, UTILS_startLoading } from "@/src/lib/utils";
import { useGlobalStore } from "@/src/lib/store/GloabalStoreState";
import { __newSong, __updateAIState } from "@/src/lib/lyric-helpers";
import { AISessionState, FunctionName, GlobalMessages } from "@/src/lib/types";

// ... Add necessary imports

type SongTitlePopoverProps = {
  songName: string;
  handleProcessLineOrGroup: (params: { globalMessages: GlobalMessages }) => Promise<any>;
  __updateStreamData: any;
  __storeHistoryFromClient: (params: any) => Promise<any>;
};

export default function SongTitlePopover({
  songName,
  handleProcessLineOrGroup,
  __updateStreamData,
  __storeHistoryFromClient,
}: SongTitlePopoverProps) {
  const [songPanelOpen, setSongPanelOpen] = useState(false);
  const { setGlobalMessages, appState, globalMessages, setAppState } = useGlobalStore();

  // ... Copy the content of the Popover component from lyric-container.tsx
  // and paste it here, adjusting for the new component structure

  return (
    <Popover modal open={songPanelOpen}>
      <PopoverTrigger className="w-full flex justify-end" onClick={() => setSongPanelOpen(true)}>
        <h2 className="text-2xl font-bold text-right my-6">
          {UTILS_cleanTitle(songName)}
        </h2>
      </PopoverTrigger>
      <PopoverContent>
      <div className="p-2 flex flex-col items-center justify-center"
          onMouseLeave={() => {
            console.log("Mouse Leave")
            setSongPanelOpen(false)
          }}
          >
            <Input
              className="w-full m-4"
              value={UTILS_cleanTitle(songName)}
              onChange={(e) => {
                if(e.target.value.length === 0){
                  setGlobalMessages({
                    ...globalMessages,
                    currentState: { ...globalMessages.currentState, songName: "[Title - Untitled]" },
                   })
                }
                else{
                let updatedState = globalMessages.currentState;
                updatedState.songName = `[Title - ${e.target.value}]`;
                setGlobalMessages({
                  ...globalMessages,
                  currentState: updatedState,
                });
              }
            }}
            />
            {globalMessages.currentState.currentSong[0] &&
              globalMessages.currentState.currentSong[0].text.length > 1 && (
                <Button
                  className="p4 m-4 w-full flex items-center justify-center gap-4"
                  variant={"destructive"}
                  onClick={() => {
                    setGlobalMessages(__newSong(globalMessages));
                  }}
                >
                  {" "}
                  <ExitIcon color="white" />
                  Clear...
                </Button>
              )}
            {globalMessages.currentState.currentSong[0] &&
              globalMessages.currentState.currentSong[0].text.length < 3 && (
                <Button
                  className="p4 m-4 w-full flex items-center justify-center gap-4"
                  variant={"outline"}
                  onClick={async () => {
                    //setAppState(UTILS_startLoading(appState, "Starting Hook Wizard..."))
                    // setAppState(UTILS_startLoading(appState, "Starting Hook Wizard..."))
                    setSongPanelOpen(false);

                    const resetState = {
                      ...globalMessages,
                      currentState: {
                        ...globalMessages.currentState,
                        role: "function",

                        currentFunction: FunctionName.HOOK_WIZARD_STEP1,

                        lastFunction:
                          globalMessages.currentState.currentFunction,

                        currentTryCount: 0,

                        curBlockNum: 0,

                        curLineNum: 0,

                        previousData: { options: [], data: {} },

                        resultData: { options: [], data: {} },
                      },
                    } as GlobalMessages;

                    setGlobalMessages(resetState);
                    console.log("resetState: ", resetState);

                    const result = await handleProcessLineOrGroup({
                      globalMessages: resetState,
                    });

                    console.log("resultOBJ: ", result);
                    console.log("_streamData: ", result._streamData);

                    await __updateStreamData({
                      appState: appState,
                      result: result,
                      setAppState: setAppState,
                      setGlobalMessages: setGlobalMessages,
                      storeHistoryFromClient: __storeHistoryFromClient,
                    });

                    // setAppState(UTILS_startLoading(appState, "Starting Hook Wizard..."))
                    // setAppState(UTILS_stopLoading(appState))
                  }}
                >
                  {" "}
                  <LampIcon color="white" />
                  Hook Wizard...
                </Button>
              )}
            {globalMessages.currentState.currentSong[0] &&
              globalMessages.currentState.currentSong[0].text.length > 2 && (
                <Button
                  className="p4 m-4 w-full flex items-center justify-center gap-4"
                  variant={"secondary"}
                  onClick={async () => {
                    setSongPanelOpen(false);

                    setAppState(
                      UTILS_startLoading(
                        appState,
                        `Preparing to generate titles...`
                      )
                    );

                    // return

                    const newState = {
                      ...globalMessages.currentState,
                      role: "function",

                      currentFunction: FunctionName.GEN_TITLE,

                      resultData: { options: [], data: {} },
                    } as AISessionState;
                    setGlobalMessages({
                      ...globalMessages,
                      currentState: newState,
                    });

                    setAppState(
                      UTILS_startLoading(
                        appState,
                        `Now getting options from AI...`
                      )
                    );

                    const result = await handleProcessLineOrGroup({
                      globalMessages: {
                        ...globalMessages,
                        currentState: newState,
                      } as GlobalMessages,
                    });
                    //return

                    console.log("resultOBJ: ", result);
                    console.log("_streamData: ", result._streamData);

                    UTILS_startLoading(appState, `Complete...`);

                    await __updateStreamData({
                      appState: appState,
                      result: result,
                      setAppState: setAppState,
                      setGlobalMessages: setGlobalMessages,
                      storeHistoryFromClient: __storeHistoryFromClient,
                    });
                  }}
                >
                  {" "}
                  <Pencil2Icon color="white" />
                  Generate...
                </Button>
              )}
          </div>
      </PopoverContent>
    </Popover>
  );
}