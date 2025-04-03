"use client";

import { useEffect, useRef, useCallback, useReducer, useState } from "react";
import { Button } from "@/components/ui/button";
import { DragHandleDots2Icon, SpeakerLoudIcon } from "@radix-ui/react-icons";

import { cn } from "@/src/lib/utils";
import { UTILS_getGenericData, UTILS_isToolAgent } from "@/src/lib/utils"; // Needs migration
import { Howl } from "howler";
import { VOICES_extractTextAndCreateVoice } from "@/src/lib/voices/voices-db"; // Needs migration
import {
  AgentComponentProps,
  GlobalMessages,
  AgentTypeEnum,
  AgentVoice,
  ModelProviderEnum,
  ServerMessage,
  AISessionState,
  OrchestrationType,
} from "@/src/lib/types";
import { Conversation } from "@prisma/client"; // Assuming Prisma setup
import { toast } from "@/components/ui/use-toast";

import { Message } from "ai";
import { BotIcon, ExpandIcon, FullscreenIcon, SendIcon, TrashIcon } from "lucide-react";
import { useFullscreen } from "@/src/lib/hooks/useFullscreen"; // Placeholder
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import AJMessageComponent from "./aj-message-comp";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { storeCancellationFlag } from "@/src/lib/workflow/functions/message-handlers/orchestrated-chat/cancel-chat";
import { clearCancellationFlag, isChatCancelled } from "@/src/lib/workflow/functions/message-handlers/orchestrated-chat/cancel-chat";
import { ORCHESTRATION_PAUSE_clearFlag, ORCHESTRATION_PAUSE_continueChat, ORCHESTRATION_PAUSE_storeContinueFlag, ORCHESTRATION_PAUSE_storeFlag } from "@/src/lib/workflow/functions/message-handlers/orchestrated-chat/pause-chat";
import VoiceComponent from "@/src/lib/voice-message/voicecomponent";
 // Placeholder

type AgentChatProps = {
  currentConversation: ServerMessage[];
  rounds: number;
  maxRounds: number;
  setRounds: (rounds: number) => void;
  setMaxRounds: (maxRounds: number) => void;
  agentOrder: "sequential" | "seq-reverse" | "random" | "auto";
  setAgentOrder: (order: "sequential" | "seq-reverse" | "random" | "auto") => void;
  setCurrentConversation: (messages: ServerMessage[]) => void;
  index: number;
  handleSubmit: (e: React.FormEvent<HTMLFormElement> | { target: { value: string } }) => void;
  inputChanged: (input: string) => void;
  allAgents: AgentComponentProps[];
  setIndex: (index: number) => void;
  localState: AISessionState;
  setConversationHistory: (dayName: string) => void;
  clearMessages?: () => void;
  className?: string;
  conversationHistory?: { id: number; dayName: string }[];
   conversationHistoryDays?: string[];
  externalInput?: string;
  setExternalInput?: (input: string) => void;
  // handleMessageComponentChange?: () => void; // Removed as unused
  orchestrationMode: OrchestrationType;
  setOrchestrationMode: (mode: OrchestrationType) => void;
  agentActive: boolean;
  customAgentSet: string[];
  setOrRemoveCustomAgent: (agent: string) => void;
  reOrderCustomAgent: (changeAgent: string, toTheIndexOfAgent: string) => void;
  orchStatus: "paused" | "runone" | "free";
  setOrchStatus: (status: "paused" | "runone" | "free") => void;
};

type AgentChatState = {
  input: string;
  canSpeak: boolean;
  firstLoad: number;
  gradient: string;
  voiceMessageRecieved: number;
  sendImmediately: boolean;
  useSound: boolean;
  currentSound: Howl | null;
};

type AgentChatAction =
  | { type: "SET_INPUT"; payload: string }
  | { type: "SET_CAN_SPEAK"; payload: boolean }
  | { type: "SET_FIRST_LOAD"; payload: number }
  | { type: "SET_GRADIENT"; payload: string }
  | { type: "SET_VOICE_MESSAGE_RECEIVED"; payload: number }
  | { type: "SET_USE_SOUND"; payload: boolean }
  | { type: "SET_CURRENT_SOUND"; payload: Howl | null };

