import React from 'react';
import { Button } from '@/components/ui/button';
import { AgentCardProps } from './types';

const AgentCard: React.FC<AgentCardProps> = ({
  agent,
  isNewAgent = false,
  onEdit,
  onRemove,
  onAddToSequence,
  isInSequence = false,
}) => {
  return (
    <div 
      className={`flex flex-col p-4 border rounded-lg shadow-sm hover:shadow-md transition-shadow ${
        isNewAgent 
          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' 
          : 'bg-white dark:bg-gray-800'
      }`}
    >
      <div className="flex justify-between items-center mb-3 pb-2 border-b">
        <div className="flex items-center">
          <span className="font-semibold text-lg">{agent.name}</span>
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
        <div className="flex space-x-2">
          {onEdit && (
            <button
              onClick={() => onEdit(agent)}
              className="p-1.5 bg-blue-100 text-blue-600 hover:bg-blue-200 rounded-md transition-colors"
              title="Edit agent"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
          )}
          {onRemove && (
            <button
              onClick={() => onRemove(agent.name)}
              className="p-1.5 bg-red-100 text-red-600 hover:bg-red-200 rounded-md transition-colors"
              title="Remove agent"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
            </button>
          )}
          {onAddToSequence && (
            <Button
              onClick={() => onAddToSequence(agent.name)}
              size="sm"
              variant={isNewAgent ? "default" : "outline"}
              className={isNewAgent 
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "text-blue-600 border-blue-600 hover:bg-blue-50"
              }
              disabled={isInSequence}
            >
              {isInSequence ? (
                "Added"
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  Add
                </>
              )}
            </Button>
          )}
        </div>
      </div>
      
      {/* Agent Properties */}
      <div className="space-y-2 text-sm">
        {/* Title */}
        <div className="flex">
          <span className="w-32 text-gray-500 dark:text-gray-400">Title:</span>
          <span className="font-medium">{agent.title}</span>
        </div>
        
        {/* Role Description */}
        <div className="flex flex-col">
          <span className="text-gray-500 dark:text-gray-400 mb-1">Role Description:</span>
          <p className="pl-2 border-l-2 border-gray-200 dark:border-gray-700">
            {agent.roleDescription}
          </p>
        </div>
        
        {/* Expected Output - Only shown if it exists */}
        {agent.expectedOutput && (
          <div className="flex flex-col">
            <span className="text-gray-500 dark:text-gray-400 mb-1">Expected Output:</span>
            <p className="pl-2 border-l-2 border-gray-200 dark:border-gray-700">
              {agent.expectedOutput}
            </p>
          </div>
        )}
        
        {/* Tool Hints - Only shown if they exist */}
        {agent.toolHints && agent.toolHints.length > 0 && (
          <div className="flex flex-col">
            <span className="text-gray-500 dark:text-gray-400 mb-1">Tool Hints:</span>
            <div className="flex flex-wrap gap-1 pl-2">
              {agent.toolHints.map((tool, idx) => (
                <span key={idx} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                  {tool}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentCard; 