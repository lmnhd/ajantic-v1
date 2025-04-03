"use client";
import React, { useCallback, useEffect, useState, useRef } from "react";

import ReferenceStateView from "@/components/global/reference-stateview";
import { useGlobalStore } from "@/src/lib/store/GloabalStoreState";
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
  ContextSet,
  GlobalMessages,
  LineLyricType,
  ModelProviderEnum,
} from "@/src/lib/types";
import { Button } from "@/components/ui/button";
import { useChat } from "ai/react";
import { useActions } from "ai/rsc";
import { useToast } from "@/components/ui/use-toast";
import { BlockLyricType } from "@/components/songeditor/lyric/block";
import { BoxIcon } from "lucide-react";

import { Label } from "@/components/ui/label";
import {
  __getAllStoredAnalysisSets,
  __getLastStoredAnalysisSet,
  __storeAnalysisSet,
} from "@/src/lib/server-actions";
import { SERVER_getSavedContextSets } from "@/src/lib/server2";
import {  GeneralPurpose } from "@prisma/client";
import { useAnalysisStore } from "../src/lib/store/analysis-store";
import HorizontalDivider from "@/components/global/horizontal-divider";
import ContextContainer from "./context-container";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2Icon } from "lucide-react";

type ThemeColor = 'violet' | 'blue' | 'indigo' | 'purple' | 'slate' | 'gray' | 'zinc' | 'emerald' | 'green' | 'red' | 'yellow' | string;

interface ContextSetComponentProps {
  inputContextSet: ContextSet;
  allAgents: AgentComponentProps[];
  currentContextSetItem: number;
  setCurrentContextSetItem: (index: number) => void;
  contextSetStore: { id: number; teamName: string }[];
  setContextSetStore: (store: { id: number; teamName: string }[]) => void;
  loadContextSet: (id: number) => void;
  saveContextSet: (contextSet: ContextSet, name: string) => Promise<void>;
  handleDeleteTextFromSet: ((args: string) => void) | undefined;
  handleSetsChanged?: (sets: ContextSet) => void;
  themeColor?: ThemeColor;
}

