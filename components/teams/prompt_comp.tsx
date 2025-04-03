import React, { useEffect, useRef, useState } from "react";

import ReferenceStateView from "@/components/global/reference-stateview"; // Needs migration
import { useGlobalStore } from "@/src/lib/store/GloabalStoreState"; // Placeholder
import { LineLyricType } from "@/components/songeditor/lyric/line"; // Likely remove or replace
import { cn, UTILS_getGenericData, UTILS_putGenericData } from "@/src/lib/utils"; // Needs migration
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AgentComponentProps,
  AISessionState,
  ModelArgs,
  ModelNames,
  ModelProvider,
  ModelProviderEnum,

} from "@/src/lib/types";
import { Button } from "@/components/ui/button";
import { useChat } from "ai/react"; // May not be needed directly here
import { useActions } from "ai/rsc"; // May not be needed directly here
import { useToast } from "@/components/ui/use-toast";
import { BlockLyricType } from "@/components/songeditor/lyric/block"; // Likely remove or replace
import { BoxIcon, CircleArrowDownIcon, Delete } from "lucide-react";
import { set } from "zod";
import { CoreMessage, Message } from "ai";
import { GeneralPurpose } from "@prisma/client"; // Assuming Prisma setup

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModelProviderSelect } from "@/components/global/model-provider-select"; // Needs migration
import { AutoPromptData } from "../agentcomponentframework";
import { SERVER_getPromptDirectives } from "@/src/lib/server";
// import { AutoPromptData } from "@/app/(main)/research/analysis/components/agentcomponentframework"; // Defined in @/lib/types now

