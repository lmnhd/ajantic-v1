import React from "react";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGlobalStore } from "@/src/lib/store/GloabalStoreState";
import { AISessionState, StoredGlobalAIState } from "@/src/lib/types";
import { deleteGlobalAIState, getAllGlobalAIStates, getGlobalAIState } from "@/src/lib/server-actions";

interface StateHistorySelectProps {
  className?: string;
}

export default function StateHistorySelect({ className }: StateHistorySelectProps) {
  const [allSavedStates, setAllSavedStates] = React.useState<StoredGlobalAIState[]>([]);
  const [selectedState, setSelectedState] = React.useState<StoredGlobalAIState | null>(null);
  const { globalMessages, setGlobalMessages, appState } = useGlobalStore();

  const loadStates = async () => {
    if (!appState.currentUser?.id) return;
    const states = await getAllGlobalAIStates(appState.currentUser.id);
    setAllSavedStates(states.sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1)));
  };

  React.useEffect(() => {
    if (allSavedStates.length === 0 && appState.currentUser?.id) {
      loadStates();
    }
  }, [allSavedStates.length, appState.currentUser?.id]);

  return (
    <div className={className}>
      <Select
        onValueChange={async (val) => {
          const loaded = await getGlobalAIState(Number(val)) as AISessionState;
          setGlobalMessages({
            ...globalMessages,
            currentState: loaded
          });
          setSelectedState(allSavedStates.find((state) => state.id === Number(val)) || null);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Load State" />
        </SelectTrigger>
        <SelectContent>
          {allSavedStates.map((state) => (
            <SelectItem key={state.id} value={String(state.id)}>
              {state.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="destructive"
        onClick={async () => {
          if (selectedState) {
            await deleteGlobalAIState(selectedState.id);
            await loadStates();
            setSelectedState(null);
          }
        }}
      >
        Delete State
      </Button>
    </div>
  );
}
