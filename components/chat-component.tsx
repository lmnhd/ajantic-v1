import React, { useEffect } from "react";

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
  ContextContainerProps,
  
  ModelNames,
  ModelProvider,
  ModelProviderEnum,
} from "@/src/lib/types";
import { Button } from "@/components/ui/button";
import { useChat } from "ai/react";
import { useActions } from "ai/rsc";
import { useToast } from "@/components/ui/use-toast";
import { BlockLyricType } from "@/components/songeditor/lyric/block";
import { BoxIcon } from "lucide-react";

import { set } from "zod";
import { CoreMessage, Message } from "ai";
import { GeneralPurpose } from "@prisma/client";
import {
  ANALYSIS_TOOLS_generatePrompt,
  ANALYSIS_TOOLS_getAnalysisPrompts,
  ANALYSIS_TOOLS_getLastAnalysisMessages,
  ANALYSIS_TOOLS_getLastAnalysisModelName,
  ANALYSIS_TOOLS_quickSaveAnalysisPrompt,
  ANALYSIS_TOOLS_saveAnalysisMessages,
  ANALYSIS_TOOLS_storeLastAnalysisModelName,
} from "../src/lib/analysis_server";
import { OpenAIProps } from "@/src/app/api/model/openai";
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
import MessagesComponent from "./messagescomponent";

