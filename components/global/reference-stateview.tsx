import React, { useEffect } from "react";
import { Button } from "../ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { MicIcon, NfcIcon } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useUser } from "@clerk/nextjs";
import { useGlobalStore } from "@/src/lib/store/GloabalStoreState";
import { AISessionState, StoredGlobalAIState } from "@/src/lib/types";
import { removeBlockFromList, removeLineFromBlock } from "@/src/lib/lyric-helpers";
import { cn } from "@/src/lib/utils";
import { deleteGlobalAIState, getAllGlobalAIStates, getGlobalAIState, saveGlobalAIState } from "@/src/lib/server-actions";

interface ReferenceStateViewProps {
  mode: "wordplay" | "analysis";
  onClick?: (blockNum: number, lineNum: number) => void;
  setBlock?: (block: number) => void;
  blockSelected?: number;
  className?: string;
}

export default function ReferenceStateView({
  onClick,
  setBlock,
  className,
  blockSelected,
  mode,
}: ReferenceStateViewProps) {
  const [allSavedStates, setAllSavedStates] = React.useState<StoredGlobalAIState[]>([]);
  const [selectedReferenceState, setSelectedReferenceState] = React.useState<StoredGlobalAIState | null>(null);
  const [showLyricBlocks, setShowLyricBlocks] = React.useState<boolean>(false);
  const [initialized, setInitialized] = React.useState<boolean>(false);

  const user = useUser();
  const { appState, globalMessages, setAppState, setGlobalMessages } = useGlobalStore();

  const referenceLineClicked = (blockNum: number, lineNum: number) => {
    switch (mode) {
      case "wordplay": {
        const action = "delete";
        if (action === "delete") {
          let updatedRefBlocks = globalMessages.currentState.referenceWordPlayBlocks;
          const newBlock = removeLineFromBlock(updatedRefBlocks[blockNum], lineNum);

          if (newBlock.text.length > 1) {
            updatedRefBlocks[blockNum] = newBlock;
          } else {
            updatedRefBlocks = removeBlockFromList(updatedRefBlocks, blockNum);
          }

          setGlobalMessages({
            ...globalMessages,
            currentState: {
              ...globalMessages.currentState,
              referenceWordPlayBlocks: updatedRefBlocks,
            },
          });
        }
        break;
      }
      case "analysis":
        if (onClick) {
          onClick(blockNum, lineNum);
        }
        break;
    }
  };

  const loadStates = async () => {
    if (!appState.currentUser) return;

    const states = await getAllGlobalAIStates(appState.currentUser.id);
    setAllSavedStates(states.sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1)));
  };

  useEffect(() => {
    if (!globalMessages.currentState?.contextSet?.sets?.length || initialized) return;

    const initializeReferenceState = async () => {
      if (!globalMessages.currentState?.contextSet?.sets?.length) return;

      setInitialized(true);

      const _id = allSavedStates[allSavedStates.length - 1].id;
      const newState = await getGlobalAIState(_id) as AISessionState;

      if (globalMessages.currentState) {
        const _newState = {
          ...globalMessages.currentState,
          referenceLyricsBlocks: newState.referenceLyricsBlocks,
          referenceWordPlayBlocks: newState.referenceWordPlayBlocks,
        };

        setGlobalMessages({ ...globalMessages, currentState: _newState });
      }
    };

    initializeReferenceState();
  }, [globalMessages, initialized, allSavedStates, setGlobalMessages]);

  useEffect(() => {
    if (!appState.currentUser) {
      setAppState({ ...appState, currentUser: user.user });
    }
    if (allSavedStates.length === 0) {
      loadStates();
    }
  }, [appState, user.user, allSavedStates.length, setAppState, loadStates]);

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Rest of your JSX */}
    </div>
  );
}
