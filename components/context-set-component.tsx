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
  inputContextSet: ContextSet | null | undefined;
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
  themeColor = 'indigo'
}: ContextSetComponentProps) => {
  const [gridCols, setGridCols] = useState<number>(2);
  const { toast } = useToast();
  const { appState } = useGlobalStore();
  const {
    localState,
    updateContextSet,
    addContextContainer,
    updateContextContainer,
    deleteContextContainer,
    toggleAgentVisibility,
    shiftContextContainer,
    clearContextText,
    handleSaveContextSet,
    handleLoadContextSet,
    handleDeleteContextSet,
    handleDeleteMultipleContextSets
  } = useAnalysisStore(state => ({
    localState: state.localState,
    updateContextSet: state.updateContextSet,
    addContextContainer: state.addContextContainer,
    updateContextContainer: state.updateContextContainer,
    deleteContextContainer: state.deleteContextContainer,
    toggleAgentVisibility: state.toggleAgentVisibility,
    shiftContextContainer: state.shiftContextContainer,
    clearContextText: state.clearContextText,
    handleSaveContextSet: state.handleSaveContextSet,
    handleLoadContextSet: state.handleLoadContextSet,
    handleDeleteContextSet: state.handleDeleteContextSet,
    handleDeleteMultipleContextSets: state.handleDeleteMultipleContextSets
  }));

  const [isFullScreen, setIsFullScreen] = useState(false);
  const [selectedSetId, setSelectedSetId] = useState<string>("");
  const [savedAnalysisStatesLoaded, setSavedAnalysisStatesLoaded] =
    useState<boolean>(false);
  const [isAnyContainerFullscreen, setIsAnyContainerFullscreen] =
    useState(false);
  const [selectedSets, setSelectedSets] = useState<number[]>([]);
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);

  React.useEffect(() => {
    const loadSavedSets = async () => {
      if (!appState?.currentUser?.id) {
        console.warn("ContextSetComponent: currentUser not available yet for loading saved sets.");
        return;
      }
      try {
        const savedSets = await SERVER_getSavedContextSets(
          appState.currentUser.id
        );
        setContextSetStore(savedSets || []);
        setSavedAnalysisStatesLoaded(true);
      } catch (error) {
        console.error("Error loading saved context sets:", error);
        toast({
          title: "Error",
          description: "Failed to load saved context sets",
          variant: "destructive",
        });
      }
    };
    loadSavedSets();
  }, [appState?.currentUser?.id, setContextSetStore, toast]);

  const storeAnalysisSet = async () => {
    if (!inputContextSet || inputContextSet.sets.length === 0 || !appState.currentUser?.id) return;

    const name = prompt("Name this analysis set", localState.currentAgents.name + " context" );
    if (!name) return;

    try {
      const formattedSets = inputContextSet.sets.map(set => ({
        setName: set.setName || `Set ${Math.random().toString(36).substr(2, 9)}`,
        lines: Array.isArray(set.lines) ? set.lines : [],
        text: set.text || "",
        formSchema: set.formSchema || undefined,
        isDisabled: set.isDisabled || false,
        hiddenFromAgents: Array.isArray(set.hiddenFromAgents) ? set.hiddenFromAgents : []
      }));

      const formattedContextSet: ContextSet = {
        ...inputContextSet,
        sets: formattedSets ? formattedSets : [] as ContextContainerProps[],
        teamName: name
      };

      await handleSaveContextSet(formattedContextSet, name);
      
      if (!appState?.currentUser?.id) {
        console.error("ContextSetComponent: Cannot refresh saved sets, currentUser not available.");
        return;
      }
      const savedSets = await SERVER_getSavedContextSets(appState.currentUser.id);
      setContextSetStore(savedSets);

      toast({
        title: "Saved",
        description: "Analysis set saved successfully",
        type: "foreground",
      });

      await updateContextSet({ sets: formattedSets });
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
    shiftContextContainer(index, direction);
  };

  const deletTextFromSetCalled = (index: number) => {
    clearContextText(index);
  };

  const convertLinesToText = (index: number) => {
    const sets = localState.contextSet?.sets;
    if (!sets || !sets[index]) return;
    
    const set = sets[index];
    if (!Array.isArray(set.lines)) return;
    
    const newText = set.lines.map((line: LineLyricType) => line.content).join("\n");
    updateContextContainer(index, { text: newText, lines: [] });
  };

  const toggleHideFromAgents = (
    agentName: string,
    selectedIndex: number,
    allAgentNames: string[],
    soloInstead?: boolean
  ) => {
    toggleAgentVisibility(agentName, selectedIndex, allAgentNames, soloInstead);
  };

  const editText = (text: string, index: number) => {
    updateContextContainer(index, { text });
  };

  const deleteLineOrTextFromLyricSet = (lineIndex: number) => {
    if (!localState.contextSet?.sets || currentContextSetItem < 0) return;
    console.log("Clearing text/lines for current item:", currentContextSetItem);
    
    updateContextContainer(currentContextSetItem, { 
      text: "", 
      lines: [], 
      setName: localState.contextSet.sets[currentContextSetItem].setName || `Set ${currentContextSetItem + 1}` 
    });
  };

  const deleteSingleLineFromSet = (setIndex: number, lineIndex: number) => {
    if (!localState.contextSet?.sets) return;
    console.log("deleting single line from set", setIndex, lineIndex);
    
    const set = localState.contextSet.sets[setIndex];
    if (!set || !Array.isArray(set.lines)) return;
    
    const nextLines = [...set.lines];
    nextLines.splice(lineIndex, 1);
    updateContextContainer(setIndex, { lines: nextLines });
  };

  const addSetToContainer = () => {
    addContextContainer();
  };

  const deleteSetFromContainer = (index: number) => {
    console.log("deleteSetFromContainer called with index:", index);
    deleteContextContainer(index);
  };

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

  const clearSets = () => {
    if (confirm("Are you sure you want to reset the line sets?")) {
      updateContextSet({ sets: [] });
    }
  };

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

  const handleSetLabelName = useCallback((newName: string, index: number) => {
    updateContextContainer(index, { setName: newName });
  }, [updateContextContainer]);

  const handleDeleteSelected = async () => {
    if (selectedSets.length === 0) return;
    
    const confirmDelete = confirm(`Are you sure you want to delete ${selectedSets.length} context set${selectedSets.length > 1 ? 's' : ''}?`);
    if (!confirmDelete) return;

    try {
      await handleDeleteMultipleContextSets(selectedSets);
      if (!appState?.currentUser?.id) {
         console.error("ContextSetComponent: Cannot refresh saved sets, currentUser not available.");
         return;
      }
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
      if (!appState?.currentUser?.id) {
         console.error("ContextSetComponent: Cannot refresh saved sets, currentUser not available.");
         return;
      }
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
           isAnyContainerFullscreen && "fixed inset-0 z-[99] h-screen bg-black/95 mt-14?"
        )}
      >
        <div
          className={cn(
            "flex justify-between min-w-full items-center mb-10",
            isAnyContainerFullscreen && "h-screen overflow-hidden bg-black/95"
          )}
        >
          <div
            className={cn(
              `grid grid-flow-row-dense w-full gap-2 items-start justify-evenly h-full overflow-y-auto pb-96`,
              getColLength(),
              isAnyContainerFullscreen && "grid-cols-1"
            )}
          >
            {inputContextSet?.sets &&
              inputContextSet.sets.map((set, i) => (
                <div key={set.setName + i}>
                  <ContextContainer
                    {...set}
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
                      updateContextContainer(i, { isDisabled: v });
                      setCurrentContextSetItem(i);
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
