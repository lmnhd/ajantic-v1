import React from 'react';
import { AutoGenTeam } from '../../teams-lib/autogen';

interface TeamInfoTabProps {
  localWorkflow: AutoGenTeam;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
}

const TeamInfoTab: React.FC<TeamInfoTabProps> = ({
  localWorkflow,
  handleChange,
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Team Information</h2>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Team Name</label>
          <input
            type="text"
            name="team_name"
            value={localWorkflow.team_name}
            onChange={handleChange}
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
            aria-label="Team Name"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Team Objective</label>
          <textarea
            name="team_objective"
            value={localWorkflow.team_objective}
            onChange={handleChange}
            className="w-full p-2 border rounded h-24 dark:bg-gray-700 dark:border-gray-600"
            aria-label="Team Objective"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Orchestration Type</label>
          <select
            name="orchestrationType"
            value={localWorkflow.orchestrationType}
            onChange={handleChange}
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
            aria-label="Orchestration Type"
          >
            <option value="sequential">Sequential</option>
            <option value="random">Random</option>
            <option value="auto">Auto</option>
          </select>
        </div>
      </div>
    </div>
  );
};

export default TeamInfoTab; 