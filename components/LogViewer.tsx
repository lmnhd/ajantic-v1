import React, { useEffect, useRef, useState } from 'react';
import { useLogger } from '@/src/lib/hooks/useLogger';
import { LogMessage } from '@/src/lib/logger';
import { highlightCode } from '@/src/lib/prism-config';
import { FullscreenIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFullscreen } from '@/src/lib/useFullscreen';
//'info' | 'warning' | 'error' | 'debug' | 'agent' | 'tool' | 'user' | 'system' | 'prompt'
const typeColors = {
  info: 'text-blue-500',
  warning: 'text-yellow-500',
  error: 'text-red-500',
  debug: 'text-gray-500',
  agent: 'text-green-500',
  tool: 'text-purple-500',
  user: 'text-blue-500',
  system: 'text-gray-500',
  prompt: 'text-gray-500',
};

// At the top, add type definition
type LogType = 'info' | 'warning' | 'error' | 'debug' | 'agent' | 'tool' | 'user' | 'system' | 'prompt';

const LOG_ICONS: Record<LogType | 'default', string> = {
  info: "💡",
  warning: "⚠️",  // Changed from 'warn' to 'warning' to match LogType
  error: "❌",
  debug: "ℹ️",
  agent: "🤖",
  tool: "🛠️",
  user: "👤",
  system: "⚙️",
  prompt: "📝",
  default: "📋"
};

interface LogViewerProps {
  fullScreen?: boolean;
  defaultFlowDirection?: 'top-to-bottom' | 'bottom-to-top';
  themeColor?: 'violet' | 'blue' | 'indigo' | 'purple' | 'slate' | 'gray' | 'zinc' | 'emerald' | 'green' | 'red' | 'yellow' | string;
  messages?: LogMessage[];
  clear?: () => void;
  limitMessages?: boolean;
}

