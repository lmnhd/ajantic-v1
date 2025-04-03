import { useEffect, useState } from 'react';
import { AgentUserResponse } from '@/src/lib/types';

interface ActivityOverlayProps {
  isActive: boolean;
  children: React.ReactNode;
}

const ActivityOverlay = ({ isActive, children }: ActivityOverlayProps) => {
  if (!isActive) return null;
  
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white/90 p-6 rounded-lg shadow-xl max-w-md w-full">
        <div className="space-y-4">
          {children}
        </div>
      </div>
    </div>
  );
};

export function ChatInterface() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [activityStream, setActivityStream] = useState<React.ReactNode>(null);

  const handleSubmit = async (message: string) => {
    setIsProcessing(true);
    
    try {
      const response: AgentUserResponse = await sendMessage(message); // Your existing message sending function
      
     
      // Handle the rest of your response processing...
      
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsProcessing(false);
      setActivityStream(null); // Clear the activity stream when done
    }
  };

  const sendMessage = async (message: string) => {
    return {
      
    } as AgentUserResponse;
  }
  return (
    <div className="relative">
      {/* Your existing chat interface */}
      <div className={isProcessing ? 'blur-sm' : ''}>
        {/* Your chat messages and input */}
      </div>

      {/* Activity Overlay */}
      <ActivityOverlay isActive={isProcessing}>
        {activityStream || <div>Processing...</div>}
      </ActivityOverlay>
    </div>
  );
}
