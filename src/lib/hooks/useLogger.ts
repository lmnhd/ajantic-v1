import { useEffect, useState, useCallback } from 'react';
import { logger, LogMessage } from '../logger';
import { WebSocketClient } from '../websocket-client';

export function useLogger() {
  const [messages, setMessages] = useState<LogMessage[]>([]);

  useEffect(() => {
    console.log('useLogger: Initializing');
    const wsClient = WebSocketClient.getInstance();
    
    // Add message handler for WebSocket-only messages
    wsClient.onMessage((message) => {
     // console.log('LogViewer received WebSocket message:', message);
      // Accept all messages regardless of source
      setMessages(prev => [...prev, {
        ...message,
        source: message.source || 'server'  // Ensure source is set
      }]);
    });

    // Subscribe to local logger for client-side logs
    const unsubscribe = logger.subscribe((message) => {
      console.log('LogViewer received local message:', message);
      // Accept all messages regardless of source
      setMessages(prev => [...prev, {
        ...message,
        source: message.source || 'client'  // Ensure source is set
      }]);
    });
    
    return () => {
      console.log('useLogger: Cleaning up');
      unsubscribe();
    };
  }, []);

  return {
    messages,
    log: useCallback((message: string, metadata?: Record<string, any>) => {
      console.log('useLogger: Logging message', message);
      logger.log(message, metadata);
    }, []),
    warn: useCallback((message: string, metadata?: Record<string, any>) => {
      logger.warn(message, metadata);
    }, []),
    error: useCallback((message: string, metadata?: Record<string, any>) => {
      logger.error(message, metadata);
    }, []),
    debug: useCallback((message: string, metadata?: Record<string, any>) => {
      logger.debug(message, metadata);
    }, []),
    clear: useCallback(() => {
      logger.clear();
      setMessages([]);
    }, [])
  };
} 