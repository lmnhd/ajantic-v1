import React, { useEffect, useState, useCallback } from "react";

import { useGlobalStore } from "@/src/lib/store/GloabalStoreState";
import { ExitIcon, PlusCircledIcon } from "@radix-ui/react-icons";
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
  OrchestrationType,
  ServerMessage, // Ensure this type is defined in ajantic/lib/types
} from "@/src/lib/types";
import { Button } from "@/components/ui/button";
import { useChat } from "ai/react";
import { useActions } from "ai/rsc";
import { useToast } from "@/components/ui/use-toast";
import { BlockLyricType } from "@/components/songeditor/lyric/block"; // Likely remove or replace
import {
  ArrowDownWideNarrowIcon,
  ArrowRightCircle,
  ArrowUpWideNarrowIcon,
  Bot,
  BotIcon,
  BoxIcon,
  HammerIcon,
} from "lucide-react";


import {
  Link as ScrollLink, // Renamed to avoid conflict
  Button as ScrollButton,
  Element,
  Events,
  animateScroll as scroll,
  scrollSpy,
  scroller,
} from "react-scroll";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PromptWindowControl from "@/components/promptwindocontrol"; // Placeholder
// Removed Server import from "http"
//import { ServerMessage } from "@/lib/types"; // Already imported
import TextStream from "@/components/global/text-stream"; // Needs migration
import MessageActionBar from "@/components/message-action-bar"; // Placeholder
import {
  CONVERSATION_getById,
  CONVERSATION_loadByDay,
} from "@/src/lib/conversation"; // Needs migration/refactor
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/src/lib/utils";
import { OrchestrationType2 } from "@/src/lib/orchestration/types/base";

