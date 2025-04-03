import React, { useEffect, useState, useCallback } from "react";

import ReferenceStateView from "@/components/global/reference-stateview";
import { useGlobalStore } from "@/src/lib/store/GloabalStoreState";
import { LineLyricType } from "@/components/songeditor/lyric/line";
import { cn } from "@/src/lib/utils";
import { ExitIcon, PlusCircledIcon } from "@radix-ui/react-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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
  AISessionState,
  AnalysisSet,
  
  ModelNames,
  ModelProvider,
  ModelProviderEnum,
} from "@/src/lib/types";
import { Button } from "@/components/ui/button";
import { useChat } from "ai/react";
import { useActions } from "ai/rsc";
import { useToast } from "@/components/ui/use-toast";
import { BlockLyricType } from "@/components/songeditor/lyric/block";
import {
  ArrowDownWideNarrowIcon,
  ArrowRightCircle,
  ArrowUpWideNarrowIcon,
  Bot,
  BotIcon,
  BoxIcon,
  HammerIcon,
} from "lucide-react";

import { set } from "zod";
import { CoreMessage, Message } from "ai";
import { Conversation, GeneralPurpose } from "@prisma/client";
import {
  ANALYSIS_TOOLS_generatePrompt,
  ANALYSIS_TOOLS_getAnalysisPrompts,
  ANALYSIS_TOOLS_getLastAnalysisMessages,
  ANALYSIS_TOOLS_getLastAnalysisModelName,
  ANALYSIS_TOOLS_quickSaveAnalysisPrompt,
  ANALYSIS_TOOLS_saveAnalysisMessages,
  ANALYSIS_TOOLS_storeLastAnalysisModelName,
} from "../src/lib/analysis_server";

import { AnthropicModelNames, AnthropicProps } from "@/src/app/api/model/anthropic";
import { MistralModelNames, MistralProps } from "@/src/app/api/model/mistral";
import { CohereModelNames, CohereProps } from "@/src/app/api/model/cohere";
import {
  GoogleGenerativeAIModelNames,
  GoogleGenerativeAIProps,
  //GoogleVertexModelNames,
  //GoogleVertexProps,
} from "@/src/app/api/model/google";
import {
  Link,
  Button as ScrollButton,
  Element,
  Events,
  animateScroll as scroll,
  scrollSpy,
  scroller,
} from "react-scroll";
import {
  SERVER_getPromptDirectives,
  SERVER_saveAsPrompt,
  SERVER_savePromptDirectives,
} from "@/src/lib/server";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PromptWindowControl from "./promptwindocontrol";
import { Server } from "http";
import { ServerMessage } from "@/src/lib/types";
import TextStream from "@/components/global/text-stream";
import MessageActionBar from "./message-action-bar";
import {
  CONVERSATION_getById,
  CONVERSATION_loadByDay,
} from "../src/lib/conversation";

