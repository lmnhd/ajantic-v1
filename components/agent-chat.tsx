"use client";

import { useEffect, useRef, useCallback, useReducer, useState } from "react";
import MessagesComponent from "./messagescomponent";
import { Button } from "@/components/ui/button";
import { SpeakerLoudIcon } from "@radix-ui/react-icons";
import { useGlobalStore } from "@/src/lib/store/GloabalStoreState";
import { cn } from "@/src/lib/utils";
import { UTILS_getGenericData, UTILS_isToolAgent } from "@/src/lib/utils";
import { Howl } from "howler";
import { VOICES_extractTextAndCreateVoice } from "@/src/lib/voices/voices-db";
import {
  AgentComponentProps,
  GlobalMessages,
  AgentTypeEnum,
  AgentVoice,
  ModelProviderEnum,
  ServerMessage,
  //Message
} from "@/src/lib/types";
import { Conversation } from "@prisma/client";
import { toast } from "@/components/ui/use-toast";
import VoiceComponent from "../src/lib/voice-message/voicecomponent";
import { Message } from "ai";
import { ExpandIcon, FullscreenIcon } from "lucide-react";
import { useFullscreen } from "../src/lib/useFullscreen";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type AgentChatProps = {
  currentConversation: ServerMessage[] | Message[];
  setServerMessages: (messages: ServerMessage[] | Message[]) => void;
  index: number;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  inputChanged: (input: string) => void;
  allAgents: AgentComponentProps[];
  setIndex: (index: number) => void;
  globalMessages: GlobalMessages;
  setMessageHistory: (dayName: string) => void;
  clearMessages?: () => void;
  className?: string;
  messageHistory?: { id: number; dayName: string }[];
  messageHistoryNames?: string[];
  externalInput?: string;
  setExternalInput?: (input: string) => void;
  handleMessageComponentChange?: () => void;
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
      return state;
  }
}

