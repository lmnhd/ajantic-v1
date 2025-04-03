"use client";
import React, { useEffect } from "react";

import ReferenceStateView from "@/components/global/reference-stateview";
import { useGlobalStore } from "@/src/lib/store/GloabalStoreState";
import { LineLyricType } from "@/components/songeditor/lyric/line";
import { cn, UTILS_putGenericData } from "@/src/lib/utils";
import { ExitIcon, PlusCircledIcon, PlusIcon } from "@radix-ui/react-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AgentComponentProps,
  AISessionState,
  AnalysisSet,
  ContextContainerProps,
  GlobalMessages,
  
  ModelProviderEnum,
} from "@/src/lib/types";
import { Button } from "@/components/ui/button";
import { useChat } from "ai/react";
import { useActions } from "ai/rsc";
import { useToast } from "@/components/ui/use-toast";
import { BlockLyricType } from "@/components/songeditor/lyric/block";
import { BoxIcon } from "lucide-react";

import { Label } from "@/components/ui/label";
import ContextContainer from "./context-container";
import { __getAllStoredAnalysisSets, __getLastStoredAnalysisSet, __storeAnalysisSet } from "@/src/lib/server-actions";
import { GeneralPurpose } from "@prisma/client";
import { useAnalysisStore } from "../src/lib/store/analysis-store";
import HorizontalDivider from "@/components/global/horizontal-divider";

