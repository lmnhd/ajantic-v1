import React from 'react';
import { AutoGenAgent, AutoGenTeam } from '../../teams-lib/autogen';
import AgentCard from './AgentCard';
import AgentForm from './AgentForm';
import { AgentFormData } from './types';

interface NewAgentsTabProps {
  localWorkflow: AutoGenTeam;
  editingAgent: string | null;
  editForm: AgentFormData;
  handleStartEdit: (agent: AutoGenAgent) => void;
  handleCancelEdit: () => void;
  handleSaveEdit: () => void;
  handleRemoveNewAgent: (name: string) => void;
  handleAddNewAgent: (data: AgentFormData) => void;
}

const NewAgentsTab: React.FC<NewAgentsTabProps> = ({
  localWorkflow,
  editingAgent,
  editForm,
  handleStartEdit,
  handleCancelEdit,
  handleSaveEdit,
  handleRemoveNewAgent,
  handleAddNewAgent,
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-6">
      {/* New Agents List */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Current New Agents</h2>
        {localWorkflow.newAgents.length === 0 ? (
          <p className="text-gray-500">No new agents added yet.</p>
        ) : (
          <div className="space-y-2">
            {localWorkflow.newAgents.map((agent, index) => (
              <div key={index}>
                {editingAgent === agent.name ? (
                  <AgentForm
                    initialData={{
                      name: agent.name,
                      title: agent.title || '',
                      type: agent.type || 'agent',
                      roleDescription: agent.roleDescription || '',
                      expectedOutput: agent.expectedOutput || '',
                      toolHints: agent.toolHints || [],
                    }}
                    onSubmit={handleSaveEdit}
                    onCancel={handleCancelEdit}
                    isEdit={true}
                  />
                ) : (
                  <AgentCard
                    agent={agent}
                    isNewAgent={true}
                    onEdit={handleStartEdit}
                    onRemove={handleRemoveNewAgent}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Add New Agent Section */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow space-y-5">
        <div className="flex items-center border-b pb-3 mb-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 text-blue-500"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" y1="8" x2="19" y2="14"></line><line x1="22" y1="11" x2="16" y2="11"></line></svg>
          <h2 className="text-xl font-semibold">Add New Agent</h2>
        </div>
        
        <AgentForm
          onSubmit={handleAddNewAgent}
          submitLabel="Add Agent"
        />
      </div>
    </div>
  );
};

export default NewAgentsTab; 