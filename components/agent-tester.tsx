import { cn } from "@/src/lib/utils";
import React, { useEffect, useState } from "react";
import MessagesComponent from "./messagescomponent";
import {
  AgentComponentProps,
  AISessionState,
  GlobalMessages,
  ModelArgs,
  ModelNames,
  ModelProviderEnum,
  ServerMessage,
} from "@/src/lib/types";
// import { ANALYSIS_TOOLS_agentTester } from "../analysis_server";
import { useActions, useAIState, useUIState } from "ai/rsc";

import { ClientMessage } from "@/src/lib/aicontext";
import AgentChat from "./agent-chat";
import { useGlobalStore } from "@/src/lib/store/GloabalStoreState";
import { Button } from "@/components/ui/button";

const AgentTester = ({
  index,

  currentState,
  setCurrentState,
  agentName,
  saveAgentState,
  // globalMessages,
  // setGlobalMessages,
  inputChanged,
}: {
  index: number;

  currentState: AISessionState;
  setCurrentState: (state: AISessionState) => void;
  agentName: string;
  saveAgentState: any;
  globalMessages: GlobalMessages;
  setGlobalMessages: (state: GlobalMessages) => void;
  inputChanged: (input: string) => void;
}) => {
  const [input, setInput] = useState("");

  const [clientMessages, setClientMessages] = useUIState();
  const [currentConversation, setServerMessages] = useAIState();
  const [messageLength, setMessageLength] = useState(0);
  const { appState, setAppState, globalMessages, setGlobalMessages } = useGlobalStore();
  //const { globalMessages, setGlobalMessages } = useGlobalStore();
  const { ANALYSIS_TOOLS_agentTester, ANALYSIS_TOOLS_agentTester2 } =
    useActions();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const message = formData.get("message") as string;
    console.log("message", message);

    console.log("Index", index);

    //return;
    console.log("history before update...", currentConversation);
    console.log("currentState", currentState);
    let newServerMessages = [
      ...currentConversation,
      {
        id: Date.now().toString(),
        role: "user",
        content: message,
        agentName: agentName,
        currentState: JSON.stringify(currentState),
      },
    ];
    setServerMessages(newServerMessages);
    //return;
    const test: {

      message: string;
    
      chatHistory: ServerMessage[];
    
      index: number;
    
      serializedState: string;
    
    } = await ANALYSIS_TOOLS_agentTester2({
      message: message,
      chatHistory: newServerMessages,
      index: index,

      serializedState: JSON.stringify({
        contextSet: currentState.contextSet,
        currentAgents: currentState.currentAgents,
        systemPrompt: currentState.currentAgents.agents[index].systemPrompt,
      }),
    } as {
      message: string;
      chatHistory: ServerMessage[];
      index: number;
      serializedState: string;
    });

    console.log("test", test);
    //return;

    newServerMessages = [
      ...newServerMessages,
      {
        id: Date.now().toString(),
        role: "assistant",
        content: test.message,
        agentName: agentName,
        currentState: test.serializedState,
      },
    ];
    console.log("NEW SERVER MESSAGES: ", newServerMessages);
    setServerMessages(newServerMessages);
   //return;
    const testCheck = JSON.parse(test.serializedState);
    console.log("testCheck", testCheck);
    console.log("message", test.message);
    

    // Update Line Sets, Current Agents, and System Prompt
    const newGlobalMessages = {
      ...globalMessages,
      currentState: {
        ...currentState,
        contextSets: testCheck.contextSets,
        currentAgents: testCheck.currentAgents,
        systemPrompt: testCheck.systemPrompt,
      },
    };
    setGlobalMessages(newGlobalMessages);
  };

  useEffect(() => {
    console.log("server messages: ", currentConversation);
    true &&
      currentConversation.length > 0 &&
      messageLength !== currentConversation.length &&
      currentConversation[currentConversation.length - 1].role === "assistant";

    console.log("messages changed", currentConversation);
    setMessageLength(currentConversation.length);
    saveAgentState();
  }, [currentConversation]);
  return (
    <div>
      
      <AgentChat
        currentConversation={currentConversation}
        setMessageHistory={() => {}}
        index={index}
        handleSubmit={handleSubmit}
        className={cn(
          "grid grid-rows-8 items-center? bg-dot-white? justify-center? mix-blend-hard-light w-[690px] h-[490px] bg-gradient-to-br from-violet-600/50 to-pink-400/10 rounded-md"
        )}
        inputChanged={inputChanged}
        // agentNames={
        //   globalMessages.currentState?.currentAgents.agents.map(
        //     (a) => a.name ?? ""
        //   ) ?? []
        // }
        setIndex={() => {}}
        globalMessages={globalMessages}
        setServerMessages={setServerMessages}
        allAgents={currentState.currentAgents.agents}
      />
    </div>
  );
};

export default AgentTester;
