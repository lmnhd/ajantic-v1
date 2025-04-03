import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AgentFormData } from './types';

interface AgentFormProps {
  initialData?: Partial<AgentFormData>;
  onSubmit: (data: AgentFormData) => void;
  onCancel?: () => void;
  submitLabel?: string;
  isEdit?: boolean;
}

const AgentForm: React.FC<AgentFormProps> = ({
  initialData = {},
  onSubmit,
  onCancel,
  submitLabel = "Add Agent",
  isEdit = false,
}) => {
  const [formData, setFormData] = useState<AgentFormData>({
    name: initialData.name || '',
    title: initialData.title || '',
    type: initialData.type || 'agent',
    roleDescription: initialData.roleDescription || '',
    expectedOutput: initialData.expectedOutput || '',
    toolHints: initialData.toolHints || [],
  });
  
  const [newToolHint, setNewToolHint] = useState('');
  
  const handleChange = (field: keyof AgentFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };
  
  const handleAddToolHint = () => {
    if (newToolHint.trim()) {
      setFormData(prev => ({
        ...prev,
        toolHints: [...prev.toolHints, newToolHint.trim()],
      }));
      setNewToolHint('');
    }
  };
  
  const handleRemoveToolHint = (index: number) => {
    setFormData(prev => ({
      ...prev,
      toolHints: prev.toolHints.filter((_, i) => i !== index),
    }));
  };
  
  const handleSubmit = () => {
    if (formData.name.trim() && formData.title.trim() && formData.roleDescription.trim()) {
      onSubmit(formData);
    }
  };
  
  return (
    <div className="space-y-5">
      {isEdit && <h3 className="font-semibold text-lg">Edit Agent</h3>}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left Column */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Agent Name</label>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Enter agent name"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Agent Title</label>
            <Input
              type="text"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="Enter agent title"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Agent Type</label>
            <Select
              value={formData.type}
              onValueChange={(value) => handleChange('type', value as any)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select agent type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="agent">Agent</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="researcher">Researcher</SelectItem>
                <SelectItem value="tool-operator">Tool Operator</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Expected Output (Optional)</label>
            <textarea
              value={formData.expectedOutput}
              onChange={(e) => handleChange('expectedOutput', e.target.value)}
              className="w-full p-2 border rounded h-20 dark:bg-gray-700 dark:border-gray-600"
              placeholder="What output is expected from this agent"
            />
          </div>
        </div>
        
        {/* Right Column */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Agent Role Description</label>
            <textarea
              value={formData.roleDescription}
              onChange={(e) => handleChange('roleDescription', e.target.value)}
              className="w-full p-2 border rounded h-40 dark:bg-gray-700 dark:border-gray-600"
              placeholder="Describe agent's role and responsibilities in detail"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Tool Hints</label>
            <div className="flex gap-2 mb-2">
              <Input
                type="text"
                value={newToolHint}
                onChange={(e) => setNewToolHint(e.target.value)}
                placeholder="Add tool hint"
              />
              <Button
                onClick={handleAddToolHint}
                variant="outline"
                size="sm"
                className="whitespace-nowrap"
                disabled={!newToolHint.trim()}
              >
                Add Hint
              </Button>
            </div>
            
            {/* Tool hints list */}
            <div className="flex flex-wrap gap-1 mt-2">
              {formData.toolHints.length > 0 ? (
                formData.toolHints.map((hint, idx) => (
                  <div key={idx} className="flex items-center bg-gray-100 dark:bg-gray-700 rounded px-2 py-1">
                    <span className="text-xs mr-1">{hint}</span>
                    <Button
                      onClick={() => handleRemoveToolHint(idx)}
                      className="text-gray-500 hover:text-red-500"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-500 italic">No tool hints added yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Action buttons */}
      <div className="flex justify-end gap-2 mt-4 pt-3 border-t">
        {onCancel && (
          <Button
            onClick={onCancel}
            variant="outline"
            className="bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500"
          >
            Cancel
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          className="bg-green-500 hover:bg-green-600 text-white"
          disabled={!formData.name.trim() || !formData.title.trim() || !formData.roleDescription.trim()}
        >
          {isEdit ? (
            "Save Changes"
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              {submitLabel}
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default AgentForm; 