const SubMessageAccordion = ({
  message,
  index,
}: {
  message: ServerMessage;
  index: number;
}) => {
  if (!message.subMessages || message.subMessages.length === 0) {
    return (
      <div className="pl-4 py-2 text-sm text-violet-400">{message.content}</div>
    );
  }

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value={`sub-${index}`} className="border-none">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-pink-300">
              {message.content.split(":")[0].replaceAll("**From ", "")}
            </span>
            <ArrowRightCircle className="w-4 h-4 text-pink-300" />
            <span className="text-indigo-400">
              {message.agentName ?? "Unknown"}
            </span>
          </div>
        </AccordionTrigger>

        <AccordionContent>
          <div className="pl-4 py-2 space-y-4">
            <p className="text-sm text-violet-400">{message.content}</p>

            {message.subMessages?.length > 0 && (
              <div className="pl-4 border-l border-indigo-500/30 space-y-2">
                <div className="flex items-center gap-2 text-xs text-indigo-400">
                  <HammerIcon className="w-3 h-3" />
                  <span>Interacting with: </span>
                  {message.subMessages
                    .filter((s) => !message.content.includes(s.agentName ?? ""))
                    .map((s, i) => (
                      <span key={i} className="font-semibold">
                        {s.agentName}
                      </span>
                    ))}
                </div>
                {message.subMessages.map((subMessage, idx) => (
                  <SubMessageAccordion
                    key={idx}
                    message={subMessage}
                    index={idx}
                  />
                ))}
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

const TopLevelSubMessages = ({ message }: { message: ServerMessage }) => {
  if (!message.subMessages || message.subMessages.length === 0) return null;

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="top-level-submessages" className="border-none">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-2 text-sm">
            <BotIcon className="w-4 h-4 text-indigo-400" />
            <span className="text-indigo-400">Agent Interactions</span>
            <span className="text-xs text-indigo-400/70">
              ({message.subMessages.length})
            </span>
          </div>
        </AccordionTrigger>

        <AccordionContent>
          <div className="pl-4 space-y-4">
            {message.subMessages.map((subMessage, idx) => (
              <SubMessageAccordion key={idx} message={subMessage} index={idx} />
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

export default function MessagesComponent({
  messages,
  setMessages,
  setConversationHistory,
  conversationHistory,
  conversationHistoryNames,
  promptTextToSet,
  agentIndex,
  clearMessages = () => {},
  isFullscreen = false,
  freeFlowMessages = false,
}: {
  messages: ServerMessage[] | Message[];
  setMessages: (messages: ServerMessage[] | Message[]) => void;
  setConversationHistory: (dayName: string) => void;
  conversationHistory: { id: number; dayName: string }[];
  conversationHistoryNames: string[];
  promptTextToSet: (text: string) => void;
  agentIndex?: number;
  clearMessages?: () => void;
  isFullscreen?: boolean;
  freeFlowMessages?: boolean;
}) {
  const [messageLength, setMessageLength] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { appState, setAppState } = useGlobalStore();

  const loadConversation = async (id: string) => {
    console.log("!!!LOAD_CONVERSATION_MESSAGESCOMPONENT.TSX!!!", id);
    const _queryResult = await CONVERSATION_getById({
      id: parseInt(id),
    });
    const _messages: ServerMessage[] = JSON.parse(_queryResult!);
    console.log("!!!_MESSAGES_MESSAGESCOMPONENT.TSX!!!", _messages);
    setMessages(_messages);
    setIsLoading(false);
  };

  const loadHistory = useCallback(
    async (newIndex: number) => {
      if (newIndex >= 0 && newIndex < conversationHistory.length) {
        const id = conversationHistory[newIndex].id.toString();
        console.log("Loading conversation:", id);
        setIsLoading(true);
        try {
          await loadConversation(id);
          setMessageHistoryIndex(newIndex);
        } finally {
          setIsLoading(false);
        }
      }
    },
    [conversationHistory, loadConversation]
  );

  const incrementMessageHistoryIndex = () => {
    const newIndex = messageHistoryIndex + 1;
    loadHistory(newIndex);
  };

  const decrementMessageHistoryIndex = () => {
    const newIndex = messageHistoryIndex - 1;
    loadHistory(newIndex);
  };

  const [messageHistoryIndex, setMessageHistoryIndex] = useState(0);

  React.useEffect(() => {
    setIsLoading(false);
  }, [conversationHistory]);

  // React.useEffect(() => {
  //   if (
  //     !isLoading &&
  //     messages.length > 0 &&
  //     messageLength !== messages.length &&
  //     messages[messages.length - 1].role === "assistant" &&
  //     // Only scroll if it's a new message, not a state update
  //     messages[messages.length - 1].content
  //   ) {
  //     setMessageLength(messages.length);
  //     // Only scroll if we're not in a state update
  //     if (!messages[messages.length - 1].data?.isStateUpdate) {
  //       scroller.scrollTo(`message-${messages.length - 1}`, {
  //         duration: 500,
  //         delay: 50,
  //         smooth: true,
  //         containerId: "ContainerElementID",
  //       });
  //     }
  //   }
  // }, [messages]);

  return isLoading ? (
    <div>Loading...</div>
  ) : (
    <div
      className={cn(
        "flex flex-col w-full h-full bg-black/50 rounded-lg border-l-[1px] overflow-y-auto overflow-x-hidden group"
      )}
    >
      {/* Controls at top */}
      <div
        className={cn(
          "flex w-full h-fit bg-black/30 mix-blend-screen rounded-lg border-l-[1px] overflow-y-auto",
          "opacity-5 group-hover:opacity-100"
        )}
      >
        {messages && messages.length > 0 && (
          <Button
            variant="outline"
            className="w-1/2 text-pink-300 bg-black/50? border-t border-pink-500"
            onClick={clearMessages || (() => {})}
          >
            Clear messages
          </Button>
        )}
        {/**Select switch for histories */}
        {true && (
          <Select
            onValueChange={async (v) => {
              const selectedId = parseInt(v);
              const historyIndex = conversationHistory.findIndex(
                (m) => m.id === selectedId
              );
              if (historyIndex !== -1) {
                await loadHistory(historyIndex);
              }
            }}
            onOpenChange={(v) => {
              //console.log("open", v);
            }}
          >
            <SelectTrigger className="w-full dark:bg-violet-500/30">
              <SelectValue placeholder="Message History" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>History</SelectLabel>
                {conversationHistory.map((m, i) => {
                  //console.log("Message Date => ", (m as ServerMessage).createdAt);
                  return (
                    <SelectItem key={i} value={m.id.toString()}>
                      {m.dayName + " " + (i + 1)}
                    </SelectItem>
                  );
                })}
                {/* <SelectItem value="apple">Apple</SelectItem>
            <SelectItem value="banana">Banana</SelectItem>
            <SelectItem value="blueberry">Blueberry</SelectItem>
            <SelectItem value="grapes">Grapes</SelectItem>
            <SelectItem value="pineapple">Pineapple</SelectItem> */}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
        {/**Stepper to increment or decrement message history */}
        {true && (
          <div className="flex flex-row">
            <Button
              variant="outline"
              className="bg-pink-500 text-white"
              onClick={() => {
                incrementMessageHistoryIndex();
              }}
            >
              <ArrowUpWideNarrowIcon className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              className="bg-blue-500 text-white"
              onClick={() => {
                decrementMessageHistoryIndex();
              }}
            >
              <ArrowDownWideNarrowIcon className="w-4 h-4" />
            </Button>
          </div>
        )}
        {true && (
          <Select
          onValueChange={async (v) => {
            console.log("selected", v);
            // const _daysConvos: { id: number; dayName: string }[] =
            //   await CONVERSATION_loadByDay({
            //     dayName: v,
            //     userId: appState.currentUser.id,
            //   });
            // console.log("!!!_ID_MESSAGESCOMPONENT.TSX!!!", _daysConvos);
            setConversationHistory(v);
          }}
          onOpenChange={(v) => {
            //console.log("open", v);
          }}
        >
          <SelectTrigger className="w-full dark:bg-violet-500/30">
            <SelectValue placeholder="Messages Date" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Messages Date</SelectLabel>
              {conversationHistoryNames.map((m, i) => {
                //console.log("Message Date => ", (m as ServerMessage).createdAt);
                return (
                  <SelectItem key={i} value={m}>
                    {m}
                  </SelectItem>
                );
              })}
              {/* <SelectItem value="apple">Apple</SelectItem>
          <SelectItem value="banana">Banana</SelectItem>
          <SelectItem value="blueberry">Blueberry</SelectItem>
          <SelectItem value="grapes">Grapes</SelectItem>
          <SelectItem value="pineapple">Pineapple</SelectItem> */}
            </SelectGroup>
          </SelectContent>
        </Select>
        )}
      </div>

      {/* Messages container */}
      <Element
        id="ContainerElementID"
        name="ContainerElementID"
        className={cn(
          "flex flex-col w-full bg-black/50 rounded-lg border-l-[1px] overflow-y-auto overflow-x-hidden p-4 space-y-4",
          isFullscreen ? "h-full" : freeFlowMessages ? "h-full" : "h-96"
        )}
      >
        {messages &&
          messages.map((m, i) => (
            <Element
              name={`message-${i}`}
              key={i}
              className={cn(
                "flex flex-col w-full gap-2 rounded-lg p-4",
                m.role === "user" ? "bg-violet-500/10" : "bg-gray-500/10"
              )}
            >
              <MessageActionBar
                m={m as ServerMessage}
                messages={messages as ServerMessage[]}
                setMessages={setMessages}
                agentIndex={agentIndex ?? 0}
                userId={appState.currentUser.id}
                promptTextToSet={promptTextToSet}
              />
              {/* Message header with role/name */}
              <div className="flex items-center gap-2 my-2">
                <span
                  className={cn(
                    "font-semibold",
                    m.role === "user" ? "text-blue-300" : "text-blue-500"
                  )}
                >
                  {m.role === "user"
                    ? `${appState.currentUser.firstName}:`
                    : (m as ServerMessage).agentName
                    ? `${(m as ServerMessage).agentName}:`
                    : "AI:"}
                </span>
              </div>

              {/* Main message content */}
              <div
                className={cn(
                  "whitespace-pre-wrap overflow-x-hidden max-w-full break-words",
                  m.role === "user" ? "text-violet-300" : "text-violet-500"
                )}
              >
                <TextStream
                  delay={200}
                  inputText={(m as ServerMessage).content}
                />
              </div>

              {/* Sub-messages section */}
              {(m as ServerMessage).subMessages &&
                (m as ServerMessage).subMessages!.length > 0 && (
                  <div className="mt-4">
                    <TopLevelSubMessages message={m as ServerMessage} />
                  </div>
                )}
            </Element>
          ))}
      </Element>
    </div>
  );
}
