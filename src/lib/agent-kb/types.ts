import { AISessionState } from "@/src/lib/types";

export interface KnowledgeBaseEntryMetadata {
  source: string;
  type: string;
  timestamp: number;
  grade: string;
  gradeExplanation?: string;
  totalPages?: number;
  totalChunks?: number;
  documentId?: string;
  groupId?: string;
  implementation?: string;
  chunkIndex?: number;
}

export interface KnowledgeBaseEntry {
  id: string;
  content: string;
  metadata: KnowledgeBaseEntryMetadata;
}

export interface KnowledgeBaseState {
  entries: KnowledgeBaseEntry[];
  isEnabled: boolean;
  crawlAllLinks: boolean;
  crawlDepth: number;
  loadingStates: {
    isUploadingFile: boolean;
    isProcessingUrl: boolean;
    isFetchingEntries: boolean;
    isDeleting: boolean;
    isClearing: boolean;
    isAutoCreating: boolean;
  };
}

export interface KnowledgeBaseProps {
  agentName: string;
  userId: string;
  namespace: string;
  onKnowledgeBaseUpdate?: () => void;
  setHasKnowledgeBase?: (hasKnowledgeBase: boolean) => void;
  isEnabled: boolean;
  localState: AISessionState;
  toggleFullScreen: () => void;
  autoKBArgs?: {
    setAgentActive?: (active: boolean) => void;
    agentTitle: string;
    agentRole: string;
    teamObjectives: string;
  };
}
