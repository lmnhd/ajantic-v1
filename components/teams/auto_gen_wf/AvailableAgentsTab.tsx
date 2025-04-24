import React from 'react';
import { AutoGenAgent, AutoGenTeam } from '@/src/lib/autogen/autogen';
import AgentCard from './AgentCard';

interface AvailableAgentsTabProps {
  localWorkflow: AutoGenTeam;
  handleAddToSequence: (agent: AutoGenAgent) => void;
  isAgentInSequence: (agentName: string) => boolean;
}

const AvailableAgentsTab: React.FC<AvailableAgentsTabProps> = ({
  localWorkflow,
  handleAddToSequence,
  isAgentInSequence,
}) => {
  // Combine available agents and new agents for display
  const allAgents = [...localWorkflow.availableAgents, ...localWorkflow.newAgents];
  
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Available Agents</h2>
      
      {allAgents.length === 0 ? (
        <p className="text-gray-500">No agents available. Add new agents first.</p>
      ) : (
        <div className="space-y-2">
          {allAgents.map((agent, index) => {
            // Check if this is a new agent
            const isNewAgent = localWorkflow.newAgents.some(
              (newAgent) => newAgent.name === agent.name
            );
            
            return (
              <AgentCard
                key={`${agent.name}-${index}`}
                agent={agent}
                isNewAgent={isNewAgent}
                isInSequence={isAgentInSequence(agent.name)}
                onAddToSequence={() => handleAddToSequence(agent)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AvailableAgentsTab; 