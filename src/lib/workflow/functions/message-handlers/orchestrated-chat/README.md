# Orchestrated Chat System

This directory contains the modular implementation of the orchestrated chat system, which manages conversations between multiple AI agents.

## Structure

The orchestrated chat system is organized as follows:

- **Root**: The main `handleOrchestratedChatSubmit` function in `../orchestrated-chat.ts`
- **Components**:
  - `initialize-state.ts`: Functions for state initialization and setup
  - `agent-processing.ts`: Functions for processing agent responses and handling agent ordering
  - `conversation-management.ts`: Functions for managing conversation state, summarization, and storage
  
- **Utilities**:
  - `cancel-chat.ts`: Utilities for cancelling orchestration
  - `pause-chat.ts`: Utilities for pausing and continuing orchestration
  - `extract-context.ts`: Functions for extracting context from conversations
  - `extract-user-action-request.ts`: Functions for handling user action requests
  - `implicit-orchestrator.ts`: Logic for implicit orchestration between agents
  - `summarize-conversation.ts`: Functions for summarizing conversations
  - `wf-orch-memory.ts`: Conversation memory management

## Key Concepts

1. **Orchestration**: Manages the flow of conversation between multiple agents in a structured pattern
2. **Agent Processing**: Handles agent responses and sequence
3. **Conversation Management**: Handles how conversations are processed, stored, and managed over time
4. **Context Extraction**: Extracts and maintains relevant context from conversations
5. **Memory**: Stores and retrieves conversation history

## Main Function Flow

The main `handleOrchestratedChatSubmit` function follows this flow:

1. Initialize state and get required variables
2. Set up agents based on order and other parameters
3. Create orchestration props to control the flow
4. For each round:
   - Summarize conversation (if needed)
   - Handle special cases (info needed from user, user action needed)
   - Process each agent in sequence
   - Update conversation context
5. Store conversation in memory if worthy
6. Finalize orchestration and clean up

## TODO Items

- Add memory to the orchestrator (as noted in the main function)
- Implement automatic agent ordering logic
- Improve factchecking capabilities

## Future Improvements

- Further modularize the code for better testability
- Add more robust error handling
- Improve conversation memory and retrieval
- Enhance the agent sequence determination logic 