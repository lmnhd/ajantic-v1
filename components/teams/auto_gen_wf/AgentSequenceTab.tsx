import React from 'react';
import { AutoGenAgent, AutoGenTeam } from '@/src/lib/autogen/autogen';
import { Button } from '@/components/ui/button';
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';
import { GripHorizontal, Trash2 } from 'lucide-react';

interface AgentSequenceTabProps {
  localWorkflow: AutoGenTeam;
  handleRemoveFromSequence: (index: number) => void;
  handleReorderSequence: (sourceIndex: number, destinationIndex: number) => void;
  handleAddToSequence: (agent: AutoGenAgent) => void;
  isAgentInSequence: (agentName: string) => boolean;
  handleClearSequence: () => void;
}

const AgentSequenceTab: React.FC<AgentSequenceTabProps> = ({
  localWorkflow,
  handleRemoveFromSequence,
  handleReorderSequence,
  handleAddToSequence,
  isAgentInSequence,
  handleClearSequence
}) => {
  const onDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    if (sourceIndex === destinationIndex) {
      return;
    }

    handleReorderSequence(sourceIndex, destinationIndex);
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Agent Sequence</h2>
      
      {/* Current Sequence Section - Compact, horizontal with drag & drop */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium">Current Sequence</h3>
          {localWorkflow.agentSequence.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Drag to reorder</span>
              <Button onClick={handleClearSequence} variant="destructive" size="sm">
                Clear Sequence
              </Button>
            </div>
          )}
        </div>

        {localWorkflow.agentSequence.length === 0 ? (
          <div className="p-4 border-2 border-dashed rounded-lg text-center text-gray-500">
            <p>No agents in sequence yet. Add agents from the available list below.</p>
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="agentSequence" direction="horizontal">
              {(provided) => (
                <div
                  className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border min-h-[60px]"
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                >
                  {localWorkflow.agentSequence.map((agentName: string, index: number) => {
                    // Find if this agent is a new agent
                    const isNewAgent = localWorkflow.newAgents.some(
                      (agent) => agent.name === agentName
                    );
                    
                    return (
                      <Draggable key={`${agentName}-${index}`} draggableId={`${agentName}-${index}`} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`flex items-center rounded-full px-3 py-1 border select-none ${
                              snapshot.isDragging ? 'bg-blue-100 shadow-md' : 'bg-white dark:bg-gray-700'
                            } ${isNewAgent ? 'border-blue-200 dark:border-blue-800' : 'border-gray-200 dark:border-gray-700'}`}
                          >
                            <span 
                              {...provided.dragHandleProps}
                              className="flex items-center justify-center cursor-grab active:cursor-grabbing pr-1"
                              title="Drag to reorder"
                            >
                              <GripHorizontal className="h-3 w-3 text-gray-400" />
                            </span>
                            <span className="flex items-center justify-center w-5 h-5 bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200 rounded-full text-xs font-medium mr-2">
                              {index + 1}
                            </span>
                            <span className="font-medium mr-2 text-sm">{agentName}</span>
                            {isNewAgent && (
                              <span className="mr-2 text-xs text-blue-600 dark:text-blue-400 font-medium">
                                New
                              </span>
                            )}
                            <button
                              onClick={() => handleRemoveFromSequence(index)}
                              className="text-gray-400 hover:text-red-500 transition-colors"
                              title="Remove from sequence"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                              </svg>
                            </button>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </div>
      
      {/* Available Agents Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-medium">Available Agents</h3>
        </div>
        
        <AvailableAgentsSection 
          localWorkflow={localWorkflow} 
          isAgentInSequence={isAgentInSequence}
          handleAddToSequence={handleAddToSequence}
        />
      </div>
    </div>
  );
};

// Extracted component for available agents section
const AvailableAgentsSection = ({ 
  localWorkflow, 
  isAgentInSequence,
  handleAddToSequence
}: { 
  localWorkflow: AutoGenTeam, 
  isAgentInSequence: (agentName: string) => boolean,
  handleAddToSequence: (agent: AutoGenAgent) => void
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {/* Merge and display both available and new agents */}
      {localWorkflow.availableAgents.length === 0 && localWorkflow.newAgents.length === 0 ? (
        <p className="text-gray-500 col-span-2 text-center">No available agents. Create new agents first.</p>
      ) : (
        // Combine both arrays and map over them
        [...localWorkflow.availableAgents, ...localWorkflow.newAgents].map((agent, index) => {
          // Determine if this is a new agent by checking if it's in the newAgents array
          const isNewAgent = localWorkflow.newAgents.some(newAgent => newAgent.name === agent.name);
          
          return (
            <div 
              key={`${agent.name}-${index}`} 
              className={`flex items-center justify-between p-3 border rounded transition-colors ${
                isNewAgent 
                  ? 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-800' 
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <div className="flex flex-col">
                <div className="flex items-center">
                  <span className="font-medium">{agent.name}</span>
                  <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                    isNewAgent 
                      ? 'bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200' 
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                  }`}>
                    {agent.type}
                  </span>
                  {isNewAgent && (
                    <span className="ml-2 text-xs text-blue-600 dark:text-blue-400 font-medium">
                      New
                    </span>
                  )}
                </div>
                {agent.title && <span className="text-xs text-gray-500">{agent.title}</span>}
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => handleAddToSequence(agent)}
                  size="sm"
                  variant={isNewAgent ? "default" : "outline"}
                  className={isNewAgent 
                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                    : "text-blue-600 border-blue-600 hover:bg-blue-50"
                  }
                  disabled={isAgentInSequence(agent.name)}
                >
                  {isAgentInSequence(agent.name) ? (
                    "Added"
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                      Add
                    </>
                  )}
                </Button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default AgentSequenceTab; 