export default function AgentChat({
  currentConversation,
  setServerMessages,
  index,
  handleSubmit,
  inputChanged,
  allAgents,
  setIndex,
  globalMessages,
  clearMessages,
  className,
  messageHistory,
  messageHistoryNames,
  setMessageHistory,
  externalInput,
  setExternalInput,
  handleMessageComponentChange,
}: AgentChatProps) {
  const [state, dispatch] = useReducer(agentChatReducer, {
    input: "",
    canSpeak: false,
    firstLoad: 0,
    gradient: "",
    voiceMessageRecieved: 0,
    sendImmediately: true,
    useSound: false,
    currentSound: null,
  });

  const { setGlobalMessages } = useGlobalStore();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sendButtonRef = useRef<HTMLButtonElement>(null);
  const { appState } = useGlobalStore();
  const [freeFlowMessages, setFreeFlowMessages] = useState(false);

  const _handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (e.preventDefault) e.preventDefault();
    handleSubmit(e);
    // dispatch({ type: 'SET_CAN_SPEAK', payload: true });
  };

  const [fullscreenRef, toggleFullscreen, isFullscreen] = useFullscreen();

  const playAsVoice = useCallback(
    async (message: string, voice: AgentVoice | null) => {
      if (!voice || !state.useSound || !state.canSpeak) {
        return;
      }
      dispatch({ type: "SET_CAN_SPEAK", payload: false });
      const voiceURI = await VOICES_extractTextAndCreateVoice({
        text: message,
        alwaysNewVoice: true,
        checkOnly: false,
      });
      if (typeof voiceURI !== "string") {
        return;
      }
      const sound = new Howl({
        src: [voiceURI],
      });
      sound.play();
      dispatch({ type: "SET_CURRENT_SOUND", payload: sound });
    },
    [state.useSound, state.canSpeak]
  );

  const voiceMessagesToInput = useCallback(
    (message: string) => {
      console.log("AGENT_CHAT VoiceMessage to input...", message);
      if (index >= 0 && allAgents && allAgents[index]) {
        let _input = `${allAgents[index].name}::: ${message}`;
        setExternalInput?.(_input);
        dispatch({ type: "SET_INPUT", payload: _input });
        inputChanged(_input);
      } else {
        let _input = message;
        setExternalInput?.(_input);
        dispatch({ type: "SET_INPUT", payload: _input });
        inputChanged(_input);
      }
    },
    [index, allAgents, setExternalInput, inputChanged]
  );

  const inputCleared = useCallback(
    (clear: boolean) => {
      if (clear && index >= 0 && allAgents && allAgents.length > 0) {
        setExternalInput?.("");
        dispatch({ type: "SET_INPUT", payload: "" });
        setIndex(-1);
      } else if (index >= 0 && allAgents && allAgents.length > 0) {
        setExternalInput?.(allAgents[index].name + "::: ");
        dispatch({
          type: "SET_INPUT",
          payload: allAgents[index].name + "::: ",
        });
      }
      if (inputRef.current && allAgents && allAgents.length > 0) {
        inputRef.current.focus();
        inputRef.current.value = clear ? "" : allAgents[index].name + "::: ";
      }
    },
    [allAgents]
  );

  useEffect(() => {
    let mounted = true;

    const handleNewMessage = async () => {
      if (!mounted) return;

      if (currentConversation && currentConversation.length > 0) {
        const _message = currentConversation[currentConversation.length - 1];
        if (!_message) return;

        inputCleared(false);
        if (state.firstLoad < 2) {
          dispatch({ type: "SET_FIRST_LOAD", payload: state.firstLoad + 1 });
          return;
        }

        const _agent = allAgents.find(
          (agent: AgentComponentProps) =>
            agent.name === (_message as ServerMessage).agentName
        );
        if (_agent && _agent.voice && state.canSpeak && state.firstLoad > 2) {
          await playAsVoice(_message.content as string, _agent.voice);
        } else {
          dispatch({ type: "SET_FIRST_LOAD", payload: state.firstLoad + 1 });
        }
      }
    };

    handleNewMessage();

    return () => {
      mounted = false;
      if (state.currentSound) {
        state.currentSound.stop();
      }
    };
  }, [currentConversation]);

  useEffect(() => {
    if (externalInput !== undefined) {
      dispatch({ type: "SET_INPUT", payload: externalInput });
      if (inputRef.current) {
        inputRef.current.value = externalInput;
      }
    }
  }, [externalInput]);

  useEffect(() => {
    if (inputRef.current) {
      console.log("AGENT_CHAT Input Ref: ", inputRef.current.value);
      const _msg = state.input.split(":::")[1];
      inputRef.current.value = allAgents[index].name + "::: " + _msg;
      // _handleSubmit({
      //   target: { value: state.input },
      // } as unknown as React.FormEvent<HTMLFormElement>);
    }
  }, [state.voiceMessageRecieved, state.input]);

  useEffect(() => {
    if (index >= 0 && allAgents && allAgents[index]) {
      // Only update if input is empty or doesn't match agent format
      const agentPrefix = `${allAgents[index].name}::: `;
      if (!state.input.startsWith(agentPrefix)) {
        setExternalInput?.(agentPrefix);
        dispatch({ type: "SET_INPUT", payload: agentPrefix });
      }
    }
  }, [index, allAgents]);

  return (
    <div
      className={cn(className, "h-full overflow-y-auto")}
      ref={fullscreenRef}
    >
      <div
        className={cn(
          "flex items-center p-2 z-10 col-span-4? row-span-6 mr-1 row-start-4? justify-center bg-blend-color-dodge w-full h-full  bg-violet-600/10 hover:bg-gradient-to-r hover:from-indigo-500 hover:via-violet-600 hover:to-indigo-500 transition-all duration-900 ease-linear"
        )}
      >
        <div className="w-full h-full bg-black/70 flex flex-col items-center justify-center">
          <div className="flex items-center justify-between w-full">
            <div className="flex flex-wrap md:w-3/4 overflow-x-scroll flex-row justify-center items-center gap-2 px-6 py-1">
              {allAgents &&
                allAgents.length > 0 &&
                allAgents.map((agent: AgentComponentProps, idx: number) => (
                  <Button
                    key={idx}
                    className={cn(
                      "border-b-2 bg-gradient-to-br? border-violet-700 border-l-2 bg-violet-600/50 rounded-md cursor-pointer hover:bg-indigo-600",
                      idx === index &&
                        "bg-pink-400  border-indigo-400 border-2 font-semibold inset-auto",
                      idx !== index && "bg-gradient-to-br",
                      agent.disabled && "hidden",
                      UTILS_isToolAgent(agent.type as AgentTypeEnum)
                        ? `${idx !== index ? "text-red-300" : "text-red-700"}`
                        : `${idx !== index ? "text-lime-300" : "text-lime-800"}`
                    )}
                    onClick={() => {
                      toast({
                        title: "Now talking to " + agent.name,
                        description: agent.name,
                      });
                      setIndex(idx);
                      dispatch({
                        type: "SET_INPUT",
                        payload: `${agent.name}:::`,
                      });
                      setExternalInput?.(`${agent.name}:::`);
                    }}
                  >
                    {agent.name}
                  </Button>
                ))}
            </div>
            <TooltipProvider>
              <div className="flex items-center justify-center text-blue-500">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setFreeFlowMessages(!freeFlowMessages)}
                >
                  <Tooltip>
                    <TooltipTrigger>
                      <ExpandIcon className="w-4 h-4" />
                    </TooltipTrigger>
                    <TooltipContent>
                      {freeFlowMessages
                        ? "Fixed Message Window"
                        : "Free Flow Messages"}
                    </TooltipContent>
                  </Tooltip>
                </Button>
                <Button variant="ghost" size="icon" onClick={toggleFullscreen}>
                  <Tooltip>
                    <TooltipTrigger>
                      <FullscreenIcon className="w-4 h-4" />
                    </TooltipTrigger>
                    <TooltipContent>Fullscreen</TooltipContent>
                  </Tooltip>
                </Button>
              </div>
            </TooltipProvider>
          </div>
          <MessagesComponent
            messages={currentConversation}
            // setMessages={() =>
            //   console.log("AGENT_CHAT Set Messages: ", currentConversation)
            // }
             setMessages={setServerMessages}
            clearMessages={clearMessages}
            messageHistory={messageHistory ?? []}
            messageHistoryNames={messageHistoryNames ?? []}
            setMessageHistory={setMessageHistory}
            promptTextToSet={() => {}}
            modelName={"gpt-4o-mini"}
            modelProviderName={ModelProviderEnum.OPENAI}
            temperature={0.5}
            agentIndex={index}
            stopCurrentSound={() => {
              if (state.currentSound) {
                if (state.currentSound.playing()) {
                  state.currentSound.stop();
                } else {
                  state.currentSound.play();
                }
              }
            }}
            handleMessageComponentChange={handleMessageComponentChange}
            freeFlowMessages={freeFlowMessages}
            isFullscreen={isFullscreen}
          />
        </div>
      </div>
      <div className="flex flex-row items-center justify-between gap-2">
        <VoiceComponent
          className={cn(
            "flex items-center px-4? py-2?",
            "bg-violet-600/30 hover:bg-violet-600/50",
            "border border-violet-400/30",
            "transition-colors duration-200",
            "rounded-sm"
          )}
          handleInputChange={() => {}}
          handleVoiceSubmit={voiceMessagesToInput}
          useImmediateColor={state.sendImmediately}
        />
        <Button
          className={cn(
            "flex items-center px-4 py-2",
            "bg-violet-600/30 hover:bg-violet-600/50",
            "border border-violet-400/30",
            "transition-colors duration-200",
            "rounded-sm",
            !state.useSound && "bg-red-500/20 hover:bg-red-500/40"
          )}
          variant="outline"
          onClick={() =>
            dispatch({ type: "SET_USE_SOUND", payload: !state.useSound })
          }
        >
          <SpeakerLoudIcon className="w-4 h-4" />
        </Button>
        <form
          className={cn(
            "flex grid-cols-12? items-center mx-2? justify-center w-full h-full"
          )}
          //onSubmit={_handleSubmit}
        >
          <textarea
            className={cn(
              "w-full col-start-2 col-span-8 p-2 h-full bg-indigo-800/50 rounded-md"
            )}
            rows={1}
            defaultValue={state.input}
            ref={inputRef}
            //type="text"
            placeholder="Talk to me!"
            name="message"
            onBlur={(e) => {
              // Preserve agent prefix if index is set
              const currentPrefix =
                index >= 0 && allAgents?.[index]?.name + "::: ";
              const newValue =
                currentPrefix && !e.target.value.startsWith(currentPrefix)
                  ? currentPrefix + e.target.value
                  : e.target.value;

              dispatch({ type: "SET_INPUT", payload: newValue });
              setExternalInput?.(newValue);
              inputChanged(newValue);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                _handleSubmit({
                  target: { value: state.input },
                } as unknown as React.FormEvent<HTMLFormElement>);
              }
            }}
          />
          {state.input && (
            <div className="flex justify-center items-center gap-2 p-2">
              <button
                className={cn(
                  "flex items-center px-4 py-2",
                  "bg-violet-600/30 hover:bg-violet-600/50",
                  "border border-violet-400/30",
                  "transition-colors duration-200",
                  "rounded-sm"
                )}
                type="button"
                onClick={() => {
                  _handleSubmit({
                    target: { value: state.input },
                  } as unknown as React.FormEvent<HTMLFormElement>);
                }}
              >
                Send
              </button>
              <button
                onClick={() => {
                  dispatch({
                    type: "SET_INPUT",
                    payload: state.input.split(":::")[0] + ":::",
                  });
                  setExternalInput?.(externalInput?.split(":::")[0] + ":::");
                  inputChanged(state.input.split(":::")[0] + ":::");
                  inputCleared(false);
                }}
                onDoubleClick={() => inputCleared(true)}
                className={cn(
                  "flex items-center px-4 py-2",
                  "bg-red-500/20 hover:bg-red-500/40",
                  "border border-red-400/30",
                  "transition-colors duration-200",
                  "rounded-sm"
                )}
                type="button"
              >
                Clear
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