const ContextSetComponent = ({
  inputContextSet,
  allAgents,
  currentContextSetItem,
  setCurrentContextSetItem,
  contextSetStore,
  setContextSetStore,
  loadContextSet,
  handleDeleteTextFromSet,
  handleSetsChanged,
  themeColor = 'indigo'
}: ContextSetComponentProps) => {
  const [gridCols, setGridCols] = React.useState<number>(2);
  const [localContext, setLocalContext] = React.useState<ContextSet>(
    inputContextSet || { sets: [], teamName: "" } // Ensure initial state is valid
  );
  const prevLocalContextRef = useRef<ContextSet>(); // Ref to store previous context
  const [selectedSetId, setSelectedSetId] = React.useState<string>("");
  const { toast } = useToast();
  const { appState } = useGlobalStore();
  const [savedAnalysisStatesLoaded, setSavedAnalysisStatesLoaded] =
    React.useState<boolean>(false);
  const [isAnyContainerFullscreen, setIsAnyContainerFullscreen] =
    useState(false);
  const [selectedSets, setSelectedSets] = React.useState<number[]>([]);
  const [isManageDialogOpen, setIsManageDialogOpen] = React.useState(false);

  // Use analysis store for syncing
  const { 
    updateLocalState, 
    saveState, 
    localState,
    handleSaveContextSet, 
    handleLoadContextSet,
    handleDeleteContextSet,
    handleDeleteMultipleContextSets
  } = useAnalysisStore();

  // Load saved context sets on mount
  React.useEffect(() => {
    const loadSavedSets = async () => {
      if (!appState.currentUser?.id) return;
      
      try {
        const savedSets = await SERVER_getSavedContextSets(appState.currentUser.id);
        setContextSetStore(savedSets);
        setSavedAnalysisStatesLoaded(true);
      } catch (error) {
        console.error("Error loading saved sets:", error);
        toast({
          title: "Error",
          description: "Failed to load saved context sets",
          variant: "destructive",
        });
      }
    };
    loadSavedSets();
  }, [appState.currentUser?.id, setContextSetStore, toast]);

  // Sync with analysis store when local sets change
  const syncLocalSetsWithAnalysisStore = useCallback(() => {
    console.log("Syncing local sets with analysis store:", localContext);

    // Update contextSets in the store
    updateLocalState({ contextSet: localContext });
    handleSetsChanged?.(localContext);
  }, [localContext]);

  // Initialize from input
  React.useEffect(() => {
    if (!inputContextSet) return;
    setLocalContext(inputContextSet);
  }, [inputContextSet]);

  // Fix: Add a condition to prevent continuous updates
  React.useEffect(() => {
    syncLocalSetsWithAnalysisStore();
  }, [syncLocalSetsWithAnalysisStore]);

  // Handle storing analysis set
  const storeAnalysisSet = async () => {
    if (localContext.sets.length === 0 || !appState.currentUser?.id) return;

    // Prompt user to name the analysis set
    const name = prompt("Name this analysis set", localState.currentAgents.name + " context" );
    if (!name) return;

    try {
      // Format the sets data to ensure all required fields are properly set
      const formattedSets = localContext.sets.map(set => ({
        setName: set.setName || `Set ${Math.random().toString(36).substr(2, 9)}`,
        lines: Array.isArray(set.lines) ? set.lines : [],
        text: set.text || "",
        formSchema: set.formSchema || null,
        isDisabled: set.isDisabled || false,
        hiddenFromAgents: Array.isArray(set.hiddenFromAgents) ? set.hiddenFromAgents : []
      }));

      // Create a properly formatted context set
      const formattedContextSet = {
        ...localContext,
        sets: formattedSets,
        teamName: name
      } as ContextSet;

      await handleSaveContextSet(formattedContextSet, name);
      
      // Refresh the context set store after saving
      const savedSets = await SERVER_getSavedContextSets(appState.currentUser.id);
      setContextSetStore(savedSets);

      toast({
        title: "Saved",
        description: "Analysis set saved successfully",
        type: "foreground",
      });

      // Also save to IndexedDB via the store
      await saveState();
    } catch (error) {
      console.error("Error saving analysis set:", error);
      toast({
        title: "Error",
        description: "Failed to save analysis set",
        variant: "destructive",
      });
    }
  };

  const shiftSetUpOrDown = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === localContext.sets.length - 1) return;
    const _sets = [...localContext.sets];
    if (direction === "up") {
      _sets.splice(index - 1, 0, _sets.splice(index, 1)[0]);
    } else {
      _sets.splice(index + 1, 0, _sets.splice(index, 1)[0]);
    }
    setLocalContext({ ...localContext, sets: _sets });
  };

  const deletTextFromSetCalled = (index: number) => {
    console.log("deletTextFromSetCalled");
    const _newSets = [...localContext.sets];
    _newSets[index].text = "";
    setLocalContext({ ...localContext, sets: _newSets });
    handleDeleteTextFromSet?.(index.toString());
  };

  const convertLinesToText = (index: number) => {
    console.log("converting lines to text", index);
    const _sets = [...localContext.sets];
    _sets[index].text = _sets[index].lines
      ?.map((line: LineLyricType) => line.content)
      .join("\n");
    _sets[index].lines = [];
    setLocalContext({ ...localContext, sets: _sets });
  };

  const toggleHideFromAgents = (
    agentName: string,
    selectedIndex: number,
    allAgentNames: string[],
    soloInstead?: boolean
  ) => {
    if (soloInstead) {
      console.log("SOLO_INSTEAD", agentName, selectedIndex);
      const _sets = [...localContext.sets];
      for (let index = 0; index < _sets.length; index++) {
        if (index === selectedIndex) {
          _sets[index].hiddenFromAgents = allAgentNames.filter(
            (a) => a !== agentName
          );
        }
      }
      setLocalContext({ ...localContext, sets: _sets });
    } else {
      const _sets = [...localContext.sets];
      const currentSet = _sets[selectedIndex];
      currentSet.hiddenFromAgents = currentSet.hiddenFromAgents?.includes(
        agentName
      )
        ? currentSet.hiddenFromAgents.filter((a) => a !== agentName)
        : [...(currentSet.hiddenFromAgents ?? []), agentName];
      setLocalContext({ ...localContext, sets: _sets });
    }
  };

  const editText = (text: string, index: number) => {
    console.log("editing text", text);
    const _sets = [...localContext.sets];
    const _set = _sets[index];
    _set.text = text;
    _sets[index] = _set;
    setLocalContext({ ...localContext, sets: _sets });
  };

  const deleteLineOrTextFromLyricSet = (index: number) => {
    console.log("deleting index", index);
    if (index === -1) {
      const _sets = [...localContext.sets];
      const _set = _sets[currentContextSetItem];
      _set.text = "";
      _set.setName = `Set ${currentContextSetItem + 1}`;
      _sets[currentContextSetItem] = _set;
      setLocalContext({ ...localContext, sets: _sets });
      return;
    }
    console.log("deleting index", index, localContext.sets.length, currentContextSetItem);

    if (localContext.sets.length === 0) {
      return;
    }

    const _sets = [...localContext.sets];
    const _set = _sets[index];
    _set.lines?.splice(index, 1);
    _sets[currentContextSetItem] = _set;
    setLocalContext({ ...localContext, sets: _sets });
  };

  const deleteSingleLineFromSet = (setIndex: number, lineIndex: number) => {
    console.log("deleting single line from set", setIndex, lineIndex);
    const _sets = [...localContext.sets];
    _sets[setIndex].lines?.splice(lineIndex, 1);
    setLocalContext({ ...localContext, sets: _sets });
  };

  const addSetToContainer = () => {
    if (!localContext) return;
    const _sets = [...localContext.sets];
    _sets.push({
      lines: [],
      text: "",
      setName: `Set ${_sets.length + 1}`,
      isDisabled: false,
      hiddenFromAgents: [],
    });
    setLocalContext({ ...localContext, sets: _sets });
  };

  const deleteSetFromContainer = (index: number) => {
    const _sets = [...localContext.sets];
    _sets.splice(index, 1);
    setLocalContext({ ...localContext, sets: _sets });
  };

  // Update Select component to handle loading saved states
  const handleLoadSavedState = async (id: string) => {
    try {
      setSelectedSetId(id);
      await handleLoadContextSet(parseInt(id));
      toast({
        title: "Loaded",
        description: "Context set loaded successfully",
        type: "foreground",
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
      setLocalContext({ ...localContext, sets: [] });
    }
  };

  // Add handler for fullscreen changes
  const handleFullscreenChange = (isFullscreen: boolean) => {
    console.log("handleFullscreenChange", isFullscreen);
    setIsAnyContainerFullscreen(isFullscreen);
  };

  const getColLength = useCallback(() => {
    switch (gridCols) {
      case 1:
        return "grid-cols-1";
      case 2:
        return "grid-cols-2";
      case 3:
        return "grid-cols-3";
      case 4:
        return "grid-cols-4";
      default:
        return "grid-cols-1";
    }
  }, [gridCols]);

  // Define setLabelName handler with useCallback
  const handleSetLabelName = useCallback((newName: string, index: number) => {
    setLocalContext(prevContext => {
      const _sets = [...prevContext.sets];
      // Only update if name actually changed
      if (_sets[index] && _sets[index].setName !== newName) {
        _sets[index] = { ..._sets[index], setName: newName };
        // updateLocalState is handled by the syncLocalSetsWithAnalysisStore effect
        return { ...prevContext, sets: _sets };
      }
      return prevContext; // No change needed
    });
  }, [setLocalContext]); // Add setLocalContext as dependency

  const handleDeleteSelected = async () => {
    if (selectedSets.length === 0) return;
    
    const confirmDelete = confirm(`Are you sure you want to delete ${selectedSets.length} context set${selectedSets.length > 1 ? 's' : ''}?`);
    if (!confirmDelete) return;

    try {
      await handleDeleteMultipleContextSets(selectedSets);
      // Refresh the context set store
      const savedSets = await SERVER_getSavedContextSets(appState.currentUser.id);
      setContextSetStore(savedSets);
      setSelectedSets([]);
      toast({
        title: "Deleted",
        description: `Successfully deleted ${selectedSets.length} context set${selectedSets.length > 1 ? 's' : ''}`,
        type: "foreground",
      });
    } catch (error) {
      console.error("Error deleting context sets:", error);
      toast({
        title: "Error",
        description: "Failed to delete context sets",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSingle = async (id: number) => {
    const confirmDelete = confirm("Are you sure you want to delete this context set?");
    if (!confirmDelete) return;

    try {
      await handleDeleteContextSet(id);
      // Refresh the context set store
      const savedSets = await SERVER_getSavedContextSets(appState.currentUser.id);
      setContextSetStore(savedSets);
      toast({
        title: "Deleted",
        description: "Successfully deleted context set",
        type: "foreground",
      });
    } catch (error) {
      console.error("Error deleting context set:", error);
      toast({
        title: "Error",
        description: "Failed to delete context set",
        variant: "destructive",
      });
    }
  };

  const ManageContextSetsDialog = () => {
    return (
      <Dialog open={isManageDialogOpen} onOpenChange={setIsManageDialogOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 px-2 text-xs text-${themeColor}-400 hover:bg-${themeColor}-500/20`}
          >
            manage
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Manage Context Sets</DialogTitle>
            <DialogDescription>
              Select context sets to delete or delete them individually
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex justify-between items-center">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteSelected}
                disabled={selectedSets.length === 0}
              >
                <Trash2Icon className="h-4 w-4 mr-2" />
                Delete Selected ({selectedSets.length})
              </Button>
            </div>
            <div className="grid gap-2 max-h-[300px] overflow-y-auto">
              {contextSetStore?.map((set) => (
                <div key={set.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`set-${set.id}`}
                    checked={selectedSets.includes(set.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedSets([...selectedSets, set.id]);
                      } else {
                        setSelectedSets(selectedSets.filter(id => id !== set.id));
                      }
                    }}
                  />
                  <label
                    htmlFor={`set-${set.id}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-grow"
                  >
                    {set.teamName}
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => handleDeleteSingle(set.id)}
                  >
                    <Trash2Icon className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  const ContextActionBar = () => {
    return (
      <div className="sticky top-0 z-50">
        <div className={`flex items-center justify-between h-12 px-4 bg-gradient-to-r from-slate-900/90 via-${themeColor}-900/80 to-slate-900/90 border-b border-${themeColor}-500/20`}>
          {/* Left section */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium text-${themeColor}-400`}>
                add|set
              </span>
              <PlusCircledIcon
                className={`w-4 h-4 text-${themeColor}-500 hover:text-${themeColor}-300 cursor-pointer transition-colors`}
                onClick={addSetToContainer}
              />
            </div>

            <div className={`h-4 w-[1px] bg-${themeColor}-500/20`} />

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className={`h-7 px-2 text-xs text-${themeColor}-400 hover:bg-${themeColor}-500/20`}
                onClick={storeAnalysisSet}
              >
                save
              </Button>
              <Select
                value={selectedSetId}
                onValueChange={handleLoadSavedState}
              >
                <SelectTrigger className={`h-7 w-20 text-xs bg-transparent border-${themeColor}-500/30`}>
                  <SelectValue placeholder="load" />
                </SelectTrigger>
                <SelectContent>
                  {contextSetStore?.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.teamName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <ManageContextSetsDialog />
            </div>
          </div>

          {/* Right section */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className={`h-6 w-6 p-0 text-${themeColor}-400 hover:bg-${themeColor}-500/20`}
                onClick={() =>
                  setGridCols((prev) => Math.max(Math.min(prev - 1, 4), 1))
                }
              >
                -
              </Button>
              <span className={`text-xs w-4 text-center text-${themeColor}-400`}>
                {gridCols}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className={`h-6 w-6 p-0 text-${themeColor}-400 hover:bg-${themeColor}-500/20`}
                onClick={() =>
                  setGridCols((prev) => Math.max(Math.min(prev + 1, 4), 1))
                }
              >
                +
              </Button>
            </div>

            <div className={`h-4 w-[1px] bg-${themeColor}-500/20`} />

            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/20"
              onClick={clearSets}
            >
              clear
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <ContextActionBar />
      <div
        className={cn(
          `bg-${themeColor}-800/10 mix-blend-screen z-[10] rounded-sm w-full`,
           isAnyContainerFullscreen && "fixed inset-0 z-[99] h-screen bg-black/95 mt-14?" // Lower z-index than container, add margin-top
        )}
      >
        <div
          className={cn(
            "flex justify-between min-w-full items-center mb-10",
            isAnyContainerFullscreen && "h-screen overflow-hidden bg-black/95" // Prevent background scroll
          )}
        >
          <div
            className={cn(
              `grid grid-flow-row-dense w-full gap-2 items-start justify-evenly h-full overflow-y-auto pb-96`,
              getColLength(),
              isAnyContainerFullscreen && "grid-cols-1" // Force single column in fullscreen
            )}
          >
            {localContext.sets &&
              localContext.sets.map((set, i) => (
                <div key={i}>
                  <ContextContainer
                    {...set}
                    key={i}
                    lines={set.lines as LineLyricType[] ?? []}
                    text={set.text ?? ""}
                    name={set.setName}
                    currentAgentsForVisibility={allAgents}
                    agentNames={allAgents.map((a) => a.name)}
                    thisContainersHiddenAgentNames={set.hiddenFromAgents ?? []}
                    toggleHideFromAgents={toggleHideFromAgents}
                    index={i}
                    localCurrentContextItem={currentContextSetItem}
                    setLocalCurrentContextItem={setCurrentContextSetItem}
                    currentContextItem={currentContextSetItem}
                    setCurrentContextItem={setCurrentContextSetItem}
                    deleteSingleLineFromSet={deleteSingleLineFromSet}
                    setIsDisabled={(v: any) => {
                      const _sets = [...localContext.sets];
                      // Only update if value changed
                      if (_sets[i].isDisabled !== v) {
                        _sets[i].isDisabled = v;
                        updateLocalState({ contextSet: {sets: _sets, teamName: localContext.teamName} });
                        setCurrentContextSetItem(i); // Use index i instead of value v
                      }
                    }}
                    formSchema={set.formSchema}
                    onFormSubmit={set.onFormSubmit}
                    disabled={set.isDisabled}
                    convertLinesToText={convertLinesToText}
                    textInputChanged={(v: string) => editText(v, i)}
                    deleteSet={deleteSetFromContainer}
                    handleDeleteTextFromSet={deletTextFromSetCalled}
                    fullHeight={gridCols === 1}
                    fullScreen={isAnyContainerFullscreen}
                    shift={shiftSetUpOrDown}
                    setLabelName={(v: string) => handleSetLabelName(v, i)}
                    themeColor={themeColor}
                  />
                </div>
              ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default ContextSetComponent;
