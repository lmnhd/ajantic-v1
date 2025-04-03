import React, { useState, useEffect } from 'react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { AgentFormData } from './types';
import TeamInfoTab from './TeamInfoTab';
import NewAgentsTab from './NewAgentsTab';
import AgentSequenceTab from './AgentSequenceTab';
import ProcessStepsTab from './ProcessStepsTab';
import { AutoGenAgent, AutoGenTeam } from '../../teams-lib/autogen';

interface AutoGenWorkflowComponentProps {
  autoGenWorkflow: AutoGenTeam;
  setAutoGenWorkflow: (workflow: AutoGenTeam) => void;
}

const AutoGenWorkflowComponent: React.FC<AutoGenWorkflowComponentProps> = ({
  autoGenWorkflow,
  setAutoGenWorkflow,
}) => {
  // Local state for managing the workflow editing
  const [localWorkflow, setLocalWorkflow] = useState<AutoGenTeam>({ ...autoGenWorkflow });
  // State to track if there are unsaved changes
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  
  // State for managing agent editing
  const [editingAgent, setEditingAgent] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<AgentFormData>({
    name: '',
    title: '',
    type: 'agent',
    roleDescription: '',
    expectedOutput: '',
    toolHints: [],
  });

  // Update local state when props change
  useEffect(() => {
    setLocalWorkflow({ ...autoGenWorkflow });
    setHasChanges(false); // Reset change tracking when receiving new props
  }, [autoGenWorkflow]);

  // Check for changes whenever localWorkflow changes
  useEffect(() => {
    // Skip the initial render
    if (localWorkflow === autoGenWorkflow) return;
    
    // Compare the current local workflow with the original workflow
    const isChanged = JSON.stringify(localWorkflow) !== JSON.stringify(autoGenWorkflow);
    setHasChanges(isChanged);
  }, [localWorkflow, autoGenWorkflow]);

  // Helper to check if an agent is in sequence
  const isAgentInSequence = (agentName: string) => {
    return localWorkflow.agentSequence.includes(agentName);
  };
  // Handle change for team fields
  const handleTeamInfoChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>): void => {
    const { name, value } = e.target;
    setLocalWorkflow((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle adding a new agent
  const handleAddNewAgent = (data: AgentFormData) => {
    const newAgent: AutoGenAgent = {
      name: data.name,
      title: data.title,
      type: data.type,
      roleDescription: data.roleDescription,
      expectedOutput: data.expectedOutput,
      toolHints: data.toolHints,
    };

    setLocalWorkflow((prev) => ({
      ...prev,
      newAgents: [...prev.newAgents, newAgent],
      availableAgents: [...prev.availableAgents],
    }));
  };

  // Handle removing a new agent
  const handleRemoveNewAgent = (name: string) => {
    // Remove from newAgents
    setLocalWorkflow((prev) => ({
      ...prev,
      newAgents: prev.newAgents.filter((agent) => agent.name !== name),
      // Also remove from sequence if present
      agentSequence: prev.agentSequence.filter((agentName) => agentName !== name),
    }));
  };

  // Handle starting edit of an agent
  const handleStartEdit = (agent: AutoGenAgent) => {
    setEditingAgent(agent.name);
    setEditForm({
      name: agent.name,
      title: agent.title || '',
      type: agent.type || 'agent',
      roleDescription: agent.roleDescription || '',
      expectedOutput: agent.expectedOutput || '',
      toolHints: agent.toolHints || [],
    });
  };

  // Handle canceling edit
  const handleCancelEdit = () => {
    setEditingAgent(null);
  };

  // Handle saving edit
  const handleSaveEdit = () => {
    if (!editingAgent) return;

    setLocalWorkflow((prev) => {
      // Find if this is a new agent
      const isNew = prev.newAgents.some((agent) => agent.name === editingAgent);
      
      if (isNew) {
        // Update in newAgents
        const updatedNewAgents = prev.newAgents.map((agent) =>
          agent.name === editingAgent
            ? {
                ...agent,
                name: editForm.name,
                title: editForm.title,
                type: editForm.type,
                roleDescription: editForm.roleDescription,
                expectedOutput: editForm.expectedOutput,
                toolHints: editForm.toolHints,
              }
            : agent
        );

        // Also update in sequence if present
        const updatedSequence = prev.agentSequence.map((name) =>
          name === editingAgent ? editForm.name : name
        );

        return {
          ...prev,
          newAgents: updatedNewAgents,
          agentSequence: updatedSequence,
        };
      } else {
        // Not allowed to edit available agents directly
        return prev;
      }
    });

    setEditingAgent(null);
  };

  // Handle adding agent to sequence
  const handleAddToSequence = (agent: AutoGenAgent) => {
    if (isAgentInSequence(agent.name)) return;

    setLocalWorkflow((prev) => ({
      ...prev,
      agentSequence: [...prev.agentSequence, agent.name],
    }));
  };

  // Handle removing agent from sequence
  const handleRemoveFromSequence = (index: number) => {
    setLocalWorkflow((prev) => ({
      ...prev,
      agentSequence: prev.agentSequence.filter((_, i) => i !== index),
    }));
  };

  // Handle reordering sequence
  const handleReorderSequence = (sourceIndex: number, destinationIndex: number) => {
    setLocalWorkflow((prev) => {
      const newSequence = [...prev.agentSequence];
      const [movedAgent] = newSequence.splice(sourceIndex, 1);
      newSequence.splice(destinationIndex, 0, movedAgent);
      return { ...prev, agentSequence: newSequence };
    });
  };

  // Handle adding a process step
  const handleAddProcessStep = () => {
    setLocalWorkflow((prev) => ({
      ...prev,
      processSteps: [...prev.processSteps, ''],
    }));
  };

  // Handle changing a process step
  const handleProcessStepChange = (index: number, value: string) => {
    setLocalWorkflow((prev) => {
      const newSteps = [...prev.processSteps];
      newSteps[index] = value;
      return { ...prev, processSteps: newSteps };
    });
  };

  // Handle removing a process step
  const handleRemoveProcessStep = (index: number) => {
    setLocalWorkflow((prev) => ({
      ...prev,
      processSteps: prev.processSteps.filter((_, i) => i !== index),
    }));
  };

  // Handle clearing all process steps
  const handleClearSteps = () => {
    setLocalWorkflow((prev) => ({
      ...prev,
      processSteps: [],
    }));
  };

  // Handle clearing agent sequence
  const handleClearSequence = () => {
    setLocalWorkflow((prev) => ({
      ...prev,
      agentSequence: [],
    }));
  };

  // Handle reordering process steps
  const handleReorderProcessSteps = (sourceIndex: number, destinationIndex: number) => {
    setLocalWorkflow((prev) => {
      const newSteps = [...prev.processSteps];
      const [movedStep] = newSteps.splice(sourceIndex, 1);
      newSteps.splice(destinationIndex, 0, movedStep);
      return { ...prev, processSteps: newSteps };
    });
  };

  // Handle saving changes
  const handleSave = () => {
    setAutoGenWorkflow(localWorkflow);
    setHasChanges(false); // Reset changes after saving
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <Tabs defaultValue="team-info" className="w-full flex-1 overflow-hidden flex flex-col">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="team-info">Team Information</TabsTrigger>
          <TabsTrigger value="new-agents">New Agents</TabsTrigger>
          <TabsTrigger value="agent-sequence">Agent Sequence</TabsTrigger>
          <TabsTrigger value="process-steps">Process Steps</TabsTrigger>
        </TabsList>
        
        <div className="overflow-auto flex-1 pb-20">
          <TabsContent value="team-info" className="mt-4">
            <TeamInfoTab 
              localWorkflow={localWorkflow} 
              handleChange={handleTeamInfoChange} 
            />
          </TabsContent>
          
          {/* <TabsContent value="available-agents" className="mt-4">
            <AvailableAgentsTab 
              localWorkflow={localWorkflow}
              handleAddToSequence={handleAddToSequence}
              isAgentInSequence={isAgentInSequence}
            />
          </TabsContent> */}
          
          <TabsContent value="new-agents" className="mt-4">
            <NewAgentsTab 
              localWorkflow={localWorkflow}
              editingAgent={editingAgent}
              editForm={editForm}
              handleStartEdit={handleStartEdit}
              handleCancelEdit={handleCancelEdit}
              handleSaveEdit={handleSaveEdit}
              handleRemoveNewAgent={handleRemoveNewAgent}
              handleAddNewAgent={handleAddNewAgent}
            />
          </TabsContent>
          
          <TabsContent value="agent-sequence" className="mt-4">
            <AgentSequenceTab 
              localWorkflow={localWorkflow}
              handleRemoveFromSequence={handleRemoveFromSequence}
              handleReorderSequence={handleReorderSequence}
              handleAddToSequence={handleAddToSequence}
              isAgentInSequence={isAgentInSequence}
              handleClearSequence={handleClearSequence}
            />
          </TabsContent>
          
          <TabsContent value="process-steps" className="mt-4">
            <ProcessStepsTab 
              localWorkflow={localWorkflow}
              handleClearSteps={handleClearSteps}
              handleProcessStepChange={handleProcessStepChange}
              handleAddProcessStep={handleAddProcessStep}
              handleRemoveProcessStep={handleRemoveProcessStep}
              handleReorderProcessSteps={handleReorderProcessSteps}
            />
          </TabsContent>
        </div>
      </Tabs>
      
      <div className="py-4 bg-white dark:bg-gray-800 border-t sticky bottom-0 mt-auto">
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={!hasChanges} className="px-6">
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AutoGenWorkflowComponent; 