const PromptComp = ({
  localStateObject,
  setLocalStateObject,
  index,
  promptTextToSet, // Likely used for "Add to Context" functionality
  numRows = 6,
  isDirective = false, // Determines if this edits system prompt or a directive
  directiveIndex, // Index of the directive if isDirective is true
  input, // Optional initial value (can override state)
  placeHolder,
  handleInputChange, // Callback for direct input changes (blur)
  handleAutoPrompt,
  useAutoPrompt = false,
  autoPromptModel,
  handleAutoPromptModelChange,
  autoPromptExtraInfo,
  setAutoPromptExtraInfo,
}: {
  localStateObject: AISessionState;
  setLocalStateObject: (e: AISessionState) => void;
  index: number;
  promptTextToSet: (text: string) => void;
  numRows?: number;
  isDirective?: boolean;
  directiveIndex?: number; // Required if isDirective is true
  input?: string;
  placeHolder?: string;
  handleInputChange?: (input: string) => void;
  useAutoPrompt?: boolean;
  handleAutoPrompt?: (data: string) => Promise<void>;
  autoPromptModel: ModelArgs;
  handleAutoPromptModelChange: (e: string) => void;
  autoPromptExtraInfo: string;
  setAutoPromptExtraInfo: (e: string) => void;
}) => {
  const [promptDirectives, setPromptDirectives] = useState<GeneralPurpose[]>([]);
  const [addExamples, setAddExamples] = useState<number>(0);
  const [localAutoPromptExtraInfo, setLocalAutoPromptExtraInfo] = useState<string>(autoPromptExtraInfo || "");
  const textFieldRef = useRef<HTMLTextAreaElement>(null);
  const { appState } = useGlobalStore(); // Placeholder

  // Load prompt directives (like saved templates)
  useEffect(() => {
    const loadPromptDirectives = async () => {
      if (!appState?.currentUser?.id) return;
      try {
        const result = await SERVER_getPromptDirectives(appState.currentUser.id); // Needs migration
        if (result) {
          setPromptDirectives(result);
        }
      } catch (error) {
        console.error("Failed to load prompt directives:", error);
      }
    };
    loadPromptDirectives();
  }, [appState?.currentUser?.id]);

  // Set initial text area value based on props or state
  useEffect(() => {
    if (textFieldRef.current) {
      const agent = localStateObject.currentAgents.agents[index];
      if (!agent) return;
      
      let initialValue = "";
      if (input !== undefined) {
        initialValue = input;
      } else if (isDirective && directiveIndex !== undefined && agent.promptDirectives) {
        initialValue = agent.promptDirectives[directiveIndex] || "";
      } else if (!isDirective) {
        initialValue = agent.systemPrompt || "";
      }
      textFieldRef.current.value = initialValue;
    }
  }, [input, isDirective, directiveIndex, index, localStateObject]); // Rerun if input or state changes

  const currentPromptText = (): string => {
     const agent = localStateObject.currentAgents.agents[index];
     if (!agent) return "";
     if (isDirective && directiveIndex !== undefined && agent.promptDirectives) {
        return agent.promptDirectives[directiveIndex] || "";
     } else if (!isDirective) {
        return agent.systemPrompt || "";
     }
     return "";
  }

  const triggerAutoPrompt = async (isUpdate: boolean) => {
      if (!handleAutoPrompt) {
        console.error("Auto-prompt handler not provided");
        return;
      }

      const agent = localStateObject.currentAgents.agents[index];
      if (!agent) return;

      const promptData: AutoPromptData = {
        isDirective: isDirective,
        index: index,
        role: agent.roleDescription,
        title: agent.title,
        name: agent.name,
        extraInfo: localAutoPromptExtraInfo,
        addExamples: addExamples,
        promptSuggestions: "",
      };

      if (isUpdate) {
          const changes = window.prompt("What changes do you want to make to the prompt?", "");
          if (changes === null) return; // User cancelled
          promptData.requestedChanges = changes;
          promptData.previousPrompts = [currentPromptText()];
      }

      try {
         await handleAutoPrompt(JSON.stringify(promptData));
         // Optionally clear extra info after use
         // setLocalAutoPromptExtraInfo(""); 
         // setAddExamples(0);
      } catch (error) {
          console.error("Auto-prompt failed:", error);
          // Show toast or error message
      }
  };

  return (
    <div className="flex flex-col w-full h-full bg-slate-900/80 rounded border border-indigo-900/50">
      {/* Header/Toolbar */}
      <div className="flex items-center justify-end p-1 border-b border-indigo-900/50 bg-slate-800/50">
        {/* Directive Selector (if applicable) */}
        {isDirective && promptDirectives.length > 0 && (
          <Select
            onValueChange={(value) => {
              if (textFieldRef.current) textFieldRef.current.value = value;
              if (handleInputChange) handleInputChange(value);
            }}
          >
            <SelectTrigger className="h-6 px-2 text-[10px] w-auto mr-auto bg-transparent border-none text-gray-400 hover:text-white">
              <SelectValue placeholder="Load Directive" />
            </SelectTrigger>
            <SelectContent>
              {promptDirectives.map((p, i) => (
                <SelectItem key={i} value={p.content} className="text-xs">
                  {p.meta1} {/* Assuming meta1 is the name */} 
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Auto Prompt Controls (if enabled) */}
        {useAutoPrompt && handleAutoPrompt && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="xs"
                className="text-violet-300 hover:bg-violet-500/20"
                title="Auto-generate/update prompt"
              >
                <span className="mr-1">✨</span> Auto
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2 space-y-2 bg-gray-800 border-gray-700">
              <Input
                placeholder="Optional: extra info..."
                className="text-xs h-7"
                value={localAutoPromptExtraInfo}
                onChange={(e) => setLocalAutoPromptExtraInfo(e.target.value)}
              />
              <div className="flex items-center justify-between text-xs">
                <Label>Add Examples:</Label>
                <Input
                  type="number"
                  className="w-14 h-6 text-xs p-1"
                  value={addExamples}
                  min={0}
                  max={5}
                  onChange={(e) => setAddExamples(parseInt(e.target.value, 10) || 0)}
                />
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() => triggerAutoPrompt(!currentPromptText())} // Trigger update if text exists
              >
                {currentPromptText() ? "Update Prompt" : "Generate Prompt"}
              </Button>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Text Area */}
      <textarea
        ref={textFieldRef}
        placeholder={placeHolder || (isDirective ? `Directive ${directiveIndex !== undefined ? directiveIndex + 1 : ''}...` : "System prompt...")}
        title={isDirective ? `directive-${directiveIndex}` : "system-prompt"}
        defaultValue={input} // Use defaultValue, rely on useEffect to update
        onBlur={(e) => {
          if (handleInputChange) handleInputChange(e.target.value);
        }}
        rows={numRows}
        className="w-full flex-grow p-2 text-sm bg-transparent text-indigo-100 focus:outline-none resize-none"
      />
    </div>
  );
};

export default PromptComp; 