import { AutoGenAgent, AutoGenTeam } from "@/src/lib/autogen/autogen";

export interface WorkflowProps {
  autoGenWorkflow: AutoGenTeam;
  setAutoGenWorkflow: (autoGenWorkflow: AutoGenTeam) => void;
}

export interface AgentFormData {
  name: string;
  title: string;
  type: 'manager' | 'agent' | 'researcher' | 'tool-operator';
  roleDescription: string;
  expectedOutput: string;
  toolHints: string[];
}

export interface AgentCardProps {
  agent: AutoGenAgent;
  isNewAgent?: boolean;
  onEdit?: (agent: AutoGenAgent) => void;
  onRemove?: (name: string) => void;
  onAddToSequence?: (name: string) => void;
  isInSequence?: boolean;
} 