function agentChatReducer(
  state: AgentChatState,
  action: AgentChatAction
): AgentChatState {
  switch (action.type) {
    case "SET_INPUT":
      return { ...state, input: action.payload };
    case "SET_CAN_SPEAK":
      return { ...state, canSpeak: action.payload };
    case "SET_FIRST_LOAD":
      return { ...state, firstLoad: action.payload };
    case "SET_GRADIENT":
      return { ...state, gradient: action.payload };
    case "SET_VOICE_MESSAGE_RECEIVED":
      return { ...state, voiceMessageRecieved: action.payload };
    case "SET_USE_SOUND":
      return { ...state, useSound: action.payload };
    case "SET_CURRENT_SOUND":
      return { ...state, currentSound: action.payload };
    default:
      // Add exhaustive check if needed
      // const _: never = action;
      return state;
  }
}

export default function AgentChat2({
  currentConversation,
  setCurrentConversation,
  index,
  handleSubmit,
  inputChanged,
  allAgents,
  setIndex,
  localState,
  clearMessages,
  className,
  conversationHistory,
  conversationHistoryDays,
  setConversationHistory,
  externalInput,
  setExternalInput,
  // handleMessageComponentChange, // Removed
  agentOrder,
  setAgentOrder,
  rounds,
  maxRounds,
  setRounds,
  setMaxRounds,
  orchestrationMode,
  setOrchestrationMode,
  agentActive,
  customAgentSet,
  setOrRemoveCustomAgent,
  reOrderCustomAgent,
  orchStatus,
  setOrchStatus,
}: AgentChatProps) {
  const [state, dispatch] = useReducer(agentChatReducer, {
    input: "",
    canSpeak: false,
    firstLoad: 0,
    gradient: "", // Consider removing if unused
    voiceMessageRecieved: 0,
    sendImmediately: true,
    useSound: false,
    currentSound: null,
  });
  const [cancelWaiting, setCancelWaiting] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [freeFlowMessages, setFreeFlowMessages] = useState(false); // Consider removing if unused

  const _handleSubmit = (e: React.FormEvent<HTMLFormElement> | { target: { value: string } }) => {
    if ('preventDefault' in e) e.preventDefault();
    handleSubmit(e);
  };

  const [fullscreenRef, toggleFullscreen, isFullscreen] = useFullscreen();

  // TODO: Refactor voice logic or remove if not needed in ajantic
  const playAsVoice = useCallback(
    async (message: string, voice: AgentVoice | null) => {
      if (!voice || !state.useSound || !state.canSpeak) {
        return;
      }
      dispatch({ type: "SET_CAN_SPEAK", payload: false });
      try {
        const voiceURI = await VOICES_extractTextAndCreateVoice({ // Needs migration
          text: message,
          alwaysNewVoice: true,
          checkOnly: false,
        });
        if (typeof voiceURI !== "string") {
          console.warn("Failed to get voice URI");
          return;
        }
        const sound = new Howl({
          src: [voiceURI],
          onloaderror: (id, err) => console.error("Howl load error:", err),
          onplayerror: (id, err) => console.error("Howl play error:", err),
          onend: () => dispatch({ type: "SET_CAN_SPEAK", payload: true }) // Allow speaking again after finished
        });
        sound.play();
        dispatch({ type: "SET_CURRENT_SOUND", payload: sound });
      } catch (error) {
          console.error("Error playing voice:", error);
          dispatch({ type: "SET_CAN_SPEAK", payload: true }); // Allow speaking again on error
      }
    },
    [state.useSound, state.canSpeak]
  );

  // TODO: Refactor voice logic or remove if not needed
  const voiceMessagesToInput = useCallback(
    (message: string) => {
      console.log("AGENT_CHAT VoiceMessage to input...", message);
      const agentPrefix = (index >= 0 && allAgents?.[index]?.name) ? `${allAgents[index].name}::: ` : "";
      const newInput = `${agentPrefix}${message}`;
      
      setExternalInput?.(newInput);
      dispatch({ type: "SET_INPUT", payload: newInput });
      inputChanged(newInput);
    },
    [index, allAgents, setExternalInput, inputChanged]
  );

  // TODO: Review this logic - it might conflict with external input setting
  const inputCleared = useCallback(
    (clear: boolean) => {
      const agentPrefix = (index >= 0 && allAgents?.[index]?.name) ? `${allAgents[index].name}::: ` : "";
      const newValue = clear ? "" : agentPrefix;

      setExternalInput?.(newValue);
      dispatch({ type: "SET_INPUT", payload: newValue });
      inputChanged(newValue); // Ensure inputChanged is called
      setIndex(clear ? -1 : index); // Reset index if clearing fully

      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.value = newValue;
      }
    },
    [index, allAgents, setExternalInput, inputChanged, setIndex] // Added setIndex dependency
  );

 

  const _handleCancelChat = () => {
    if (agentActive) {
      storeCancellationFlag(); // Needs migration
      setCancelWaiting(true);
    }
  };

  // Pause/Resume Logic
  const _handlePauseChat = () => {
    if (agentActive) {
      ORCHESTRATION_PAUSE_storeFlag(); // Needs migration
      setOrchStatus("paused");
    }
  };

  const _handleUnpauseChat = () => {
    if (orchStatus === "paused") {
      ORCHESTRATION_PAUSE_clearFlag(); // Needs migration
      setOrchStatus("free");
    }
  };

  const _handlePausedNextMessage = () => {
    if (orchStatus === "paused") {
      ORCHESTRATION_PAUSE_storeContinueFlag(); // Needs migration
      setOrchStatus("runone");
    }
  };

  // Effect to monitor "runone" state and revert to "paused"
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    if (orchStatus === "runone") {
      intervalId = setInterval(() => {
        if (!ORCHESTRATION_PAUSE_continueChat()) { // Needs migration
          setOrchStatus("paused");
        }
      }, 500);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [orchStatus]);

  // Effect to handle new incoming messages (e.g., play voice)
  useEffect(() => {
    let mounted = true;

    const handleNewMessage = async () => {
      if (!mounted || !currentConversation || currentConversation.length === 0) return;

      const lastMessage = currentConversation[currentConversation.length - 1];
      if (!lastMessage || typeof lastMessage.content !== 'string') return;

      // inputCleared(false); // Reconsider if this should clear input on new message

      if (state.firstLoad < 2) {
        dispatch({ type: "SET_FIRST_LOAD", payload: state.firstLoad + 1 });
        return;
      }

      const agent = allAgents.find(a => a.name === (lastMessage as ServerMessage).agentName);
      if (agent?.voice && state.canSpeak && state.firstLoad >= 2) { // Changed condition to >= 2
        await playAsVoice(lastMessage.content, agent.voice);
      } else if (!agent?.voice) { // Allow speaking again if no voice
         dispatch({ type: "SET_CAN_SPEAK", payload: true });
      } else {
        // Increment firstLoad even if not speaking to avoid getting stuck
        dispatch({ type: "SET_FIRST_LOAD", payload: state.firstLoad + 1 });
      }
    };

    handleNewMessage();

    return () => {
      mounted = false;
      if (state.currentSound) {
        state.currentSound.stop();
      }
    };
    // Refined Dependencies: Trigger on length change, remove internal state dependencies.
  }, [currentConversation.length, allAgents.map(a => a.name).join(','), allAgents.length, playAsVoice, state.currentSound]);

  // Sync component input state with external input prop
  useEffect(() => {
    if (externalInput !== undefined && externalInput !== state.input) {
      dispatch({ type: "SET_INPUT", payload: externalInput });
      if (inputRef.current) {
        inputRef.current.value = externalInput;
      }
    }
  }, [externalInput]);

  // Effect to potentially prefix input based on agent selection in agent-orchestrator mode
  useEffect(() => {
    if (orchestrationMode === 'agent-orchestrator' && index >= 0 && allAgents?.[index]) {
        const agentPrefix = `${allAgents[index].name}::: `;
        if (!state.input.startsWith(agentPrefix)) {
            // Check if there's existing content after potentially incorrect prefix
            const parts = state.input.split(":::");
            const existingContent = parts.length > 1 ? parts[1].trim() : state.input.trim();
            const newInput = `${agentPrefix}${existingContent}`;
            
            dispatch({ type: "SET_INPUT", payload: newInput });
            setExternalInput?.(newInput);
            inputChanged(newInput); // Notify parent of change
            if (inputRef.current) {
                inputRef.current.value = newInput;
            }
        }
    } else if (orchestrationMode !== 'agent-orchestrator') {
        // In other modes, remove agent prefix if present
        const parts = state.input.split(":::");
        if (parts.length > 1) {
            const content = parts[1].trim();
            if (state.input !== content) {
                dispatch({ type: "SET_INPUT", payload: content });
                setExternalInput?.(content);
                inputChanged(content);
                 if (inputRef.current) {
                    inputRef.current.value = content;
                }
            }
        }
    }
  }, [index, allAgents.map(a => a.name).join(','), allAgents.length, orchestrationMode, state.input, setExternalInput, inputChanged]);

   // Cancellation Logic
   useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    if (cancelWaiting) {
      intervalId = setInterval(() => {
        if (isChatCancelled()) { // Needs migration
          clearCancellationFlag(); // Needs migration
          setCancelWaiting(false);
          toast({ title: "Chat cancelled", description: "The orchestrated chat was successfully stopped" });
        }
      }, 500);
    }
    return () => {
        if (intervalId) clearInterval(intervalId);
    };
  }, [cancelWaiting, toast]); // Added toast dependency

  // Memoize event handlers for orchestration controls
  const handleToggleMode = useCallback(() => {
    setOrchestrationMode(orchestrationMode === "agent-orchestrator" ? "wf-sequential-1" : "agent-orchestrator");
  }, [orchestrationMode, setOrchestrationMode]);

  const handleToggleAgentOrder = useCallback(() => {
    setAgentOrder(agentOrder === 'sequential' ? 'seq-reverse' : agentOrder === 'seq-reverse' ? 'random' : agentOrder === 'random' ? 'auto' : 'sequential');
  }, [agentOrder, setAgentOrder]);

  return (
    <div
      className={cn(
        "flex flex-col h-full overflow-hidden", // Use overflow-hidden here
        className,
        isFullscreen ? `bg-gray-800/90` : "bg-gray-900/50"
      )}
      ref={fullscreenRef as unknown as React.RefObject<HTMLDivElement>}
    >
      {/* Top Bar with Agent Selection/Info */}
      <div className="flex-shrink-0 flex items-center justify-between p-2 bg-gray-800/30 border-b border-gray-700">
         <p className="text-gray-300 text-sm truncate">
          {orchestrationMode === "agent-orchestrator" ? 
            (index >= 0 && allAgents?.[index] ? `Talking to: ${allAgents[index].name}` : "Select Agent") : 
            `Mode: ${orchestrationMode} (${customAgentSet.length > 0 ? `${customAgentSet.length} agents` : 'All Agents'})`
          }
        </p>
         <div className="flex items-center gap-1">
            {/* Removed free flow button */}
            <Button
                variant="ghost"
                size="sm"
                className="p-1 h-auto text-gray-400 hover:text-gray-300"
                onClick={toggleFullscreen}
                title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
                <FullscreenIcon className="w-3 h-3" />
            </Button>
         </div>
      </div>

       {/* Resizable Message/Input Area */}
      <ResizablePanelGroup direction="vertical" className="flex-grow">
        <ResizablePanel className="min-h-[100px]">
          <AJMessageComponent
            messages={currentConversation as ServerMessage[]} // Cast assumes ServerMessage structure
            setMessages={setCurrentConversation as (messages: ServerMessage[]) => void}
            clearMessages={clearMessages}
            conversationHistory={conversationHistory ?? []}
            setConversationHistory={setConversationHistory}
            userId={localState.userId}
            conversationHistoryNames={conversationHistoryDays ?? []}
            promptTextToSet={() => {}} // Placeholder - implement context adding
            agentIndex={index}
            isFullscreen={isFullscreen}
            orchestrationMode={orchestrationMode}

          />
        </ResizablePanel>
        <ResizableHandle className="bg-gray-700 h-[2px] hover:h-[4px] transition-all" />
        <ResizablePanel defaultSize={30} minSize={20} maxSize={60} className="flex-shrink-0">
          <div className="p-1 flex flex-col h-full bg-gray-800/40">
            {/* Orchestration Controls */}
             <div className="flex-shrink-0 flex flex-wrap items-center justify-between gap-1 p-1 text-xs border-b border-gray-700 mb-1">
              {agentActive ? (
                 <div className="flex items-center gap-1">
                    {orchStatus !== "paused" && <Button variant="destructive" size="xs" onClick={_handleCancelChat}>Cancel</Button>}
                    {orchStatus !== "paused" && <Button variant="secondary" size="xs" onClick={_handlePauseChat}>Pause</Button>}
                    {orchStatus === "paused" && <Button variant="secondary" size="xs" onClick={_handlePausedNextMessage}>Next Msg</Button>}
                    {orchStatus === "paused" && <Button variant="secondary" size="xs" onClick={_handleUnpauseChat}>Resume</Button>}
                 </div>
              ) : (
                 <div className="flex flex-wrap items-center gap-1">
                     {/* Mode Selector */}
                    <TooltipProvider delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="xs" onClick={handleToggleMode}>
                            {orchestrationMode}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top"><p>Toggle Mode</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {/* Rounds Selector (Conditional) */}
                    {orchestrationMode !== "agent-orchestrator" && agentOrder !== "auto" && (
                         <div className="flex items-center gap-1 rounded bg-gray-700/50 px-1">
                            <Button variant="ghost" size="xs" className="p-0 h-4 w-4" onClick={() => setRounds(Math.max(0, rounds - 1))}>-</Button>
                            <span className="w-3 text-center">{rounds === 0 ? "∞" : rounds}</span>
                            <Button variant="ghost" size="xs" className="p-0 h-4 w-4" onClick={() => setRounds(rounds + 1)}>+</Button>
                         </div>
                    )}
                    {/* Max Rounds (Conditional) */}
                    {orchestrationMode !== "agent-orchestrator" && agentOrder !== "auto" && rounds === 0 && (
                        <div className="flex items-center gap-1 rounded bg-gray-700/50 px-1">
                            <span className="text-gray-400 mr-1">Max:</span>
                            <Button variant="ghost" size="xs" className="p-0 h-4 w-4" onClick={() => setMaxRounds(Math.max(1, maxRounds - 1))}>-</Button>
                            <span className="w-4 text-center">{maxRounds}</span>
                            <Button variant="ghost" size="xs" className="p-0 h-4 w-4" onClick={() => setMaxRounds(maxRounds + 1)}>+</Button>
                        </div>
                    )}
                    {/* Agent Order Selector (Conditional) */}
                    {orchestrationMode !== "agent-orchestrator" && (
                        <TooltipProvider delayDuration={100}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="xs" onClick={handleToggleAgentOrder}>{agentOrder}</Button>
                             </TooltipTrigger>
                             <TooltipContent side="top"><p>Agent Order</p></TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                    )}
                    {/* Agent Selector Popover (Conditional) */}
                    {orchestrationMode !== "agent-orchestrator" && (
                       <Popover>
                          <PopoverTrigger asChild>
                              <Button variant="ghost" size="xs" className="text-gray-400 hover:text-gray-300">
                                <BotIcon className="w-3 h-3 mr-1" />
                                {customAgentSet.length === 0 ? "All" : customAgentSet.length}
                              </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-60 bg-gray-800 border-gray-700 p-2">
                              <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                                  <p className="text-xs text-gray-400 mb-1">Select agents for orchestration:</p>
                                  {allAgents
                                    .filter(agent => !agent.disabled && agent.type !== "manager")
                                    .map((agent) => (
                                      <div
                                        key={agent.name}
                                        draggable={customAgentSet.includes(agent.name)}
                                        className={cn(
                                          "flex items-center gap-2 p-1 rounded cursor-pointer text-xs",
                                          "hover:bg-gray-700/50 transition-colors",
                                          customAgentSet.includes(agent.name) ? "text-green-400 cursor-move" : "text-gray-300",
                                        )}
                                        onClick={() => setOrRemoveCustomAgent(agent.name)}
                                        onDragStart={(e) => { if (customAgentSet.includes(agent.name)) { e.dataTransfer.setData("agent", agent.name); e.currentTarget.classList.add('opacity-50'); } else { e.preventDefault(); }}}
                                        onDragEnd={(e) => e.currentTarget.classList.remove('opacity-50')}
                                        onDragOver={(e) => { if (customAgentSet.includes(agent.name)) { e.preventDefault(); e.currentTarget.classList.add('bg-gray-700/30'); }}}
                                        onDragLeave={(e) => e.currentTarget.classList.remove('bg-gray-700/30')}
                                        onDrop={(e) => {
                                          if (!customAgentSet.includes(agent.name)) return;
                                          e.preventDefault();
                                          e.currentTarget.classList.remove('bg-gray-700/30');
                                          const draggedAgent = e.dataTransfer.getData("agent");
                                          if (draggedAgent && draggedAgent !== agent.name) {
                                            reOrderCustomAgent(draggedAgent, agent.name);
                                          }
                                        }}
                                      >
                                        <DragHandleDots2Icon className="w-3 h-3 flex-shrink-0" />
                                        <span className="flex-grow truncate">{agent.name}</span>
                                        <Checkbox checked={customAgentSet.includes(agent.name)} className="w-3 h-3 flex-shrink-0" />
                                      </div>
                                    ))}
                              </div>
                          </PopoverContent>
                       </Popover>
                    )}
                 </div>
              )}
              {/* Sound & Clear Buttons */}
               <div className="flex-shrink-0 flex items-center gap-1">
                   <Button variant="ghost" size="xs" className={cn("p-1 h-5 w-5", !state.useSound && "text-red-400")} onClick={() => dispatch({ type: "SET_USE_SOUND", payload: !state.useSound })}> <SpeakerLoudIcon /> </Button>
                   {state.input && <Button variant="ghost" size="xs" className="p-1 h-5 w-5 text-red-400" onClick={() => inputCleared(true)}> <TrashIcon /> </Button>}
               </div>
            </div>

            {/* Text Input Area */}
            <form className="flex-grow flex flex-col" onSubmit={_handleSubmit}>
              <textarea
                ref={inputRef}
                className="flex-grow p-2 text-sm bg-transparent focus:outline-none placeholder-gray-500 resize-none"
                placeholder={orchestrationMode === 'agent-orchestrator' ? (index >=0 ? `Message ${allAgents[index].name}...` : "Select an agent") : "Enter initial message for orchestration..."}
                name="message"
                value={state.input} // Controlled component
                onChange={(e) => {
                  dispatch({ type: "SET_INPUT", payload: e.target.value });
                  setExternalInput?.(e.target.value);
                  inputChanged(e.target.value); // Ensure parent knows about changes
                }}
                onKeyDown={(e) => {
                   if (e.key === "Enter" && !e.shiftKey) { // Send on Enter, new line on Shift+Enter
                      e.preventDefault();
                      _handleSubmit({ target: { value: state.input } });
                   }
                }}
              />
               {/* Send Button & Voice Input */}
               {!agentActive && (
                   <div className="flex-shrink-0 flex items-center justify-end gap-1 p-1 border-t border-gray-700 mt-1">
                       <VoiceComponent
                           handleInputChange={() => {}} // Might not be needed
                           handleVoiceSubmit={voiceMessagesToInput}
                           useImmediateColor={state.sendImmediately} // Consider removing if unused
                       />
                       <Button
                           size="sm"
                           className="p-1 h-6 bg-purple-600 hover:bg-purple-700 text-white"
                           type="submit" // Changed to type submit
                           disabled={!state.input.trim()} // Disable if input is empty
                       >
                           <SendIcon className="w-3 h-3" />
                       </Button>
                   </div>
               )}
            </form>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
} 