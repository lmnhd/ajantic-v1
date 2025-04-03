import { WebSocketClient } from './websocket-client';

export interface LogMessage {
  timestamp: number;
  type: 'info' | 'warning' | 'error' | 'debug' | 'agent' | 'tool' | 'user' | 'system' | 'prompt';
  message: string;
  metadata?: Record<string, any>;
  source?: 'client' | 'server';
}

class Logger {
  private static instance: Logger;
  private wsClient: WebSocketClient;
  private messageHistory: LogMessage[] = [];
  private readonly maxHistorySize = 1000;
  private clients = new Set<(message: LogMessage) => void>();

  private constructor() {
    this.wsClient = WebSocketClient.getInstance();
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public async broadcast(message: LogMessage) {
    if (this.messageHistory.length >= this.maxHistorySize) {
      this.messageHistory = this.messageHistory.slice(-this.maxHistorySize/2);
    }
    
    this.messageHistory.push(message);
    
    if (typeof window === 'undefined') {
      console.log(`[${message.type.toUpperCase()}] ${message.message}`);
    }
    
    this.wsClient.send(message);
    this.clients.forEach(client => client(message));
  }

  // Public API
  public log(message: string, metadata?: Record<string, any>) {
    this.broadcast({
      timestamp: Date.now(),
      type: 'info',
      message,
      metadata
    });
  }

  public info(message: string, metadata?: Record<string, any>) {
    this.broadcast({
      timestamp: Date.now(),
      type: 'info',
      message,
      metadata
    });
  }

  public warn(message: string, metadata?: Record<string, any>) {
    this.broadcast({
      timestamp: Date.now(),
      type: 'warning',
      message,
      metadata
    });
  }

  public error(message: string, metadata?: Record<string, any>) {
    this.broadcast({
      timestamp: Date.now(),
      type: 'error',
      message,
      metadata
    });
  }

  public debug(message: string, metadata?: Record<string, any>) {
    this.broadcast({
      timestamp: Date.now(),
      type: 'debug',
      message,
      metadata
    });
  }

  public agent(message: string, metadata?: Record<string, any>) {
    this.broadcast({
      timestamp: Date.now(),
      type: 'agent',
      message,
      metadata
    });
  }

  public tool(message: string, metadata?: Record<string, any>) {
    this.broadcast({
      timestamp: Date.now(),
      type: 'tool',
      message,
      metadata
    });
  }

  public user(message: string, metadata?: Record<string, any>) {
    this.broadcast({
      timestamp: Date.now(),
      type: 'user',
      message,
      metadata
    });
  }

  public system(message: string, metadata?: Record<string, any>) {
    this.broadcast({
      timestamp: Date.now(),
      type: 'system',
      message,
      metadata
    });
  }

  public prompt(message: string, metadata?: Record<string, any>) {
    const logMessage: LogMessage = {
      type: 'prompt',
      message: message,  // The XML/prompt content goes directly in message
      timestamp: Date.now(),
      metadata: metadata || {}  // Additional context if needed
    };
    this.broadcast(logMessage);
  }

  public subscribe(callback: (message: LogMessage) => void): () => void {
    this.clients.add(callback);
    return () => this.clients.delete(callback);
  }

  public getHistory(): LogMessage[] {
    return [...this.messageHistory];
  }

  public clear() {
    this.messageHistory = [];
    this.clients.forEach(client => client({ 
      timestamp: Date.now(), 
      type: 'info', 
      message: 'Logs cleared' 
    }));
  }
}

export const logger = Logger.getInstance(); 