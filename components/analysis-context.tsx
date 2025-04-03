import React, { useState } from "react";
import LineSets from "./linesets";
import { AISessionState, ContextContainerProps, ContextSet, GlobalMessages, LineSet } from "@/src/lib/types";
import { GeneralPurpose } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/src/lib/utils";
import AgentGlobalStateView from "./agent-global-state-view";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronsUpDown } from "lucide-react";
import ContextSetComponent from "./context-set-component";

export interface AnalysisContextWindowProps {
  currentContextSetItem: number;
  setCurrentContextSetItem: (contextSet: number) => void;
  contextSetStore: { id: number; teamName: string }[];
  setContextSetStore: (contextSetStore: { id: number; teamName: string }[]) => void;
  deleteTextFromSet: (contextSetId: string, lineId: string) => void;
  loadContextSet: (id: number) => void;
  saveContextSet: (contextSet: ContextSet, name: string) => Promise<void>;
  inputContextSet: ContextSet;
  state: AISessionState;
  //globalMessages: GlobalMessages;
  //setGlobalMessages: (globalMessages: GlobalMessages) => void;
  handleSetsChanged?: (sets: ContextContainerProps[]) => void;
  //loadLastContextState?: boolean;
}
export default function AnalysisContextWindow({
  currentContextSetItem,
  setCurrentContextSetItem,
  contextSetStore,
  setContextSetStore,
  deleteTextFromSet,
  inputContextSet,
  state,
  loadContextSet,
  saveContextSet,
  //globalMessages,
  //setGlobalMessages,
  handleSetsChanged,
  //loadLastContextState = true,
}: AnalysisContextWindowProps) {
  const [showContextSwitch, setShowContextSwitch] = useState(false);
  const [contextMode, setContextMode] = useState(0);

  const handleContextMode = (mode: number) => {
    setContextMode(mode);
  };

  console.log("ANALYSIS-CONTEXT-INPUTSETS", inputContextSet);
  return (
    <Collapsible 
    defaultOpen={true}
    className="flex items-center w-full justify-center h-full relative group p-2 shadow-md bg-gradient-to-r from-slate-900/90 via-indigo-900/80 to-slate-900/90 border-b border-indigo-500/20 rounded-sm"
    >
      {contextMode === 0 && (
        <div
          className={cn(
            `w-full transition-all duration-300 ease-in-out`,
            showContextSwitch ? "mr-3" : ""
          )}
        >
          <div className="flex items-center justify-between space-x-4 px-4">
            <h4 className="text-sm font-semibold">
              Context | Analysis Sets
            </h4>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                <ChevronsUpDown className="h-4 w-4" />
                <span className="sr-only">Toggle</span>
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="Context-Container? w-full h-full ">
          
              {inputContextSet &&
              inputContextSet.sets && inputContextSet.sets.length > 0 && (
                <ContextSetComponent
                  inputContextSet={inputContextSet}
                  allAgents={state.currentAgents.agents}
                  currentContextSetItem={currentContextSetItem}
                  setCurrentContextSetItem={setCurrentContextSetItem}
                  contextSetStore={contextSetStore}
                  setContextSetStore={setContextSetStore}
                  handleDeleteTextFromSet={(args) =>
                    deleteTextFromSet(args[0], args[1])
                  }
                  handleSetsChanged={(sets) => {
                    console.log("handleSetsChanged", sets);
                    handleSetsChanged?.(sets.sets);
                  }}
                  loadContextSet={loadContextSet}
                  saveContextSet={saveContextSet}
                  //doNotLoadLastState={!loadLastContextState}
                />
              )}
          </CollapsibleContent>
        </div>
      )}
      {contextMode === 1 && (
        <div
          className={cn(
            "w-[90vw] h-[90vh] bg-black/50 flex items-center justify-center transition-all duration-300 ease-in-out",
            showContextSwitch ? "mr-3" : ""
          )}
        >
          <AgentGlobalStateView />
        </div>
      )}
      {/* <div
        className={cn(
          `absolute right-0 w-2 h-full cursor-pointer transition-all duration-300 ease-in-out`,
          showContextSwitch
            ? "w-6 bg-black/50 rounded-sm blur-2xl shadow-lg shadow-lime-500"
            : ""
        )}
      >
        <Button
          className="w-full h-full bg-black?"
          onMouseEnter={() => setShowContextSwitch(true)}
          onMouseLeave={() => setShowContextSwitch(false)}
          onClick={() => handleContextMode(contextMode === 0 ? 1 : 0)}
        ></Button>
      </div> */}
    </Collapsible>
  );
}