export function LogViewer({ 
  fullScreen = false, 
  defaultFlowDirection = 'bottom-to-top',
  themeColor = 'violet',
  messages = [],
  clear = () => {},
  limitMessages = true
}: LogViewerProps) {
  
  const bottomRef = useRef<HTMLDivElement>(null);
  const [selectedTypes, setSelectedTypes] = useState<Record<string, boolean>>(
    Object.keys(typeColors).reduce((acc, type) => ({ ...acc, [type]: true }), {})
  );
  const [expandedMetadata, setExpandedMetadata] = useState<Record<number, boolean>>({});
  const [expandedPrompts, setExpandedPrompts] = useState<Record<number, boolean>>({});
  const [expandedNestedMetadata, setExpandedNestedMetadata] = useState<Record<string, boolean>>({});
  const [autoScroll, setAutoScroll] = useState(true);
  const [flowDirection, setFlowDirection] = useState<'top-to-bottom' | 'bottom-to-top'>(defaultFlowDirection);
  const logContainerRef = useRef<HTMLDivElement>(null);
  let { messages: serverMessages, clear: serverClear } = useLogger();
  const [fullscreenRef, toggleFullscreen, isFullscreen] = useFullscreen<HTMLDivElement>();

  // Track the last message content to filter duplicates
  const lastMessageContent = useRef<string | null>(null);

  // Add a ref to track the previous message count
  const prevMessageCountRef = useRef<number>(0);

  // Merge server and client messages, and limit to 100 if limitMessages is true
  const combinedMessages = [...messages, ...serverMessages]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    //.filter(limitMessages ? msg => msg.type === "agent" || msg.type === "tool" || msg.type === "user" : msg => true )
    .slice(limitMessages ? -100 : 0);  // Keep only the last 100 messages if limiting is enabled

  // Combined clear function
  const clearAll = () => {
    clear();
    serverClear();
  };

  useEffect(() => {
    // Only scroll if autoScroll is enabled, we have messages, and the message count has changed
    if (!autoScroll || !logContainerRef.current) {
      return;
    }
    
    const currentMessageCount = combinedMessages.length;
    
    // Only scroll if the number of messages has changed (new messages added)
    if (currentMessageCount !== prevMessageCountRef.current) {
      const container = logContainerRef.current;
      const shouldScroll = container.scrollHeight > container.clientHeight;
    
      if (shouldScroll) {
        // Use RAF to ensure DOM is updated
        requestAnimationFrame(() => {
          if (flowDirection === 'bottom-to-top') {
            container.scrollTop = 0;
          } else {
            container.scrollTop = container.scrollHeight;
          }
        });
      }
      
      // Update the previous message count
      prevMessageCountRef.current = currentMessageCount;
    }
  }, [combinedMessages, autoScroll, flowDirection]);

  // Filter messages to ignore consecutive duplicates
  const filteredMessages = combinedMessages.filter(msg => {
    if (msg.message === lastMessageContent.current) {
      return false;
    }
    lastMessageContent.current = msg.message;
    return selectedTypes[msg.type];
  });

  const handleTypeToggle = (type: string) => {
    setSelectedTypes(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  const toggleMetadata = (index: number) => {
    setExpandedMetadata(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const togglePrompt = (index: number) => {
    setExpandedPrompts(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const toggleNestedMetadata = (path: string) => {
    setExpandedNestedMetadata(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  const isExpandableObject = (value: any): boolean => {
    return value !== null && 
           typeof value === 'object' && 
           !Array.isArray(value) && 
           Object.keys(value).length > 0;
  };

  const renderMetadataValue = (value: any, path: string, indentLevel: number = 0): React.ReactElement => {
    if (isExpandableObject(value)) {
      const isExpanded = expandedNestedMetadata[path] || false;
      return (
        <div className="ml-2">
          <button 
            onClick={() => toggleNestedMetadata(path)}
            className="text-gray-400 hover:text-gray-300"
          >
            {isExpanded ? '[-]' : '[+]'} {Object.keys(value).length} properties
          </button>
          {isExpanded && (
            <div className="pl-4 border-l border-gray-700 mt-1">
              {Object.entries(value).map(([key, nestedValue]) => (
                <div key={key} className="break-words mt-1">
                  <span className="text-gray-400">{key}:</span>
                  {renderMetadataValue(nestedValue, `${path}.${key}`, indentLevel + 1)}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    } else if (Array.isArray(value)) {
      const isExpanded = expandedNestedMetadata[path] || false;
      return (
        <div className="ml-2">
          <button 
            onClick={() => toggleNestedMetadata(path)}
            className="text-gray-400 hover:text-gray-300"
          >
            {isExpanded ? '[-]' : '[+]'} Array ({value.length})
          </button>
          {isExpanded && (
            <div className="pl-4 border-l border-gray-700 mt-1">
              {value.map((item, idx) => (
                <div key={idx} className="break-words mt-1">
                  <span className="text-gray-400">[{idx}]:</span>
                  {renderMetadataValue(item, `${path}[${idx}]`, indentLevel + 1)}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    } else {
      // For primitive values, just render them directly
      return (
        <span className="ml-2 break-words whitespace-pre-wrap">
          {typeof value === 'string' ? `"${value}"` : String(value)}
        </span>
      );
    }
  };

  const renderMessage = (msg: LogMessage, index: number) => {
    if (msg.type === 'prompt') {
      return expandedPrompts[index] ? (
        <div className="ml-2 break-words">
          <pre className="whitespace-pre-wrap">
            <code className="language-xml">
              {msg.message}
            </code>
          </pre>
        </div>
      ) : (
        <div className="ml-2 text-gray-400 italic">Prompt message (click [+] to expand)</div>
      );
    }
    
    return (
      <div className="ml-2 break-words whitespace-pre-wrap">{msg.message}</div>
    );
  };

 
  const logViewerContent = (
    <div ref={fullscreenRef} className={`w-full ${fullScreen ? 'h-5/6 max-w-4xl' : 'h-[500px]'} bg-${themeColor}-900/80 text-white text-sm rounded-lg overflow-hidden flex flex-col`}>
      <div className={`flex justify-between items-center p-2 bg-${themeColor}-900/80 shrink-0`}>
        <h3 className={`text-pretty font-semibold text-${themeColor}-500`}>Activity </h3>
        <div className="flex gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded border-gray-400"
            />
            Auto-scroll
          </label>
          <label className="flex items-center gap-2 text-sm">
            <select
              value={flowDirection}
              onChange={(e) => setFlowDirection(e.target.value as 'top-to-bottom' | 'bottom-to-top')}
              className="bg-gray-800 text-white rounded px-2 py-1 text-sm"
              aria-label="Message flow direction"
            >
              <option value="bottom-to-top">Newest First</option>
              <option value="top-to-bottom">Oldest First</option>
            </select>
          </label>
          <button 
            onClick={clearAll}
            className="px-2 py-1 bg-gray-800 hover:opacity-80 rounded text-sm"
          >
            Clear
          </button>
          <Button
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-gray-300"
                onClick={toggleFullscreen}
              >
                <FullscreenIcon className="w-3 h-3" />
              </Button>
        </div>
      </div>
      <div className="p-2 bg-gray-800 border-t border-gray-700 flex flex-wrap gap-2 shrink-0">
        {Object.entries(typeColors).map(([type, color]) => (
          <label key={type} className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedTypes[type]}
              onChange={() => handleTypeToggle(type)}
              className={`rounded border-gray-400 text-${themeColor}-500 focus:ring-${themeColor}-500`}
            />
            <span className={`${color} text-sm capitalize`}>{type}</span>
          </label>
        ))}
      </div>
      <div 
        ref={logContainerRef}
        className="p-4 overflow-y-auto flex-1 font-mono text-sm bg-black/60 bg-blend-soft-light"
      >
        <div className={`space-y-2 ${flowDirection === 'bottom-to-top' ? 'flex flex-col-reverse' : 'flex flex-col'}`}>
          {filteredMessages.map((msg, index) => (
            <div 
              key={index} 
              className={`break-words transition-colors duration-300 hover:bg-white/5 hover:border-l-2 hover:border-white/50 
                border-b border-gray-800 pb-2 mb-2 ${
                index === filteredMessages.length - 1 
                  ? `bg-${themeColor}-500/10 border-l-2 border-${themeColor}-500 pl-2 text-lg font-semibold` 
                  : 'pl-2'
              }`}
            >
              <div className="flex items-start">
                <span className="text-gray-400 inline-block">
                  {new Date(msg.timestamp).toLocaleString()} 
                </span>
                <span className={`ml-2 inline-block ${typeColors[msg.type]}`}>
                  {LOG_ICONS[msg.type as LogType] || LOG_ICONS.default} [{msg.type.toUpperCase()}]
                </span>
                {msg.type === 'prompt' && (
                  <button 
                    onClick={() => togglePrompt(index)}
                    className="ml-2 text-gray-400 hover:text-gray-300"
                  >
                    {expandedPrompts[index] ? '[-]' : '[+]'}
                  </button>
                )}
              </div>
              {renderMessage(msg, index)}
              {msg.metadata && Object.keys(msg.metadata).length > 0 && (
                <div className="ml-4">
                  <button 
                    onClick={() => toggleMetadata(index)}
                    className="text-gray-400 hover:text-gray-300"
                  >
                    {expandedMetadata[index] ? '[-] Metadata' : '[+] Metadata'}
                  </button>
                  {expandedMetadata[index] && (
                    <div className="mt-1 break-words">
                      {Object.entries(msg.metadata).map(([key, value]) => (
                        <div key={key} className="break-words mt-1">
                          <span className="text-gray-400">{key}:</span>
                          {renderMetadataValue(value, `msg_${index}_${key}`, 0)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        <div ref={bottomRef} />
      </div>
    </div>
  );

  useEffect(() => {
    highlightCode();
  }, [filteredMessages, expandedPrompts]);

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50">
        <div className="absolute inset-0 h-screen w-screen p-4 bg-black/60 backdrop-blur-sm mix-blend-color-burn" />
        <div className="absolute inset-0 flex items-center justify-center p-4">
          {logViewerContent}
        </div>
      </div>
    );
  }

  return logViewerContent;
} 