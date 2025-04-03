export class WebSocketClient {
  private static instance: WebSocketClient | null = null;
  private ws: WebSocket | null = null;
  private messageHandlers: Set<(message: any) => void> = new Set();
  private maxHistorySize = 1000;
  private messageQueue: any[] = [];
  private queueSize = 100;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private timeout = 10000; // 10 second timeout
  private lastConnectionAttempt = 0;
  private minConnectionInterval = 5000;

  private constructor() {
    // console.log('WebSocketClient: Initializing singleton instance');
    this.connect();
  }

  public static getInstance(): WebSocketClient {
    if (!WebSocketClient.instance) {
      WebSocketClient.instance = new WebSocketClient();
    }
    return WebSocketClient.instance;
  }

  private canAttemptConnection(): boolean {
    const now = Date.now();
    const timeSinceLastAttempt = now - this.lastConnectionAttempt;
    
    if (timeSinceLastAttempt < this.minConnectionInterval) {
      // console.log(`WebSocketClient: Connection attempt too soon. Please wait ${(this.minConnectionInterval - timeSinceLastAttempt) / 1000} seconds`);
      return false;
    }
    
    return true;
  }

  private connect() {
    try {
      const wsUrl = process.env.NEXT_PUBLIC_AWS_WEBSOCKET_URL;
      // console.log('WebSocketClient: Connecting to', wsUrl);
      
      if (!wsUrl) {
        throw new Error('WebSocket URL not configured');
      }

      if (!this.canAttemptConnection()) {
        return;
      }

      this.lastConnectionAttempt = Date.now();
      this.ws = new WebSocket(wsUrl);

      // Set connection timeout
      const connectionTimeout = setTimeout(() => {
        if (this.ws?.readyState !== WebSocket.OPEN) {
          // console.log('WebSocketClient: Connection timeout');
          this.ws?.close();
        }
      }, this.timeout);

      this.ws.onmessage = (event) => {
        // console.log('WebSocketClient: Received message', event.data);
        try {
          const response = JSON.parse(event.data);
          // Handle API Gateway specific responses
          if (response.message === "Internal server error") {
            // console.error('WebSocketClient: API Gateway error:', response);
            // Don't trigger reconnect for API Gateway errors
            return;
          }
          // Process normal messages
          this.messageHandlers.forEach(handler => handler(response));
        } catch (error) {
          // console.error('WebSocketClient: Error parsing message:', error);
        }
      };

      this.ws.onclose = (event) => {
        // console.log('WebSocketClient: Connection closed', event.code, event.reason);
        this.handleError(new Error(`Connection closed: ${event.reason}`));
      };

      this.ws.onerror = (error) => {
        // console.error('WebSocketClient: WebSocket error:', error);
        this.handleError(new Error('WebSocket error occurred'));
      };

      this.ws.onopen = () => {
        // console.log('WebSocketClient: Connected successfully');
        clearTimeout(connectionTimeout);
        this.reconnectAttempts = 0;
        this.flushMessageQueue();
      };
    } catch (error) {
      // console.error('WebSocketClient: Error creating WebSocket:', error);
      this.handleError(new Error('Error creating WebSocket'));
    }
  }

  private handleError(error: Error) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      // console.log(`WebSocketClient: Will reconnect in ${delay}ms`);
      setTimeout(() => {
        this.reconnectAttempts++;
        // console.log(`WebSocketClient: Reconnecting attempt ${this.reconnectAttempts}`);
        this.connect();
      }, delay);
    } else {
      // console.log('WebSocketClient: Max reconnection attempts reached, falling back to local-only mode');
    }
  }

  private flushMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this.send(message);
    }
  }

  public send(message: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      // Format message for API Gateway
      const apiGatewayMessage = {
        action: 'message',
        type: message.type || 'info',
        message: message.message,
        metadata: message.metadata || {},
        timestamp: Date.now()
      };
      
      // Set message timeout
      const messageTimeout = setTimeout(() => {
        // console.log('WebSocketClient: Message timeout');
        this.handleError(new Error('Message timeout'));
      }, this.timeout);

      // console.log('WebSocketClient: Sending message', apiGatewayMessage);
      this.ws.send(JSON.stringify(apiGatewayMessage));
      clearTimeout(messageTimeout);
    } else {
      // console.log('WebSocketClient: Connection not open, queueing message');
      if (this.messageQueue.length < this.queueSize) {
        this.messageQueue.push(message);
      } else {
        // console.warn('WebSocketClient: Message queue full, dropping message');
      }
    }
  }

  public onMessage(handler: (message: any) => void) {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  public disconnect() {
    if (this.ws) {
      // console.log('WebSocketClient: Disconnecting');
      this.ws.close();
      this.ws = null;
    }
  }

  public static destroyInstance() {
    if (WebSocketClient.instance) {
      WebSocketClient.instance.disconnect();
      WebSocketClient.instance = null;
    }
  }

  // ... rest of existing methods ...
} 