// Component to recursively display nested sub-messages
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
        <AccordionTrigger className="hover:no-underline p-1 text-left">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-pink-300">
              {message.agentName || message.content.split(":")[0].replaceAll("**From ", "")}
            </span>
            <ArrowRightCircle className="w-4 h-4 text-pink-300 flex-shrink-0" />
            <span className="text-indigo-400 truncate">
              {message.role || "Unknown Role"}
            </span>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="pl-4 py-2 space-y-4">
            <p className="text-sm text-violet-400 whitespace-pre-wrap break-words">{message.content}</p>
            {message.subMessages?.length > 0 && (
              <div className="pl-4 border-l border-indigo-500/30 space-y-2">
                <div className="flex items-center gap-2 text-xs text-indigo-400">
                  <HammerIcon className="w-3 h-3" />
                  <span>Interacting with: </span>
                  {[...new Set(message.subMessages.map(sm => sm.agentName).filter(Boolean))]
                    .map((name, i) => (
                      <span key={i} className="font-semibold">
                        {name}
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

// Component to display the top-level accordion for agent interactions
const TopLevelSubMessages = ({ message }: { message: ServerMessage }) => {
  if (!message.subMessages || message.subMessages.length === 0) return null;

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="top-level-submessages" className="border-none">
        <AccordionTrigger className="hover:no-underline p-1 text-left">
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

interface AJMessageComponentProps {
  messages: ServerMessage[];
  setMessages: (messages: ServerMessage[]) => void;
  clearMessages?: () => void;
  conversationHistory?: { id: number; dayName: string }[];
  setConversationHistory?: (dayName: string) => void;
  userId: string;
  conversationHistoryNames?: string[];
  promptTextToSet?: (text: string) => void;
  agentIndex?: number;
  isFullscreen?: boolean;
  orchestrationMode?: OrchestrationType2;
  className?: string;
}

export default function AJMessageComponent({
  messages,
  setMessages,
  clearMessages,
  conversationHistory,
  setConversationHistory,
  userId,
  conversationHistoryNames,
  promptTextToSet,
  agentIndex,
  className,
  isFullscreen = false,
  // freeFlowMessages = false, // Replaced by orchestrationMode
  // teamChat = false, // No longer used directly
  orchestrationMode = OrchestrationType2.DIRECT_AGENT_INTERACTION, // From store
}: AJMessageComponentProps) {
  const [messageHistoryIndex, setMessageHistoryIndex] = useState<number>(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDayName, setSelectedDayName] = useState<string | undefined>(undefined);
  const { toast } = useToast();
  const { appState } = useGlobalStore(); // Removed setAppState if not used

  useEffect(() => {
    if (messageHistoryIndex >= 0 && conversationHistory && messageHistoryIndex < conversationHistory.length) {
      setSelectedDayName(conversationHistory[messageHistoryIndex].dayName);
    } else {
      setSelectedDayName(undefined);
    }
  }, [messageHistoryIndex, conversationHistory]);

  const handleLoadConversation = useCallback(
    async (id: string) => {
      console.log("!!!_ID_MESSAGESCOMPONENT2.TSX!!!", id);
      if (!id) return;

      const targetId = parseInt(id);
      const newIndex = conversationHistory?.findIndex(conv => conv.id === targetId) ?? -1;

      if (newIndex === -1) {
        console.error("Conversation ID not found in history:", targetId);
        toast({ title: "Error", description: "Selected conversation not found in current history.", variant: "destructive" });
        return;
      }

      console.log("Loading conversation by ID:", targetId, "at index:", newIndex);
      setIsLoading(true);
      try {
        const _queryResult = await CONVERSATION_getById({ id: targetId });
        if (_queryResult) {
          const _messages: ServerMessage[] = JSON.parse(_queryResult);
          setMessages(_messages);
          setMessageHistoryIndex(newIndex);
        } else {
          toast({ title: "Error", description: "Conversation not found.", variant: "destructive" });
          setMessages([]);
        }
      } catch (error) {
        console.error("Error loading conversation:", error);
        toast({ title: "Error", description: "Failed to load conversation.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    },
    [conversationHistory, setMessages, setIsLoading, setMessageHistoryIndex, toast]
  );

  const loadHistory = useCallback(
    async (dayName: string) => {
        console.log("Loading conversation history for day:", dayName);
        if (!dayName) return; // Prevent loading if empty value selected
        setSelectedDayName(dayName);
        setIsLoading(true);
        try {
            if (setConversationHistory) {
                await setConversationHistory(dayName); // Trigger store action
            }
            setMessageHistoryIndex(-1);
        } catch (error) {
            console.error("Error loading history:", error);
            toast({ title: "Error", description: "Failed to load conversation history.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    },
    [setConversationHistory, toast]
  );

  // History navigation
  const incrementMessageHistoryIndex = () => {
    if (messageHistoryIndex < (conversationHistory?.length ?? 0) - 1) {
      const nextIndex = messageHistoryIndex + 1;
      handleLoadConversation(conversationHistory?.[nextIndex]?.id.toString() ?? "");
    }
  };

  const decrementMessageHistoryIndex = () => {
    if (messageHistoryIndex >= 0) {
      const prevIndex = messageHistoryIndex - 1;
      if (prevIndex >= 0) {
        handleLoadConversation(conversationHistory?.[prevIndex]?.id.toString() ?? "");
      } else {
        setMessageHistoryIndex(-1);
      }
    }
  };

  // Scroll to bottom effect
  useEffect(() => {
    scroll.scrollToBottom({ containerId: "messages-container", duration: 250, smooth: true });
  }, [messages.length]);

  return (
    <div className={cn("flex flex-col w-full h-full bg-black/50 rounded-lg border-l-[1px] overflow-y-auto overflow-x-hidden group", className)}>
      <Collapsible defaultOpen={false} className={cn(
        "flex flex-col w-full gap-2 p-2 bg-gray-900/30 border-b border-gray-800",
        "opacity-50 hover:opacity-100 transition-opacity"
      )}>
        <CollapsibleTrigger className="text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 text-center py-1">
          message options
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="flex flex-col gap-2 w-full pt-2">
             {messages && messages.length > 0 && (
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800/50 flex items-center justify-center gap-1"
                    onClick={clearMessages}
                >
                    Clear messages <ExitIcon className="w-3 h-3 text-red-400" />
                </Button>
            )}
            <Select
                onValueChange={handleLoadConversation}
                value={messageHistoryIndex >= 0 ? conversationHistory?.[messageHistoryIndex]?.id.toString() ?? "" : ""}
                disabled={isLoading}
              >
                <SelectTrigger className="w-full text-xs bg-gray-800/30 h-8">
                  <SelectValue placeholder="Load Conversation" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 text-gray-200 border-gray-600">
                     {conversationHistory?.map((hist, i) => (
                        <SelectItem key={hist.id} value={hist.id.toString()} className="text-xs">
                            {hist.dayName} (ID: {hist.id})
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <div className="flex justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 h-8 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
                onClick={decrementMessageHistoryIndex}
                disabled={messageHistoryIndex <= 0 || isLoading}
              >
                <ArrowUpWideNarrowIcon className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 h-8 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800/50"
                onClick={incrementMessageHistoryIndex}
                disabled={messageHistoryIndex >= (conversationHistory?.length ?? 0) - 1 || isLoading}
              >
                <ArrowDownWideNarrowIcon className="w-3 h-3" />
              </Button>
            </div>

            <Select
                onValueChange={loadHistory}
                value={selectedDayName || ""}
                disabled={isLoading}
              >
                <SelectTrigger className="w-full text-xs bg-gray-800/30 h-8">
                  <SelectValue placeholder="Load History Day" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 text-gray-200 border-gray-600">
                    {conversationHistoryNames && conversationHistoryNames.length > 0 ? (
                       conversationHistoryNames.map((dayName, i) => (
                        <SelectItem key={i} value={dayName} className="text-xs">
                            {dayName}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="text-xs text-gray-500 p-2">No history found</div>
                    )}
                </SelectContent>
            </Select>

          </div>
        </CollapsibleContent>
      </Collapsible>

      <Element
        id="messages-container"
        name="messages-container"
        className={cn(
          "flex flex-col w-full bg-gray-900/30 flex-grow overflow-y-auto overflow-x-hidden p-2 space-y-2",
          "h-full",
          { "opacity-50": isLoading }
        )}
      >
        {messages && messages.map((m, index) => (
           <Element
            name={`message-${index}`}
            key={index}
             className={cn(
              "flex flex-col w-full gap-1 rounded p-2 text-sm",
              m.role === "user" ? "bg-gray-800/30" : "bg-gray-700/30",
              "relative"
            )}
          >
            <MessageActionBar
              m={m as ServerMessage}
              messages={messages as ServerMessage[]}
              setMessages={setMessages}
              agentIndex={agentIndex ?? 0}
              userId={userId}
              promptTextToSet={promptTextToSet ?? (() => {})}
            />

            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-xs font-medium",
                  m.role === "user" ? "text-gray-300" : "text-gray-400"
                )}
              >
                {m.role === "user"
                  ? `${appState.currentUser?.firstName || 'User'}:`
                  : (m as ServerMessage).agentName
                  ? `${(m as ServerMessage).agentName}:`
                  : "AI:"}
              </span>
               {m.role !== 'user' && <BotIcon className="w-3 h-3 text-indigo-400" />}
            </div>

            <div
              className={cn(
                "whitespace-pre-wrap overflow-x-hidden max-w-full break-words text-sm",
                 m.role === 'user' ? 'text-gray-300' : 'text-gray-400'
              )}
            >
               {(m as ServerMessage).content}
            </div>

            {(m as ServerMessage).subMessages && (m as ServerMessage).subMessages!.length > 0 && (
              <div className="mt-2 border-t border-gray-700 pt-1">
                <TopLevelSubMessages message={m as ServerMessage} />
              </div>
            )}
          </Element>
        ))}
        {isLoading && <div className="text-center text-gray-400 py-4">Loading history...</div>}
      </Element>
    </div>
  );
} 