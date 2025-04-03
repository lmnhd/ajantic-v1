import { X } from 'lucide-react';
import { useState } from 'react';

export default function AllowedContacts({
  allowedContacts,
  onUpdate,
  availableAgents
}: {
  allowedContacts: string[];
  onUpdate: (contacts: string[]) => void;
  availableAgents: Array<{ id: string; name: string }>;
}) {
  const toggleContact = (agentId: string) => {
    if (allowedContacts.includes(agentId)) {
      onUpdate(allowedContacts.filter(c => c !== agentId));
    } else {
      onUpdate([...allowedContacts, agentId]);
    }
  };

  return (
    <div className="space-y-4 p-4 bg-gray-900/50 rounded-lg border border-indigo-900/30 shadow-lg">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-indigo-300">Allowed Contacts</h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {availableAgents.map(agent => (
          <button
            key={agent.id}
            onClick={() => toggleContact(agent.id)}
            className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
              allowedContacts.includes(agent.id)
                ? 'bg-indigo-600/40 border-indigo-500 text-indigo-200 hover:bg-indigo-600/50'
                : 'bg-gray-800/40 border-gray-700 text-gray-300 hover:bg-gray-800/60'
            } border`}
          >
            <span>{agent.name}</span>
            {allowedContacts.includes(agent.id) && (
              <X className="h-4 w-4 ml-2 text-indigo-300" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
} 