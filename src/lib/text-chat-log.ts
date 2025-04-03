"use client"

import { ServerMessage } from "@/src/lib/types";

/**
 * Standardized interface for text chat logs across the application
 * This combines properties needed by various components while maintaining backward compatibility
 */
export interface TextChatLogProps {
  // Core properties (always required)
  message: string;
  role: "function" | "agent" | "system" | "prompt";
  
  // Optional but commonly used
  timestamp?: Date;
  agentName?: string;
  
  // For compatibility with research-analysis implementation
  id?: string;
  content?: string;
  metadata?: any;
}

// Main Function - takes a TextChatLogProps and generates a formatted csv file and downloads it
export const TEXT_CHAT_LOG_generateCsvFile = (textChatLogProps: TextChatLogProps[]) => {
  const csvContent = textChatLogProps.map(log => `${log.timestamp},${log.role},${log.agentName},${log.message.replace(/,/g, '&')}`).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'chat_log.csv';
  a.click();
  URL.revokeObjectURL(url);
};


// Keep track of collected messages
let collectedMessages: string[] = [];

export const TEXT_CHAT_LOG_writeToFile = async ({
  message,
  agentName,
  role,
  timestamp = new Date()
}: TextChatLogProps) => {
  try {
    // Format the message with timestamp, role and agent name
    const formattedMessage = `${message}\n`;
    
    // Add to collected messages
    collectedMessages.push(formattedMessage);
    
    return true;
  } catch (error) {
    console.error('Error writing to chat log:', error);
    return false;
  }
};

// Helper function to write multiple messages at once
export const TEXT_CHAT_LOG_writeMessagesToFile = async (messages: ServerMessage[], downloadNow: boolean = false) => {
  if (messages.length === 0) {
    return false;
  }

  try {
    const timestamp = new Date();
    
    // Format and collect new messages
    const newMessages = messages.map(msg => 
      `${msg.content}\n`
    );
    
    // Add to collected messages
    collectedMessages.push(...newMessages);
    
    // Only download if downloadNow is true
    if (downloadNow) {
      const allMessages = collectedMessages.join('');
      
      const blob = new Blob([allMessages], { type: 'text/plain' });
      const downloadLink = document.createElement('a');
      downloadLink.href = URL.createObjectURL(blob);
      downloadLink.download = `chat-log-${timestamp.toISOString().split('T')[0]}.txt`;
      
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      
      URL.revokeObjectURL(downloadLink.href);
      
      // Clear collected messages after download
      collectedMessages = [];
    }
    
    return true;
  } catch (error) {
    console.error('Error writing messages to chat log:', error);
    return false;
  }
};

// Helper function to clear collected messages without downloading
export const TEXT_CHAT_LOG_clearMessages = () => {
  collectedMessages = [];
};

// Helper function to get current collected messages without downloading
export const TEXT_CHAT_LOG_getCollectedMessages = () => {
  return collectedMessages.join('');
};

