import React, { useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AgentVoiceProviderEnum, ElevenLabsVoice } from "@/src/lib/types";
import { useGlobalStore } from "@/src/lib/store/GloabalStoreState";

export default function ElevenLabsVoiceSelect({
  voices,
  onChange,
  agentIndex,
}: {
  voices: ElevenLabsVoice[];
  onChange: (voice_id: string) => void;
  agentIndex?: number;
}) {
  //console.log('ELEVEN_LABS_VOICES: ', voices);
  const { globalMessages } = useGlobalStore();
  useEffect(() => {
    if (voices.length === 0) return;
    //console.log("ELEVENLABS-VOICE-SELECT-INIT: ", voices);
    if (!agentIndex) onChange(voices[0].voice_id);

    if (agentIndex) {
      const agent =
        globalMessages.currentState?.currentAgents?.agents?.[agentIndex];
      if (agent && agent.voice && agent.voice.provider === AgentVoiceProviderEnum.ELEVEN_LABS)
        onChange(agent.voice?.nameOrVoiceID);
    }
  }, []);
  return (
    <Select
      defaultValue={voices && voices.length > 0 ? 
        (agentIndex && globalMessages?.currentState?.currentAgents?.agents?.[agentIndex]?.voice?.nameOrVoiceID) 
          ? globalMessages?.currentState?.currentAgents?.agents?.[agentIndex]?.voice?.nameOrVoiceID 
          : voices[0].voice_id 
        : ""}
      onValueChange={(value) =>
        onChange(voices.find((v) => v.voice_id === value)?.voice_id || "")
      }
    >
      <SelectTrigger className="text-xs w-full">
        <SelectValue placeholder="Select a voice" />
      </SelectTrigger>
      <SelectContent>
        {voices &&
          voices.length > 0 &&
          voices.map((v: ElevenLabsVoice) => (
            <SelectItem key={v.voice_id} value={v.voice_id}>
              {v.name}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}
