import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/components/ui/use-toast";
import { ServerMessage } from "@/src/lib/types";
import { SERVER_saveAsPrompt, SERVER_savePromptDirectives } from "@/src/lib/server";
import { AppState, ModelNames, ModelProviderEnum } from "@/src/lib/types";
import { cn } from "@/src/lib/utils";
import { ExitIcon } from "@radix-ui/react-icons";
import { Message } from "ai";
import { BoxIcon } from "lucide-react";
import React, { useCallback } from "react";

export default function MessageActionBar({
  m,
  messages,
  setMessages,
  agentIndex,
 
  promptTextToSet,
  userId,
}: {
  m: ServerMessage;
  messages: ServerMessage[];
  setMessages: (messages: ServerMessage[]) => void;
  agentIndex: number;
  
  userId: string;
  promptTextToSet: (text: string) => void;
}) {
  // Memoize click handlers
  const handleDelete = useCallback(async () => {
    if (!confirm("Are you sure you want to delete this message?")) return;
    
    // Use functional update form to avoid dependency on 'messages' prop
    setMessages(messages.filter((msg: ServerMessage) => msg !== m));

    toast({
      title: "Deleted",
      description: "Message deleted",
      type: "foreground",
    });
    // Remove 'messages' from dependencies
  }, [setMessages, m]);

  const handleSavePrompt = useCallback(async () => {
    if (!userId || typeof m.content !== 'string') return;
    const name =
      prompt(
        "Enter a name for this prompt",
        `Auto-Named-Prompt ${new Date().toLocaleTimeString()}`
      ) || `Auto-Named-Prompt ${new Date().toLocaleTimeString()}`;
    console.log("Save to prompt clicked", name);
    const result = await SERVER_saveAsPrompt(m.content, name, userId);
    console.log("result", result);
    if (result) {
      toast({
        title: "Saved",
        description: "Prompt saved successfully",
        type: "foreground",
      });
    }
  }, [userId, m.content, toast]); // Added toast dependency

  const handleSaveDirective = useCallback(async () => {
    if (!userId || typeof m.content !== 'string') return;
    console.log("Saving as directive that will be autonamed...");
    const result = await SERVER_savePromptDirectives(m.content, userId, {
      modelName: "gpt-4o-mini",
      provider: ModelProviderEnum.OPENAI,
      temperature: 0.5,
    });
    console.log("result", result);
    // Optional: Update local state if needed
  }, [userId, m.content]);

  const handleSendToSet = useCallback(() => {
    if (typeof m.content !== 'string') return;
    console.log("Send to set clicked");
    promptTextToSet(m.content);
  }, [promptTextToSet, m.content]);

  return (
    <div className={cn("flex justify-between w-full h-6 bg-gray-500/20")}>
      <div className="flex items-start justify-center">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger onClick={handleDelete}>
              <ExitIcon className={cn("w-4 h-4 text-violet-500")} />
            </TooltipTrigger>
            <TooltipContent>
              <p>Delete Message</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className={cn("flex justify-center items-center p-2")}>
        <TooltipProvider>
          <div className="flex items-center justify-center gap-4">
            <Tooltip>
              <TooltipTrigger onClick={handleSavePrompt}>
                <BoxIcon className={cn("w-4 h-4 text-violet-500")} />
              </TooltipTrigger>
              <TooltipContent>
                <p>Save analysis prompt</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger onClick={handleSaveDirective}>
                <BoxIcon className={cn("w-4 h-4 text-violet-500")} />
              </TooltipTrigger>
              <TooltipContent>
                <p>Save as Directive</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger onClick={handleSendToSet}>
                <BoxIcon className={cn("w-4 h-4 text-violet-500")} />
              </TooltipTrigger>
              <TooltipContent>
                <p>Send to set</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>
    </div>
  );
}
