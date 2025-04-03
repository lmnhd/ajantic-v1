import React from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { WhisperVoicesEnum } from '@/src/lib/speech/voices-types'
import { useGlobalStore } from '@/src/lib/store/GloabalStoreState'
import { AgentVoiceProviderEnum } from '@/src/lib/types';

export default function WhisperVoiceSelect({onChange, agentIndex}: {onChange: (voice: string) => void, agentIndex?: number}) {
  const { globalMessages } = useGlobalStore();

  const getDefaultValue = () => {
    if (!agentIndex) return WhisperVoicesEnum.shimmer;
    
    const currentAgents = globalMessages?.currentState?.currentAgents;
    if (!currentAgents?.agents) return WhisperVoicesEnum.shimmer;
    
    const agent = currentAgents.agents[agentIndex];
    if (agent?.voice?.provider === AgentVoiceProviderEnum.OPENAI) {
      return agent.voice.nameOrVoiceID;
    }
    return WhisperVoicesEnum.shimmer;
  };

  const handleValueChange = (value: string) => {
    const newValue = value as WhisperVoicesEnum;
    const currentValue = getDefaultValue();
    
    // Only call onChange if the value has actually changed
    if (newValue !== currentValue) {
      onChange(newValue);
    }
  };

  return (
    <Select 
      defaultValue={getDefaultValue()} 
      onValueChange={handleValueChange}
    >
      <SelectTrigger>
        <SelectValue placeholder="Select a voice" />
      </SelectTrigger>
      <SelectContent>
        {Object.values(WhisperVoicesEnum).map((voice) => (
          <SelectItem key={voice} value={voice}>{voice}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