export default function ChatComponent({
  listSets,
  workingTitle,
  setWorkingTitle,
  index,
  promptTextToSet,
}: {
  listSets: ContextContainerProps[];
  workingTitle: string;
  setWorkingTitle: (title: string) => void;
  index: number;
  promptTextToSet: (text: string) => void;
}) {
  //ts-ignore

  const [modelProviderName, setModelProviderName] =
    React.useState<ModelProviderEnum>(ModelProviderEnum["OPENAI"]);

  const [modelName, setModelName] = React.useState<string>("gpt-3.5-turbo");

  const [temperature, setTemperature] = React.useState<number>(0.5);

  const [modelNameChanged, setModelNameChanged] =
    React.useState<boolean>(false);

  const [messageHistory, setMessageHistory] = React.useState<GeneralPurpose[]>(
    []
  );

  const [isNewPrompt, setIsNewPrompt] = React.useState<boolean>(false);

  const [messagesChanged, setMessagesChanged] = React.useState<boolean>(false);

  const [messageLength, setMessageLength] = React.useState<number>(0);

  const { appState, setAppState, globalMessages, setGlobalMessages } =
    useGlobalStore();

  const { toast } = useToast();

  const [initialized, setInitialized] = React.useState<boolean>(false);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    setMessages,
    isLoading,
    data,
    metadata,
  } = useChat({
    initialMessages: [],
    initialInput: "",
    api: "/api/chat/analysis",
    body: {
      listSets,
      modelArgs: { modelName, provider: modelProviderName, temperature },
    },
  });

  const providerChanged = async (provider: ModelProviderEnum) => {
    console.log("provider changed", provider);
    setModelProviderName(provider);

    switch (provider) {
      case ModelProviderEnum.OPENAI:
        console.log("openai");
        setModelName("gpt-3.5-turbo");
        break;
      case ModelProviderEnum.ANTHROPIC:
        setModelName(AnthropicModelNames["claude-instant-1.2"]);
        break;
      case ModelProviderEnum.MISTRAL:
        setModelName(MistralModelNames["mistral-large-latest"]);
        break;
      case ModelProviderEnum.COHERE:
        setModelName(CohereModelNames["command-r-plus"]);
        break;
      case ModelProviderEnum.GOOGLE_G:
        setModelName(
          GoogleGenerativeAIModelNames["models/gemini-1.5-pro-latest"]
        );
        break;
      default:
        break;
    }
  };

  const renderModelNames = () => {
    console.log("modelProviderName", modelProviderName);
    switch (modelProviderName) {
      case ModelProviderEnum.OPENAI.toUpperCase():
        // setModelName("gpt-4o-mini"["gpt-3.5-turbo"]);
        return Object.keys("gpt-4o-mini").map((m, i) => {
          return (
            <SelectItem key={i} value={m}>
              {m}
            </SelectItem>
          );
        });
      case ModelProviderEnum.ANTHROPIC.toUpperCase():
        // setModelName(AnthropicModelNames["claude-3-sonnet-20242029"]);
        return Object.keys(AnthropicModelNames).map((m, i) => {
          return (
            <SelectItem key={i} value={m}>
              {m}
            </SelectItem>
          );
        });
      case ModelProviderEnum.MISTRAL:
        return Object.keys(MistralModelNames).map((m, i) => {
          // setModelName(MistralModelNames['mistral-large-latest']);
          return (
            <SelectItem key={i} value={m}>
              {m}
            </SelectItem>
          );
        });
      case ModelProviderEnum.COHERE:
        // setModelName(CohereModelNames['command-r-plus']);
        return Object.keys(CohereModelNames).map((m, i) => {
          return (
            <SelectItem key={i} value={m}>
              {m}
            </SelectItem>
          );
        });
      case ModelProviderEnum.GOOGLE_G:
        // setModelName(GoogleGenerativeAIModelNames['models/gemini-1.5-pro-latest']);
        return Object.keys(GoogleGenerativeAIModelNames).map((m, i) => {
          return (
            <SelectItem key={i} value={m}>
              {m}
            </SelectItem>
          );
        });
    }
  };

  const quickStoreMessages = async (messages: Message[], index: number) => {
    if (!appState.currentUser) return;
    if (messages.length === 0) return;
    if (!messagesChanged) return;
    console.log("storing messages", messages);
    messagesChanged && setMessagesChanged(false);

    await ANALYSIS_TOOLS_saveAnalysisMessages({
      messages,
      userId: appState.currentUser.id,
      index,
    });

    toast({
      title: "Saved",
      description: "Messages saved successfully",
      type: "foreground",
    });
  };

  const quickStoreAnalysisPrompt = async (prompt: string) => {
    if (isNewPrompt) {
      console.log("storing prompt", prompt);
      //return
      await ANALYSIS_TOOLS_quickSaveAnalysisPrompt({
        prompt,
        userId: appState.currentUser?.id || "",
      });
      setIsNewPrompt(false);
    }
  };

  React.useEffect(() => {
    if (
      !isLoading &&
      messages.length > 0 &&
      messageLength !== messages.length &&
      messages[messages.length - 1].role === "assistant"
    ) {
      console.log("messages changed", messages);
      setMessageLength(messages.length);
      quickStoreMessages(messages, index);
      scroller.scrollTo(`message-${messages.length}`, {
        duration: 1500,
        delay: 100,
        smooth: true,
        containerId: "ContainerElementID",
        offset: 50, // Scrolls to element + 50 pixels down the page
      });
    }
  }, [messages]);

  useEffect(() => {
    if (!appState.currentUser) return;
    if (!modelNameChanged) return;

    setModelNameChanged(false);

    const updateLastModelName = async () => {
      console.log("updating last model name", modelName);
      await ANALYSIS_TOOLS_storeLastAnalysisModelName({
        userId: appState.currentUser.id,
        chatIndex: index,
        jsonValues: { modelProviderName, modelName },
      });
    };
    if (!appState.currentUser) return;
    updateLastModelName();
  }, [modelProviderName, modelName]);

  useEffect(() => {
    const loadLastModelName = async () => {
      if (!appState.currentUser) return;
      const result = await ANALYSIS_TOOLS_getLastAnalysisModelName({
        userId: appState.currentUser.id,
        chatIndex: index,
      });
      console.log("last model name", result);

      if (!result) return;

      const { modelProviderName, modelName } = JSON.parse(result.content);

      console.log("last model name", modelProviderName, modelName);

      setModelProviderName(modelProviderName);
      setModelName(modelName);
    };
    loadLastModelName();
  }, []);

  React.useEffect(() => {
    const loadMessageHistory = async () => {
      if (!appState.currentUser) return;

      const result = await ANALYSIS_TOOLS_getLastAnalysisMessages({
        userId: appState.currentUser?.id || "",
        n: 5,
        index,
      });
      console.log("last message history", result);
      if (result.length === 0) return;
      const lastMessageJson = result.sort((a, b) => {
        return a.createdAt > b.createdAt ? -1 : 1;
      })[0].content;

      const lastMessage = JSON.parse(lastMessageJson);

      setMessages(lastMessage);

      setMessageHistory(result);
    };

    loadMessageHistory();
  }, [appState.currentUser]);

  // useEffect(() => {
  //   console.log("messages", messages);
  //   if (isLoading) return;
  //   if (messages.length === 0) return;
  //   if (messages[messages.length - 1].role === "user") return;

  //   setMessages([
  //     ...messages.slice(0, -1),
  //     { ...messages[messages.length - 1], data: { temperature, modelName, modelProviderName } },
  //   ]);
  // }, [messages]);
  return (
    <div>
      {" "}
      <div className="h-1/3 flex flex-col gap-4 overflow-y-auto shadow-md">
        <div
        //
        >
          <div className="flex flex-row items-center justify-center gap-4"></div>

          {/* <PromptWindowControl
            handleInputChange={handleInputChange}
            input={input}
            promptTextToSet={promptTextToSet}
            globalMessages={globalMessages}
            index={index}
            autoPromptExtraInfo=""
            handleAutoPromptModelChange={handleAutoPromptModelChange}
            handleAutoPromptProviderChange={handleAutoPromptProviderChange}
          /> */}

          {input.length > 5 && (
            <div className={cn("flex items-center justify-center gap-4")}>
              <Select
                onValueChange={async (v) => {
                  setModelNameChanged(true);
                  providerChanged(v as ModelProviderEnum);
                }}
                value={modelProviderName}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Provider</SelectLabel>
                    {/**Display ModelProvider enum Names */}
                    {Object.keys(ModelProviderEnum).map((m, i) => {
                      return (
                        <SelectItem key={i} value={m}>
                          {m}
                        </SelectItem>
                      );
                    })}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Select
                onValueChange={(v) => {
                  console.log("selected", v);
                  setModelNameChanged(true);
                  setModelName(v as string);
                }}
                value={modelName}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Model</SelectLabel>
                    {renderModelNames()}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          )}
          {input.length > 8 && (
            <div>
              <Input
                placeholder="Temperature"
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={temperature}
                onChange={(e) => {
                  setTemperature(Number(e.target.value));
                }}
              />
              <Label>T {temperature}</Label>
            </div>
          )}
        </div>
        {input.length > 7 && (
          <Button
            variant="outline"
            className="w-full"
            onClick={(e) => {
              setMessagesChanged(true);
              quickStoreAnalysisPrompt(input);
              handleSubmit(e);
              scroller.scrollTo(`message-${messages.length}`, {
                duration: 1500,
                delay: 100,
                smooth: true,
                containerId: "ContainerElementID",
                offset: 50, // Scrolls to element + 50 pixels down the page
              });
              //scroll.scrollTo(0);
            }}
          >
            Send
          </Button>
        )}

        <MessagesComponent
          messageHistory={[]}
          messages={messages}
          setMessages={(messages) => setMessages(messages as Message[])}
          promptTextToSet={promptTextToSet}
          modelName={modelName as ModelNames}
          modelProviderName={modelProviderName as ModelProviderEnum}
          temperature={temperature}
          messageHistoryNames={[]}
          setMessageHistory={() => {}}
        />
      </div>
    </div>
  );
}
