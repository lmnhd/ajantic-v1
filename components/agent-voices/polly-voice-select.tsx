import React from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PollyVoicesEnum } from '@/src/lib/speech/voices-types'
import { useGlobalStore } from '@/src/lib/store/GloabalStoreState'
import { AgentVoiceProviderEnum } from '@/src/lib/types';

export default function PollyVoiceSelect({onChange, agentIndex}: {onChange: (voice: string) => void, agentIndex?: number}) {
  const { globalMessages } = useGlobalStore();

  const getDefaultValue = () => {
    if (!agentIndex) return PollyVoicesEnum.Vicki;
    
    const currentAgents = globalMessages?.currentState?.currentAgents;
    if (!currentAgents?.agents) return PollyVoicesEnum.Vicki;
    
    const agent = currentAgents.agents[agentIndex];
    if (agent?.voice?.provider === AgentVoiceProviderEnum.AWS) {
      return agent.voice.nameOrVoiceID;
    }
    return PollyVoicesEnum.Vicki;
  };

  const handleValueChange = (value: string) => {
    const newValue = value as PollyVoicesEnum;
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
        {Object.values(PollyVoicesEnum).map((voice) => (
          <SelectItem key={voice} value={voice}>{voice}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
