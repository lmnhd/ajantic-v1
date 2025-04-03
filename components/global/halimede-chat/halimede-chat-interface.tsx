'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useChat } from 'ai/react'

const HalimedeChatInterface1 = () => {
  console.log('Rendering HalimedeChatInterface1');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
    api: '/api/halimede-chat',
    onResponse: (response) => {
      console.log('API Response:', response);
    },
    onFinish: (message) => {
      console.log('Message finished:', message);
    },
    onError: (error) => {
      console.error('Chat Error:', error);
    },
    initialMessages: [
      {
        id: '1',
        role: 'assistant',
        content: "👋 Hi there! I'm your Halimede AI assistant. I can help you learn about our services and the Ajantic multi-agent framework."
      },
      {
        id: '2',
        role: 'assistant',
        content: "Feel free to ask me about:\n• Our multi-agent teams\n• Code-free development\n• Cloud deployment\n• Enterprise security\n• Getting started"
      },
      {
        id: '3',
        role: 'assistant',
        content: "💡 Pro tip: You can even chat directly with Nathaniel, our founder, through this interface! Just mention you'd like to speak with him and I'll connect you."
      }
    ],
  })
  const [isExpanded, setIsExpanded] = useState(false)
  const [isMinimized, setIsMinimized] = useState(true)  // Start minimized

  // Log state changes
  useEffect(() => {
    console.log('Messages updated:', messages);
  }, [messages]);

  useEffect(() => {
    console.log('Loading state:', isLoading);
  }, [isLoading]);

  useEffect(() => {
    if (error) {
      console.error('Error state:', error);
    }
  }, [error]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Log form submission
  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    console.log('Form submitted with input:', input);
    try {
      await handleSubmit(e);
    } catch (error) {
      console.error('Submit error:', error);
    }
  };

  if (isMinimized) {
    return (
      <button
        onClick={() => {
          console.log('Opening chat');
          setIsMinimized(false);
        }}
        className="fixed bottom-4 right-4 bg-indigo-600 text-white p-4 rounded-full shadow-lg hover:bg-indigo-700 transition-all duration-300 flex items-center justify-center"
        aria-label="Open chat"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
        {messages.length > 3 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {messages.length - 3}
          </span>
        )}
      </button>
    )
  }

  return (
    <div 
      className={`fixed transition-all duration-300 ease-in-out ${
        isExpanded 
          ? 'bottom-0 right-0 w-full sm:w-[600px] h-[80vh]' 
          : 'bottom-4 right-4 w-96'
      } bg-white/80 backdrop-blur-lg rounded-lg shadow-xl border border-gray-200/50 overflow-hidden`}
    >
      {/* Chat Header */}
      <div className="bg-indigo-600/90 backdrop-blur-sm p-4 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-white flex items-center">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          Ask about Halimede AI
        </h3>
        <div className="flex items-center space-x-2">
          <button 
            onClick={() => {
              console.log('Toggling expanded state');
              setIsExpanded(!isExpanded);
            }}
            className="text-white hover:text-gray-200 transition-colors p-1"
            aria-label={isExpanded ? 'Minimize chat' : 'Expand chat'}
          >
            <svg 
              className={`w-5 h-5 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            onClick={() => {
              console.log('Minimizing chat');
              setIsMinimized(true);
            }}
            className="text-white hover:text-gray-200 transition-colors p-1"
            aria-label="Minimize chat"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages Container */}
      <div className={`overflow-y-auto p-4 space-y-4 transition-all duration-300 ${
        isExpanded ? 'h-[calc(80vh-8rem)]' : 'h-96'
      }`}>
        {messages.map((message, index) => {
          console.log('Rendering message:', message);
          return (
            <div
              key={message.id}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 whitespace-pre-wrap ${
                  message.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {message.content}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} /> {/* Auto-scroll anchor */}
      </div>

      {/* Input Form */}
      <form onSubmit={handleFormSubmit} className="border-t border-gray-200 p-4 bg-white/50">
        <div className="flex space-x-4">
          <input
            value={input}
            onChange={(e) => {
              console.log('Input changed:', e.target.value);
              handleInputChange(e);
            }}
            placeholder="Ask anything about Halimede AI..."
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            className={`px-4 py-2 rounded-lg transition-colors ${
              isLoading 
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
            disabled={isLoading}
          >
            {isLoading ? 'Thinking...' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default HalimedeChatInterface1 