// Each container should contain a list of agent names that cannot view it
const LineSets = ({
  inputLineSets,
  allAgents,
  currentContextItem,
  setCurrentContextItem,
  lineSetStates,
  setLineSetState,
  handleDeleteTextFromSet,
  globalMessages,
  setGlobalMessages,
  handleSetsChanged,
  doNotLoadLastState = false,
}: {
  inputLineSets:ContextContainerProps[];
  allAgents: AgentComponentProps[];
  currentContextItem: number;
  setCurrentContextItem: any;
  lineSetStates: GeneralPurpose[];
  setLineSetState: any;
  handleDeleteTextFromSet: ((args: string) => void) | undefined;
  globalMessages: GlobalMessages;
  setGlobalMessages: (globalMessages: GlobalMessages) => void;
  handleSetsChanged?: (sets: ContextContainerProps[]) => void;
  doNotLoadLastState?: boolean;
}) => {
  const [gridCols, setGridCols] = React.useState<number>(1);
  const [localSets, setLocalSets] = React.useState<ContextContainerProps[]>(inputLineSets || []);
  const [lockHandleSetsChanged, setLockHandleSetsChanged] = React.useState<boolean>(false);
  const { toast } = useToast();
  const { appState } = useGlobalStore();
  const [analysisStateLoaded, setAnalysisStateLoaded] = React.useState<boolean>(false);
  const [savedAnalysisStatesLoaded, setSavedAnalysisStatesLoaded] = React.useState<boolean>(false);

  // Use analysis store for syncing
  const {
    updateLocalState,
    saveState
  } = useAnalysisStore();

  const getAllAnalysisStates = async () => {
    if (!appState.currentUser) return;
    console.log("getting all analysis states", appState.currentUser?.id);
    
    const result = await __getAllStoredAnalysisSets(appState.currentUser?.id || "");
    console.log("all analysis state result: ", result);
    
    if (lineSetStates.length === 0) {
      setLineSetState(result);
    }
  };

  React.useEffect(() => {
    if (localSets.length === 1 ) {
      setGridCols(1);
    } else {
      if (localSets.length === 0) {
        // add a default set
        setLocalSets([{
          lines: [],
          text: "Use this section for anything you want to share with the agents.",
          setName: "Set 1",
          isDisabled: false,
        }]);
      }
    }
  }, [localSets.length])
  // Load line states on mount
  React.useEffect(() => {
    if (savedAnalysisStatesLoaded) return;
    
    const loadAllStates = async () => {
      await getAllAnalysisStates();
      setSavedAnalysisStatesLoaded(true);
    };

    if (lineSetStates?.length === 0) {
      loadAllStates();
    }
  }, [savedAnalysisStatesLoaded, lineSetStates?.length]);

  // Sync with analysis store when local sets change
  React.useEffect(() => {
    if (lockHandleSetsChanged) return;
    console.log("Syncing local sets with analysis store:", localSets);
    
    // Update contextSets in the store
    updateLocalState({ contextSet: {
      sets: localSets,
      teamName: "Playground",
    } });
    handleSetsChanged?.(localSets);
    
    // Don't lock permanently - reset after a short delay
    setLockHandleSetsChanged(true);
    setTimeout(() => setLockHandleSetsChanged(false), 100);
  }, [localSets]);

  // Initialize from input
  React.useEffect(() => {
    if (!inputLineSets) return;
    setLocalSets(inputLineSets);
  }, [inputLineSets]);

  // Handle storing analysis set
  const storeAnalysisSet = async () => {
    if (localSets.length === 0) return;
    
    // Prompt user to name the analysis set
    const name = prompt("Name this analysis set");
    if (!name) return;

    await __storeAnalysisSet({
      analysisName: name,
      contextSets: localSets,
      userId: appState.currentUser?.id || "",
    });

    // Refresh the line states
    await getAllAnalysisStates();

    toast({
      title: "Saved",
      description: "Analysis set saved successfully",
      type: "foreground",
    });

    // Also save to IndexedDB via the store
    await saveState();
  };

  const shiftSetUpOrDown = (index: number, direction: "up" | "down") => {
    setLockHandleSetsChanged(false);
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === localSets.length - 1) return;
    const _sets = [...localSets];
    if (direction === "up") {
      _sets.splice(index - 1, 0, _sets.splice(index, 1)[0]);
    } else {
      _sets.splice(index + 1, 0, _sets.splice(index, 1)[0]);
    }
    setLocalSets(_sets);
  };

  const deletTextFromSetCalled = (index: number) => {
    console.log("deletTextFromSetCalled");
    const _newSets = [...localSets];
    _newSets[index].text = "";
    setLocalSets(_newSets);
    handleDeleteTextFromSet?.(index.toString());
  };

  const convertLinesToText = (index: number) => {
    setLockHandleSetsChanged(false);
    console.log("converting lines to text", index);
    const _sets = [...localSets];
    _sets[index].text = _sets[index].lines.map((line) => line.text).join("\n");
    _sets[index].lines = [];
    setLocalSets(_sets);
  };

  const toggleHideFromAgents = (
    agentName: string,
    selectedIndex: number,
    allAgentNames: string[],
    soloInstead?: boolean
  ) => {
    setLockHandleSetsChanged(false);
    if (soloInstead) {
      console.log("SOLO_INSTEAD", agentName, selectedIndex);
      const _sets = [...localSets];
      for (let index = 0; index < _sets.length; index++) {
        if (index === selectedIndex) {
          _sets[index].hiddenFromAgents = allAgentNames.filter(
            (a) => a !== agentName
          );
        }
      }
      setLocalSets(_sets);
    } else {
      const _sets = [...localSets];
      const currentSet = _sets[selectedIndex];
      currentSet.hiddenFromAgents = currentSet.hiddenFromAgents?.includes(
        agentName
      )
        ? currentSet.hiddenFromAgents.filter((a) => a !== agentName)
        : [...(currentSet.hiddenFromAgents ?? []), agentName];
      setLocalSets(_sets);
    }
  };

  const editText = (text: string, index: number) => {
    console.log("editing text", text);
    const _sets = [...localSets];
    const _set = _sets[index];
    _set.text = text;
    _sets[index] = _set;
    setLockHandleSetsChanged(false); // Allow sync to occur
    setLocalSets(_sets);
  };

  const deleteLineOrTextFromLyricSet = (index: number) => {
    setLockHandleSetsChanged(false);
    console.log("deleting index", index);
    if (index === -1) {
      const _sets = [...localSets];
      const _set = _sets[currentContextItem];
      _set.text = "";
      _set.setName = `Set ${currentContextItem + 1}`;
      _sets[currentContextItem] = _set;
      setLocalSets(_sets);
      return;
    }
    console.log("deleting index", index, localSets.length, currentContextItem);

    if (localSets.length === 0) {
      return;
    }

    const _sets = [...localSets];
    const _set = _sets[index];
    _set.lines.splice(index, 1);
    _sets[currentContextItem] = _set;
    setLocalSets(_sets);
  };

  const deleteSingleLineFromSet = (setIndex: number, lineIndex: number) => {
    setLockHandleSetsChanged(false);
    console.log("deleting single line from set", setIndex, lineIndex);
    const _sets = [...localSets];
    _sets[setIndex].lines.splice(lineIndex, 1);
    setLocalSets(_sets);
  };

  const addSetToContainer = () => {
    if (!localSets) return;
    setLockHandleSetsChanged(false);
    const _sets = [...localSets];
    _sets.push({
      lines: [],
      text: "",
      setName: `Set ${_sets.length + 1}`,
      isDisabled: false,
    });
    setLocalSets(_sets);
  };

  const deleteSetFromContainer = (index: number) => {
    setLockHandleSetsChanged(false); // Allow sync to occur
    const _sets = [...localSets];
    _sets.splice(index, 1);
    setLocalSets(_sets);
  };

  // Update Select component to handle loading saved states
  const handleLoadSavedState = (content: string) => {
    try {
      const selectedState = JSON.parse(content);
      console.log("Parsed selected state:", selectedState);
      
      // If it's an AnalysisSet format
      let lineSetsToLoad: ContextContainerProps[] = [];
      if (Array.isArray(selectedState)) {
        lineSetsToLoad = selectedState;
      } else if (selectedState.contextSets) {
        lineSetsToLoad = selectedState.contextSets;
      }

      // ask user if merge or overwrite
      const merge = confirm("Do you want to merge the new state with the current state?");
      if (merge) {
        const _newSets = [...localSets, ...lineSetsToLoad];
        console.log("Merging sets:", _newSets);
        setLocalSets(_newSets);
      } else {
        console.log("Replacing sets with:", lineSetsToLoad);
        setLocalSets(lineSetsToLoad);
      }

      toast({
        title: "State Loaded",
        description: merge ? "States merged successfully" : "State loaded successfully",
      });
    } catch (error) {
      console.error("Error loading state:", error);
      toast({
        title: "Error",
        description: "Failed to load selected state",
        variant: "destructive",
      });
    }
  };

  // Also update the clear button to properly clear both arrays
  const clearSets = () => {
    const reset = confirm("Are you sure you want to reset the line sets?");
    if (reset) {
      setLockHandleSetsChanged(false);
       setLocalSets([]);
      // updateLocalState({ contextSets: [] });
      // saveState();
    }
  };

  return (
    <div className={cn(" bg-slate-800/70  rounded-sm")}>
      <div className="flex justify-evenly w-full h-full items-center border-b-[1px] border-indigo-700/50 p-6 bg-slate-800/70">
        <div className="flex flex-col border-r-[1px] border-indigo-700/50 justify-center w-48 items-center gap-2">
          <h2 className={cn("text-xl font-bold text-violet-500")}>line|sets</h2>
          <PlusCircledIcon
            className={cn("w-6 h-6 text-violet-500 hover:cursor-pointer")}
            onClick={() => {
              addSetToContainer();
            }}
          />
        </div>
        <div className="flex flex-col justify-center w-48 items-center gap-2 border-r-[1px] border-blue-600/50">
          <Button variant="outline" onClick={storeAnalysisSet}>
            save|state
          </Button>
          <Select
            onValueChange={handleLoadSavedState}
            onOpenChange={(v) => {
              if (v) {
                // Refresh states when opening selector
                getAllAnalysisStates();
              }
            }}
          >
            <SelectTrigger className="w-[100px] dark:bg-violet-500/30">
              <SelectValue placeholder="all|states" />
            </SelectTrigger>
            <SelectContent>
              {lineSetStates &&
                lineSetStates.length > 0 &&
                lineSetStates.map((s: any, i: any) => {
                  return (
                    <SelectItem key={i} value={s.content}>
                      {s.meta3}
                    </SelectItem>
                  );
                })}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col justify-center items-center w-48  gap-2">
          <Label className="text-violet-500 text-xs mx-auto">Columns</Label>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setGridCols((prev) => Math.max(prev - 1, 1))}
            >
              -
            </Button>
            <span className="text-violet-500">{gridCols}</span>
            <Button
              variant="outline"
              onClick={() => setGridCols((prev) => prev + 1)}
            >
              +
            </Button>
          </div>
        </div>
      </div>
      <div className="h-full w-full m-0 p-0">
        <Button
          className="w-full text-xs bg-gradient-to-r from-indigo-700/70 via-pink-700/90 to-violet-700/70 mix-blend-color-dodge text-pink-400 rounded-none h-4 m-0 p-0 hover:bg-black opacity-30 blur-lg shadow-md hover:blur-none hover:opacity-100 transition-all duration-300 ease-in-out"
          variant="outline"
          onClick={clearSets}
        >
          Clear Sets
        </Button>
      </div>
      
      <div className="flex justify-between min-w-full items-center mb-10 ">
        <div
          className={`grid grid-flow-row-dense grid-cols-${gridCols} w-full gap-2 items-start justify-evenly h-full overflow-y-auto`}
        >
          {localSets &&
            localSets.map((set, i) => {
              //console.log("Set Loading: ", set);
              //console.log("globalMessages: ", globalMessages);
              return (
                <div
                  key={i}
                  // onDoubleClick={() => {
                  //   if (!globalMessages.currentState) return;
                  //   if (!globalMessages.currentState.contextSets) return;
                  //   console.log("double clicked", i);
                  //   const _sets = [...globalMessages.currentState.contextSets];
                  //   _sets.splice(i, 1);
                  //   _sets.forEach((s, j) => {
                  //     s.setName = `Set ${j + 1}`;
                  //   });
                  //   setGlobalMessages({
                  //     ...globalMessages,
                  //     currentState: {
                  //       ...globalMessages.currentState,
                  //       contextSets: _sets,
                  //     },
                  //   });
                  // }}
                >
                  <ContextContainer
                    key={i}
                    lines={set.lines}
                    text={set.text}
                    name={set.setName}
                    currentAgentsForVisibility={allAgents}
                    agentNames={allAgents.map((a) => a.name)}
                    
                    thisContainersHiddenAgentNames={set.hiddenFromAgents ?? []}
                    toggleHideFromAgents={toggleHideFromAgents}
                    index={i}
                    currentContextItem={currentContextItem}
                    localCurrentContextItem={currentContextItem}
                    setLocalCurrentContextItem={setCurrentContextItem}
                    setCurrentContextItem={setCurrentContextItem}
                    deleteSingleLineFromSet={deleteSingleLineFromSet}
                    setIsDisabled={(v: any) => {
                      const _sets = [...localSets];
                      _sets[i].isDisabled = v;
                      updateLocalState({ contextSet: {
                        sets: _sets,
                        teamName: "Playground",
                      } });
                      setCurrentContextItem(v);
                    }}
                    disabled={set.isDisabled}
                    convertLinesToText={convertLinesToText}
                    textInputChanged={(v: string) => editText(v, i)}
                    deleteSet={deleteSetFromContainer}
                    handleDeleteTextFromSet={deletTextFromSetCalled}
                    fullHeight={gridCols === 1}
                    shift={shiftSetUpOrDown}
                    setLabelName={(v: string) => {
                      const _sets = [...localSets];
                      _sets[i].setName = v;
                      updateLocalState({ contextSet: {
                        sets: _sets,
                        teamName: "LineSets Obsolete",
                      } });
                    }}
                  />
                </div>
              );
            })}
        </div>
        {/* <ContextContainer lines={lines1} name="Original" />
          <ContextContainer lines={lines1} name="Regenerated" />
          <ContextContainer lines={lines1} name="Regenerated" /> */}
      </div>
    </div>
  );
};

export default LineSets;
