"use client";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useNavbarStore } from "@/src/lib/navbar-store";
import { cn } from "@/src/lib/utils";
import { BotIcon, Maximize2, Minimize2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import AgentChat2 from "@/components/teams/agentChat2";
import { AnalysisState, useAnalysisStore } from "@/src/lib/store/analysis-store";
import { OrchestrationType, ServerMessage } from "@/src/lib/types";
import { Message } from "ai";
import { useGlobalStore } from "@/src/lib/store/GloabalStoreState";
import { useUser } from "@clerk/nextjs";
import { __initAppState } from "@/src/lib/lyric-helpers";
import { INDEXEDDB_initDB } from "@/src/lib/indexDB";
import { __initAIState } from "@/src/lib/lyric-helpers";
import ACFramework from "@/components/teams/ac_framework";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ContextContainer from "@/components/context-container";
import ContextSetComponent from "@/components/context-set-component";
import { LogViewer } from "@/components/LogViewer";
import {
  Select,
  SelectItem,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { XIcon } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { handleOrchestratedChatSubmit } from "@/src/lib/workflow/functions/message-handlers/orchestrated-chat";
import { useLogger } from "@/src/lib/hooks/useLogger";
import { CONVERSATION_store, formatDayName } from "@/src/lib/conversation";
import { ORCHESTRATION_PAUSE_resetAllFlags } from "@/src/lib/workflow/functions/message-handlers/orchestrated-chat/pause-chat";

import { AutoGenTeam } from "@/src/lib/autogen/autogen";
import AutogenComponent, { defaultProcess } from "@/components/teams/autogen_component";
import { TeamConfig } from "@/components/teams/TeamConfig";
import { useFullscreen } from "@/src/lib/hooks/useFullscreen";
import { AIMessage } from "@langchain/core/messages";
import { HumanMessage } from "@langchain/core/messages";
import { ClientMessage } from "@/src/lib/aicontext";
import { OrchestrationType2 } from "@/src/lib/orchestration/types";

export default function TeamsPage() {
  const { updateNavbar, resetNavbar } = useNavbarStore();
  const { appState, setGlobalMessages, setAppState } = useGlobalStore();
  const { isLoaded, user, isSignedIn } = useUser();
  // const [autoGenWorkflow, setAutoGenWorkflow] = useState<AutoGenTeam | null>(
  //   null
  // );

  //const [pauseWaiting, setPauseWaiting] = useState(false);
  const [orchStatus, setOrchStatus] = useState<"paused" | "runone" | "free">(
    "free"
  );

  const {
    agentActive,
    agentGlobalChatInput,
    agentGlobalChatInputChanged,
    changeIndex,
    changeMessageHistory,
    contextSet,
    contextSetStore,
    converationsForDay,
    conversationHistory,
    currentAgentIndex,
    currentContextSetItem,
    currentConversation,
    deleteFrozenGlobalState,
    deleteTeam,
    deleteTextFromSet,
    frozenStates,
    handleAgentChatSubmit,
    handleChangeIndex,
    handleClearMessages,
    handleDeleteTextFromSet,
    handleLoadContextSet,
    handlePromptTextToSet,
    handleSaveContextSet,
    handleOrchestratedChatSubmit,
    initialize,
    isInitialized,
    isLoading,
    loadAgent,
    localState,
    stateLoaded,
    loadAllFrozenStateNames,
    loadFrozenGlobalState,
    loadTeam,
    saveGlobalState,
    setContextSetStore,
    setAgentActive,
    setCurrentAgentIndex,
    setCurrentContextItem,
    setCurrentContextSetItem,
    setLineSetState,
    syncWithGlobalMessages,
    saveAgentState,
    savedAgentStates,
    saveState,
    updateMessages,
    loadEssentialData,
    refreshAgentStates,
    megaLoadStateFromBrowserOrServer,
    updateLocalState,
    agentOrder,
    setAgentOrder,
    rounds,
    setRounds,
    maxRounds,
    setMaxRounds,
    orchestrationMode,
    setOrchestrationMode,
    customAgentSet,
    setCustomAgentSet,
  }: AnalysisState = useAnalysisStore();

  const { messages: logMessages, clear: clearLogMessages } = useLogger();
  const [fullscreenRef, toggleFullscreen, isFullscreen] = useFullscreen();


  // State management for the automation workflow
  // Process to automate as described by the user
  const [automationProcess, setAutomationProcess] =
    useState<string>(defaultProcess);
  // Team metadata for identification and organization
  const [teamName, setTeamName] = useState<string>("");
  const [teamObjective, setTeamObjective] = useState<string>("");
  // For tracking and adding workflow modifications
  const [modificationText, setModificationText] = useState<string>("");
  const [workflowModifications, setWorkflowModifications] = useState<string[]>(
    []
  );
  // Structure representing the AutoGen workflow configuration
  const [autoGenWorkflow, setAutoGenWorkflow] = useState<AutoGenTeam | null>(
    null
  );
  const [modificationStore, setModificationStore] = useState<
    {
      modifications: string[];
    }[]
  >([]);
  // State for saved workflows functionality
  const [savedWorkflows, setSavedWorkflows] = useState<
    Array<{ id: number; name: string }>
  >([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [workflowName, setWorkflowName] = useState("");
  // Add state to track if workflow has been modified since last save
  const [workflowModified, setWorkflowModified] = useState(false);



  useEffect(() => {
    // Update navbar when component mounts
    updateNavbar({
      type: "minimized",
      title: "halimede",
      Icon: BotIcon,
      coloredLetters: [
        { letter: "h", color: "text-pink-500", index: 0 },
        { letter: "a", color: "text-purple-500", index: 1 },
        { letter: "l", color: "text-indigo-500", index: 2 },
        { letter: "d", color: "text-pink-500", index: 6 },
      ],
    });

    // Initialize analysis store
    const initStore = async () => {
      try {
        // Wait for user ID to be available
        if (!isInitialized && appState.currentUser?.id) {
          const userId = appState.currentUser.id;
          await initialize(userId);
          await loadEssentialData(userId);
          await megaLoadStateFromBrowserOrServer();
        }
      } catch (error) {
        console.error("Failed to initialize analysis store:", error);
      }
    };

    initStore();

    // Reset navbar when component unmounts
    return () => {
      resetNavbar();
    };
  }, [
    initialize,
    isInitialized,
    loadEssentialData,
    megaLoadStateFromBrowserOrServer,
    appState.currentUser?.id,
    isLoaded,
  ]);

  useEffect(() => {
    console.log("Initializing...", appState.currentUser, user, isInitialized);
    // setInitilized(true)
    // return;
    if (!appState || appState.currentUser) return;
    if (!user || !user.username) return;

    const start = async () => {
      if (!appState.currentUser && user.id) {
        // Only initialize user-specific data
        console.log("Initializing...", user.id);
        setGlobalMessages({
          ...__initAIState(),
          currentState: {
            ...__initAIState().currentState,
            userId: user.id,
            genericData: {
              userName: user.username,
              INIT_DONE: 1,
            },
          },
        });
        setAppState({ ...__initAppState(), currentUser: user });
        await INDEXEDDB_initDB();

        // Initialize analysis store with user ID

        console.log("Initializing analysis store...", user.id);
        await initialize(user.id);
      }
    };
    if (!isInitialized) start();
  }, [user]);

  useEffect(() => {
    if (isLoaded && user && !appState.currentUser) {
      setAppState({ ...appState, currentUser: user });
    }
  }, [isLoaded, user, appState, setAppState]);

  // Add diagnostic logging for troubleshooting
  useEffect(() => {
    console.log("Teams Page - Current Orchestration State:", {
      orchestrationMode,
      agentOrder,
      rounds,
      maxRounds,
      customAgentSet,
    });
  }, [orchestrationMode, agentOrder, rounds, maxRounds, customAgentSet]);

  useEffect(() => {
    // Save orchestration settings whenever they change
    if (isInitialized) {
      const settingsToSave = {
        orchestrationMode,
        agentOrder,
        rounds,
        maxRounds,
        customAgentSet,
      };
      localStorage.setItem(
        "orchestrationSettings",
        JSON.stringify(settingsToSave)
      );

      console.log("Teams Page - Current Orchestration State:", settingsToSave);
    }
  }, [
    orchestrationMode,
    agentOrder,
    rounds,
    maxRounds,
    customAgentSet,
    isInitialized,
  ]);

  if (!isLoaded) {
    return <div>Loading authentication state...</div>;
  }

  if (!isSignedIn) {
    return <div>Please sign in to access teams</div>;
  }

  // Add loading state handling
  if (!appState.currentUser?.id) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Waiting for user authentication...</div>
      </div>
    );
  }

  if (
    !isInitialized ||
    (isLoading && localState.currentAgents.agents.length === 0)
  ) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  const handleOrchestratedChat = async () => {
    if (customAgentSet.length === 0) {
      // Warn user that 2 or more agents are required for conversation
      window.alert(
        "Please custom select 2 or more agents for conversation OR select NO custom agents to use the standard conversation flow"
      );
      return;
    }
    await handleOrchestratedChatSubmit(
      orchestrationMode,
      rounds,
      maxRounds,
      agentOrder,
      customAgentSet
    );
  };

  const submitChat = async () => {
    await ORCHESTRATION_PAUSE_resetAllFlags();
    setOrchStatus("free");

    if (orchestrationMode === OrchestrationType2.DIRECT_AGENT_INTERACTION) {
      await handleAgentChatSubmit(agentGlobalChatInput);
      await CONVERSATION_store({
        dayName: await formatDayName(new Date()),
        userId: localState.userId,
        conversations: currentConversation,
      });
    } else {
      await handleOrchestratedChat();
    }
  };

  const setOrRemoveCustomAgent = (agent: string) => {
    if (customAgentSet.includes(agent)) {
      setCustomAgentSet(customAgentSet.filter((a) => a !== agent));
    } else {
      setCustomAgentSet([...customAgentSet, agent]);
    }
  };

  const reOrderCustomAgent = (
    changeAgent: string,
    toTheIndexOfAgent: string
  ) => {
    console.log("Reordering custom agent: ", changeAgent, toTheIndexOfAgent);
    let newOrder = [...customAgentSet];

    const currentIndex = customAgentSet.indexOf(changeAgent);
    if (currentIndex === -1) return;

    const insertPosition = newOrder.indexOf(toTheIndexOfAgent);
    console.log("Current index: ", currentIndex);

    console.log("Insert position: ", insertPosition);

    console.log("New order: ", newOrder);

    newOrder = newOrder.map((agent) => {
      if (agent === changeAgent) {
        return toTheIndexOfAgent;
      } else if (agent === toTheIndexOfAgent) {
        return changeAgent;
      }
      return agent;
    });

    // const [removed] = newOrder.splice(currentIndex, 1, toTheIndexOfAgent);
    // console.log("Removed: ", removed);

    //newOrder.splice(insertPosition, 0, removed);
    console.log("New order: ", newOrder);

    setCustomAgentSet(newOrder);
  };

  return (
    <div
      className={cn(
        "grid grid-cols-12 grid-rows-12 gap-2 h-[calc(100vh-2rem)] w-full p-0",
        agentActive ? "bg-green-500/70" : "",
        orchStatus === "paused" ? "bg-red-500/70" : "",
        orchStatus === "runone" ? "bg-yellow-500/70" : "",
        orchStatus === "free" ? "" : ""
      )}
    >
      <div className="h-full col-span-12 row-span-11 ">
        <ResizablePanelGroup
          direction="horizontal"
          //className="md:min-w-[450px] h-[500px]"
          //className="max-w-md rounded-lg border md:min-w-[450px]"
        >
          <ResizablePanel defaultSize={30} minSize={30}>
            <div
              className={cn(
                " bg-indigo-500/20 rounded-sm border border-gray-200 p-1 h-[89vh] overflow-y-scroll pb-6?"
              )}
            >
              {/* <h2 className={cn("text-sm font-semibold mb-4 text-gray-800")}>Chat</h2> */}
              <AgentChat2
                currentConversation={currentConversation}
                setCurrentConversation={
                  updateMessages as (
                    messages: ServerMessage[] | Message[]
                  ) => void
                }
                index={currentAgentIndex}
                handleSubmit={submitChat}
                inputChanged={agentGlobalChatInputChanged}
                allAgents={localState.currentAgents.agents}
                setIndex={handleChangeIndex}
                localState={localState}
                setConversationHistory={changeMessageHistory}
                clearMessages={handleClearMessages}
                className={""}
                conversationHistory={converationsForDay}
                externalInput={agentGlobalChatInput}
                setExternalInput={agentGlobalChatInputChanged}
                //handleMessageComponentChange={() => {}}
                agentOrder={agentOrder}
                setAgentOrder={setAgentOrder}
                rounds={rounds}
                setRounds={setRounds}
                maxRounds={maxRounds}
                setMaxRounds={setMaxRounds}
                orchestrationMode={orchestrationMode}
                setOrchestrationMode={setOrchestrationMode}
                agentActive={agentActive}
                customAgentSet={customAgentSet}
                setOrRemoveCustomAgent={setOrRemoveCustomAgent}
                reOrderCustomAgent={reOrderCustomAgent}
                orchStatus={orchStatus}
                setOrchStatus={setOrchStatus}
                conversationHistoryDays={conversationHistory}
              />
              {/* Chat content goes here */}
            </div>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize={75} minSize={25}>
            <ResizablePanelGroup direction="vertical">
              <ResizablePanel
              //defaultSize={25}
              >
                <div
                  className={cn(
                    "bg-indigo-500/20 rounded-sm border h-full border-gray-200 p-1 overflow-y-auto"
                  )}
                >
                  <div
                    className={cn(
                      "flex items-center justify-between",
                      "bg-black/60"
                    )}
                  >
                    {/* <h2 className={cn("text-sm font-semibold text-gray-800")}>
                  Agents
                </h2> */}
                    <ACFramework
                      setMessages={updateMessages as (
                        messages: ServerMessage[] | Message[] | ClientMessage[] | HumanMessage[] | AIMessage[]
                      ) => void}
                      stateLoaded={stateLoaded}
                      contextSet={contextSet}
                      currentAgentIndex={currentAgentIndex}
                      handleChangeIndex={handleChangeIndex}
                      loadAgent={loadAgent}
                      setAgentActive={setAgentActive}
                      messages={currentConversation}
                      refreshAgentStates={refreshAgentStates}
                      localStateObject={localState}
                      setlocalStateObject={updateLocalState}
                      handlePromptTextToSet={handlePromptTextToSet}
                      inputChanged={agentGlobalChatInputChanged}
                      savedAgentStates={savedAgentStates}
                      saveAgentState={saveAgentState}
                      setCurrentAgentIndex={setCurrentAgentIndex}
                    />
                  </div>
                  {/* Agents content goes here */}
                </div>
              </ResizablePanel>
              <ResizableHandle />
              <ResizablePanel
                defaultSize={25}
                minSize={25}
                className="bg-slate-800/80 p-2 m-1"
              >
                <Tabs
                  //defaultValue="context"
                  defaultValue={agentActive ? "activity" : "context"}
                  className="w-full h-full bg-gray-800/70"
                  ref={fullscreenRef as React.RefObject<HTMLDivElement>}
                >
                  <div className="flex items-center justify-between">
                    <TabsList className="flex items-center justify-center bg-transparent text-xs py-0">
                      <TabsTrigger value="team">Team</TabsTrigger>
                      <TabsTrigger value="context">Context</TabsTrigger>
                      <TabsTrigger value="auto-gen">Auto-Gen</TabsTrigger>
                      <TabsTrigger value="activity">Activity</TabsTrigger>
                    </TabsList>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-gray-400 hover:text-gray-300 mr-2"
                      onClick={toggleFullscreen}
                      title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                    >
                      {isFullscreen ? (
                        <Minimize2 className="w-4 h-4" />
                      ) : (
                        <Maximize2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <div className="relative">
                    {/* Keep LogViewer always mounted but control visibility */}
                    <div className="absolute inset-0 z-0">
                      <LogViewer
                        defaultFlowDirection="bottom-to-top"
                        themeColor="gray"
                      />
                    </div>
                    {/* Layer tab content on top */}
                    <TabsContent
                      value="team"
                      className="bg-slate-800 h-[calc(100vh-10rem)] p-1 overflow-y-auto relative z-10"
                    >
                      <div className="flex flex-col h-full">
                        <TeamConfig
                        //agents={localState.currentAgents.agents}
                        />
                      </div>
                    </TabsContent>
                    <TabsContent
                      value="context"
                      className="bg-slate-800 h-[calc(100vh-10rem)] p-1 overflow-y-auto relative z-10"
                    >
                      <ContextSetComponent
                        inputContextSet={contextSet}
                        currentContextSetItem={currentContextSetItem}
                        setCurrentContextSetItem={setCurrentContextSetItem}
                        allAgents={localState.currentAgents.agents}
                        contextSetStore={contextSetStore}
                        setContextSetStore={setContextSetStore}
                        handleDeleteTextFromSet={handleDeleteTextFromSet}
                        loadContextSet={handleLoadContextSet}
                        saveContextSet={handleSaveContextSet}
                        handleSetsChanged={() => {}}
                        themeColor="gray"
                      />
                    </TabsContent>
                    <TabsContent
                      value="auto-gen"
                      className={cn(
                        "relative z-10 min-h-[300px] p-1 pb-80 overflow-y-auto bg-slate-800",
                        "h-[calc(100vh-10rem)] "
                        //"h-1/2"
                      )}
                    >
                      {/* Always render something in this tab even if autoGenWorkflow is null */}
                      {true ? (
                        <AutogenComponent 
                          automationProcess={automationProcess}
                          setAutomationProcess={setAutomationProcess}
                          teamName={teamName}
                          setTeamName={setTeamName}
                          teamObjective={teamObjective}
                          setTeamObjective={setTeamObjective}
                          workflowModifications={workflowModifications}
                          setWorkflowModifications={setWorkflowModifications}
                          modificationText={modificationText}
                          setModificationText={setModificationText}
                          autoGenWorkflow={autoGenWorkflow}
                          setAutoGenWorkflow={setAutoGenWorkflow}
                          modificationStore={modificationStore}
                          setModificationStore={setModificationStore}
                          workflowModified={workflowModified}
                          setWorkflowModified={setWorkflowModified}
                          saveDialogOpen={saveDialogOpen}
                          setSaveDialogOpen={setSaveDialogOpen}
                          savedWorkflows={savedWorkflows}
                          setSavedWorkflows={setSavedWorkflows}
                          workflowName={workflowName}
                          setWorkflowName={setWorkflowName}
                        />
                        ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                          <p className="mb-4">No AutoGen workflow active</p>
                          <Button
                            variant="outline"
                            className="bg-indigo-900/30 hover:bg-indigo-700/30"
                            onClick={() => {
                              setAutoGenWorkflow(null);
                            }}
                          >
                            Create New Workflow
                          </Button>
                        </div>
                      )}
                    </TabsContent>
                    <TabsContent
                      value="activity"
                      className="relative z-10 min-h-[300px] h-[calc(100vh-10rem)] overflow-y-auto bg-slate-800/80"
                    >
                      <LogViewer
                        messages={logMessages}
                        clear={clearLogMessages}
                        defaultFlowDirection="bottom-to-top"
                        themeColor="gray"
                      />
                    </TabsContent>
                  </div>
                </Tabs>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
        <div className="w-full mt-1 bg-slate-700/80 p-1 rounded-sm opacity-10 hover:opacity-100 transition-opacity duration-300">
          <div className="flex items-center justify-center gap-4 w-2/3 mx-auto h-full? col-span-12 row-span-1  rounded-sm border? border-gray-200 p-1 bg-black/30">
            <Button
              variant="outline"
              className="w-full p-1 text-xs bg-gradient-to-r from-indigo-700/70  via-violet-950/70 to-violet-700/70 mix-blend-color-dodge text-indigo-300"
              onClick={saveGlobalState}
            >
              Save Global State
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full p-1 text-xs bg-gradient-to-r from-indigo-700/70  via-violet-950/70 to-violet-700/70 mix-blend-color-dodge text-indigo-300"
                >
                  Delete States
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full bg-black/50 backdrop-blur-2xl">
                <div className="flex flex-col gap-1 items-start p-2 text-sm max-h-[400px] overflow-y-auto w-full">
                  <Button
                    variant="outline"
                    className="mt-1 flex justify-between items-center w-full p-1 text-xs bg-gradient-to-r from-red-950/70 via-red-800/70 to-red-700/70 mix-blend-color-dodge text-red-300 hover:bg-red-900/50"
                  >
                    -------
                  </Button>
                  {frozenStates &&
                    frozenStates.length > 0 &&
                    frozenStates.map((gs, i) => (
                      <Button
                        key={i}
                        variant="outline"
                        className="flex justify-between items-center w-full p-1 text-xs bg-gradient-to-r from-red-950/70 via-red-800/70 to-red-700/70 mix-blend-color-dodge text-red-300 hover:bg-red-900/50"
                        onClick={async () => {
                          if (
                            confirm(
                              "Are you sure you want to delete this state?"
                            )
                          ) {
                            await deleteFrozenGlobalState(gs.id);
                            await loadAllFrozenStateNames();
                            toast({
                              title: "State Deleted",
                              description: `Successfully deleted state "${gs.name}"`,
                            });
                          }
                        }}
                      >
                        <span>{gs.name}</span>
                        <XIcon className="h-4 w-4 ml-2" />
                      </Button>
                    ))}
                </div>
              </PopoverContent>
            </Popover>
            <Button
              variant="outline"
              className="w-full p-1 text-xs bg-gradient-to-r from-indigo-700/70  via-violet-950/70 to-violet-700/70 mix-blend-color-dodge text-indigo-300"
              onClick={() => {
                console.log("Current frozen states:", frozenStates);
                console.log("Current orchestration settings:", orchestrationMode);
                console.log("Current agent order:", agentOrder);
                console.log("Current rounds:", rounds);
                console.log("Current max rounds:", maxRounds);
                console.log("Current custom agent set:", customAgentSet);
                console.log("Current local state:", localState);
                console.log("Current server messages:", currentConversation);
                console.log("Current context set:", contextSet);
                console.log("Current context set store:", contextSetStore);
                console.log("Curent Agent Index: ", currentAgentIndex);
                console.log("Agent Active: ", agentActive);
                console.log("Agent Global Chat Input: ", agentGlobalChatInput);
              }}
            >
              Log All States
            </Button>
            <Select
              onValueChange={async (value) => {
                await loadFrozenGlobalState(Number(value));
              }}
            >
              <SelectTrigger className="w-full p-1 text-xs text-center bg-gradient-to-r from-indigo-700/70  via-violet-950/70 to-violet-700/70 mix-blend-color-dodge text-indigo-300">
                <SelectValue placeholder="Select a global state" />
              </SelectTrigger>
              <SelectContent>
                {frozenStates.map((af, i: number) => (
                  <SelectItem
                    key={i}
                    value={String(af.id)}
                    // onContextMenu={async (e) => {
                    //   e.preventDefault();
                    //   if (confirm("Are you sure you want to delete this global state?")) {
                    //     await deleteFrozenGlobalState(af.id);
                    //     await loadAllFrozenStateNames();
                    //   }
                    // }}
                  >
                    <div className="w-full flex items-center justify-between">
                      <p>{af.name}</p>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}
