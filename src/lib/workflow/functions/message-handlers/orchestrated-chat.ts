import {
  AgentComponentProps,
  AgentFoundationalPromptProps,
  AgentTypeEnum,
  AgentUserResponse,
  AISessionState,
  AutoOrchestrationProps,
  ContextContainerProps,
  ContextSet,
  ModelArgs,
  ModelProviderEnum,
  OrchestrationProps,
  OrchestrationType,
  ServerMessage,
} from "@/src/lib/types";
import { AnalysisState } from "../../../store/analysis-store";

import { updateMessages } from "../message-handlers";
import { logger } from "@/src/lib/logger";
import { summarizeConversation } from "./orchestrated-chat/summarize-conversation";
import {
  clearCancellationFlag,
  isChatCancelled,
  ORCHESTRATION_CANCEL_clearAllFlags,
} from "./orchestrated-chat/cancel-chat";

import { TextChatLogProps } from "@/src/lib/text-chat-log";

import {
  ORCHESTRATION_PAUSE_isChatPaused,
  ORCHESTRATION_PAUSE_clearFlag,
  ORCHESTRATION_PAUSE_clearContinueFlag,
  ORCHESTRATION_PAUSE_continueChat,
  ORCHESTRATION_PAUSE_resetAllFlags,
} from "./orchestrated-chat/pause-chat";
import { MEMORY_store } from "../../../agent-memory/store-retrieve";
import { isConversationMemoryWorthy } from "./orchestrated-chat/wf-orch-memory";
import { CONVERSATION_store, formatDayName } from "../../../conversation";
import { THINKING_MODELS } from "@/src/app/api/model/model-types";
import {
  UTILS_cleanConversationForStorage,
  UTILS_getModelArgsByName,
  UTILS_getModelsJSON,
} from "@/src/lib/utils";

// New imports for refactored modules
import {
  initializeOrchestrationState,
  setCurrentActiveAgent,
  createOrchestrationProps,
} from "./orchestrated-chat/initialize-state";
import {
  processSingleAgentTurn,
  handleOrchestrationPause,
  handleAgentSequenceReordering,
} from "./orchestrated-chat/agent-processing";
import {
  summarizeCurrentConversation,
  handleInfoNeededFromUser,
  handleUserActionNeeded,
  storeConversation,
  updateContextFromConversation,
  storeConversationInMemory,
  finalizeOrchestration,
} from "./orchestrated-chat/conversation-management";
import {
  autoRedirectOrchestrator,
  autoRedirectOrchestrator2,
  autoRedirectOrchestrator3,
  handleNextAutoAgent,
} from "./orchestrated-chat/auto-agent-next";
import { toast } from "@/components/ui/use-toast";
import { ORCHESTRATION_autoModeRedirect } from "./orchestrated-chat/auto-redirect";

export interface BasicAgentChatProps {
  message: string;
  query: string;
  currentConversation: ServerMessage[];
  agentsByName: {
    agents: AgentComponentProps[];
    name: string;
    objectives: string;
  };
  contextSets: ContextContainerProps[];
  foundationalProps: AgentFoundationalPromptProps | null;
  localState: AISessionState;
  userId: string;
  teamName: string;
  msgGoRound: boolean;
  streaming: boolean;
  textChatProps: TextChatLogProps[];
  orchestrationProps: OrchestrationProps;
}

// TODO: add memory to the orchestrator
export async function handleOrchestratedChatSubmit(
  chatMode: OrchestrationType,
  numRounds: number, // 0 means unlimited rounds up to maxRounds - will stop when a natural conclusion is reached
  maxRounds: number = 10, // Only has effect if numRounds is 0
  order: "sequential" | "seq-reverse" | "random" | "auto" = "sequential",
  get: () => AnalysisState,
  set: (state: Partial<AnalysisState>) => void,
  customAgentSet: string[] = [],
  implicitOrchestratorModelArgs: ModelArgs = UTILS_getModelArgsByName(
    UTILS_getModelsJSON().OpenAI["gpt-3.5-turbo-0125"].name,
    0
  ),
  userActionModelArgs: ModelArgs = UTILS_getModelArgsByName(
    UTILS_getModelsJSON().OpenAI["gpt-3.5-turbo-0125"].name,
    0
  ),
  factCheck: boolean = false
) {
  console.log("handleOrchestratedChatSubmit starting with params:", {
    chatMode, numRounds, maxRounds, order, customAgentSet
  });

  try {
    // Initialize state and get required variables
    const {
      localState,
      currentConversation: initialConversation,
      teamName,
      objectives,
      currentAgents: initialAgents,
      userId,
      contextSet,
      agentGlobalChatInput,
    } = initializeOrchestrationState(get, set, customAgentSet);

    // Handle agents order if needed
    let currentAgents = [...initialAgents];
    if (order === "seq-reverse") {
      currentAgents.reverse();
    } else if (order === "random") {
      currentAgents.sort(() => Math.random() - 0.5);
    } else if (order === "auto") {
      const _managerAgent = localState.currentAgents.agents.find(
        (a) => a.type === AgentTypeEnum.MANAGER
      ) as AgentComponentProps;
      currentAgents = [_managerAgent, ...currentAgents];
    }

    // Set current agent and create orchestration props
    let currentAgent: AgentComponentProps =
      order === "auto"
        ? (currentAgents.find(
            (a) => a.type === AgentTypeEnum.MANAGER
          ) as AgentComponentProps)
        : currentAgents[0];
    await setCurrentActiveAgent(set, localState, currentAgent);

    if (!currentAgent) {
      throw new Error("No manager agent found");
    }

    // Create orchestration props to control the flow
    const props = createOrchestrationProps(
      chatMode,
      order,
      currentAgents,
      currentAgent,
      agentGlobalChatInput,
      userId,
      teamName,
      objectives
    );
    props.numRounds = numRounds; // Make sure to set this value

    // Start with the initial conversation state
    let currentConversation = [...initialConversation];

    logger.log("Beginning Orchestrated Chat...", {
      mode: chatMode,
      rounds: numRounds,
      agents: currentAgents.map((a) => a.name),
      order: order,
      initialMessage: agentGlobalChatInput,
    });

    let autoChatInProgress = false;

    if (props.agentOrder === "auto") {
      autoChatInProgress = true;
      props.numRounds = 1;
      numRounds = 1;
      set({ rounds: 1 });
    }

    // Main rounds loop
    for (
      props.currentRound = 0;
      props.currentRound < (numRounds === 0 ? maxRounds : numRounds);
      props.currentRound++
    ) {
      // If not the first round, summarize the conversation
      if ((props.currentRound > 0 || currentConversation.length > 1) && !autoChatInProgress) {
        const summarizeResult = await summarizeCurrentConversation(
          currentConversation,
          agentGlobalChatInput,
          contextSet.sets
        );

        currentConversation = summarizeResult.updatedConversation;
        props.currentSummary = summarizeResult.summary;

        set({ currentConversation });
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Handle special cases
        if (summarizeResult.isInfoNeededFromUser) {
          await handleInfoNeededFromUser(
            currentConversation,
            props,
            contextSet,
            teamName,
            set
          );
          return;
        }

        if (summarizeResult.isUserActionNeeded) {
          await handleUserActionNeeded(
            currentConversation,
            props,
            userActionModelArgs,
            set
          );
          return;
        }

        // In unlimited rounds mode, stop when conversation is concluded
        if (summarizeResult.isResolvedOrConcluded && props.numRounds === 0) {
          break;
        }
      }

      // Track processing count per agent for the round
      const agentProcessCount = new Map<string, number>();
      currentAgents.forEach((agent) => agentProcessCount.set(agent.name, 0));

      props.currentCycleStep = 0;

      // Begin the cycle within a round
      //****BEGIN OF CYCLE */
      while (
        (props.agentOrder !== "auto" &&
          props.currentCycleStep < currentAgents.length) ||
        autoChatInProgress
      ) {
        // Check for cancellation
        if (isChatCancelled()) {
          clearCancellationFlag();
          set({ agentActive: false });
          logger.log("Chat Cancelled");
          return;
        }

        // Check for pause
        ORCHESTRATION_PAUSE_clearContinueFlag();
        if (
          (props.currentCycleStep !== 0 || props.currentRound > 0) &&
          ORCHESTRATION_PAUSE_isChatPaused()
        ) {
          while (
            ORCHESTRATION_PAUSE_isChatPaused() &&
            !ORCHESTRATION_PAUSE_continueChat()
          ) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }

        if (props.agentOrder !== "auto") {
          // Get current agent FOR sequential flow
          currentAgent = currentAgents[props.currentCycleStep];
          props.currentAgent = currentAgent;

          // Skip agents that have already processed twice
          const processCount = agentProcessCount.get(currentAgent.name) || 0;
          if (processCount >= 2) {
            props.currentCycleStep++;
            continue;
          }

          // Update processing count
          agentProcessCount.set(currentAgent.name, processCount + 1);
        } else {
          const _lastMessage =
            currentConversation[currentConversation.length - 1];

          const _currentMessageRole =
            (_lastMessage  && props.currentCycleStep !== 0 && _lastMessage.role) || "user";
          const _messageSenderName =
            (_lastMessage && props.currentCycleStep !== 0 && _lastMessage.agentName ) || currentAgent.name;
          const _messageSender = currentAgents.find(
            (a) => a.name === _messageSenderName
          );
          const _messageFrom =
            _currentMessageRole === "user"
              ? "user"
              : _currentMessageRole === "assistant"
              ? _messageSender?.type === "manager"
                ? "manager"
                : "agent"
              : "system";

          props.autoProps = {
            ...props.autoProps,
            messageFrom: _messageFrom,
          } as AutoOrchestrationProps;
        }

       

        // Get current message for this agent
        let currentMessage =
          props.currentRound === 0 && props.currentCycleStep === 0
            ? props.currentSummary
              ? `${props.initialMessage}`
              : props.initialMessage
            : `From ${
                currentConversation[currentConversation.length - 1].agentName
              }: ${
                currentConversation[currentConversation.length - 1].content
              }`;

        // Handle agent sequence reordering if needed
        if (props.agentOrder === "auto") {
          // Should determine the next agent to call and perform any between tasks like rewriting the message
          props.autoProps = {
            ...props.autoProps,
            currentMessage: currentMessage,
            contextSets: contextSet.sets,
            messageHistory: currentConversation,
            summarizeConversation: false,
          } as AutoOrchestrationProps;
          const _autoResult = await ORCHESTRATION_autoModeRedirect(props);

          console.log("Client received from autoRedirectOrchestrator3:", JSON.stringify(_autoResult, null, 2));

          if (_autoResult.workflowComplete) {
            autoChatInProgress = false;
            props.currentCycleStep = currentAgents.length;
            // reset pause and cancel flags
            ORCHESTRATION_PAUSE_clearFlag();
            ORCHESTRATION_CANCEL_clearAllFlags();
            set({ agentActive: false });
            return;
          } else {
            // currentAgent = _autoResult.nextAgent;
            currentMessage = _autoResult.currentMessage;
            const _curAgent = currentAgents.find(
              (a) => a.name === _autoResult.nextAgent
            );
            if (_curAgent) {
              props.currentAgent = _curAgent;
              currentAgent = _curAgent;

              await setCurrentActiveAgent(set, localState, currentAgent);
            }

            if (_autoResult.contextRequest) {
              //update the context
              contextSet.sets = _autoResult.newContext ?? [];
              props.autoProps.contextSets = contextSet.sets;
            }

            if (_autoResult.redirectToUser) {
              // If info request, replace the last message with the new message
              if (_autoResult.infoRequest) {
                currentConversation[currentConversation.length - 1].content =
                  _autoResult.currentMessage;
              } else {
                // Update the current conversation with the last message
                currentConversation.push({
                  role: "assistant",
                  agentName:
                    currentConversation[currentConversation.length - 1]
                      .agentName,
                  content: _autoResult.currentMessage,
                });
              }
              set({
                agentGlobalChatInput: "Information requested...",
                currentConversation,
                agentActive: false,
                contextSet: {
                  sets: _autoResult.newContext || contextSet.sets,
                  teamName: teamName,
                },
              });

              await storeConversation(currentConversation, userId);
              // Store conversation in memory if worthy
              //await storeConversationInMemory(currentConversation, currentAgents, userId);
              await new Promise((resolve) => setTimeout(resolve, 500));
              // reset pause and cancel flags
              ORCHESTRATION_PAUSE_clearFlag();
              ORCHESTRATION_CANCEL_clearAllFlags();
              
              return;
            }

            if (_autoResult.timeToSummarize) {
              // Summarize the conversation
              const summarizeResult = await summarizeCurrentConversation(
                currentConversation,
                agentGlobalChatInput,
                contextSet.sets
              );
              currentConversation = summarizeResult.updatedConversation;
              props.currentSummary = summarizeResult.summary;
              set({ currentConversation });
              await new Promise((resolve) => setTimeout(resolve, 500));
            }
          }
        } else if (
          (props.currentRound === 0 && props.currentCycleStep > 0) ||
          props.currentRound > 0
        ) {
          const { updatedAgents, updatedCurrentStep } =
            await handleAgentSequenceReordering(
              props,
              currentMessage,
              currentConversation,
              currentAgents,
              agentProcessCount
            );

          currentAgents = updatedAgents;
          props.currentCycleStep = updatedCurrentStep;
          props.numAgents = currentAgents.length;

          // Re-get the current agent
          currentAgent = currentAgents[props.currentCycleStep];
          props.currentAgent = currentAgent;
        }

        //set({ localState: { ...localState, currentAgent: currentAgent } });
        await setCurrentActiveAgent(set, localState, currentAgent);

        // Process the current agent's turn
        const agentTurnResult = await processSingleAgentTurn(
          props,
          currentAgents,
          currentConversation,
          localState,
          userId,
          teamName,
          objectives,
          contextSet.sets,
          set,
          props.currentRound === 0 && props.currentCycleStep === 0
        );

        if( !agentTurnResult.agentResponse || agentTurnResult.error ){
          // Show warning to user that the model call failed
          logger.error("Model call failed", {
            agent: props.currentAgent?.name,
            roundNum: props.currentRound,
            stepNum: props.currentCycleStep,
            error: agentTurnResult.error ? agentTurnResult.error : "Unknown error",
          });
          // Show a toast to the user that the model call failed
          toast({
            title: "Model call failed",
            description: `Error: ${agentTurnResult.error ? agentTurnResult.error : "Unknown error"}`,
            variant: "destructive",
          });

          // Set the agent response to a generic error message
          agentTurnResult.agentResponse = "An error occurred while processing your request. Please try again.";
          // Set the continue processing to false
          agentTurnResult.continueProcessing = false;
          // Set the updated conversation to the current conversation
          agentTurnResult.updatedConversation = currentConversation;
          // Set the context sets to the current context sets
          agentTurnResult.contextSets = contextSet.sets;

          // Update the conversation with the error message// clear cancel and pause flags
          ORCHESTRATION_CANCEL_clearAllFlags();
          ORCHESTRATION_PAUSE_clearFlag();

          set({
            //agentGlobalChatInput: "",
            agentActive: false,
            currentConversation: [...currentConversation, {
              role: "assistant",
              agentName: props.currentAgent?.name,
              content: agentTurnResult.agentResponse || "An error occurred while processing your request. Please try again.",
            }],
            contextSet: { 
              sets: agentTurnResult.contextSets,
              teamName: teamName,
            },
          });
          return;
        }

        if (!agentTurnResult.continueProcessing) {
          return;
        }

        // Update conversation with agent response
        currentConversation = agentTurnResult.updatedConversation;
        props.autoProps!.contextSets = agentTurnResult.contextSets;
        contextSet.sets = agentTurnResult.contextSets;
        // Store the updated conversation
        set({
          agentGlobalChatInput: "",
          currentConversation,
          contextSet: {
            sets: agentTurnResult.contextSets,
            teamName: teamName,
          },
        });

        await new Promise((resolve) => setTimeout(resolve, 500));

        // Store conversation to database if not the first exchange
        if (props.currentRound > 0 || props.currentCycleStep > 0) {
          await storeConversation(currentConversation, userId);
        }

        await new Promise((resolve) => setTimeout(resolve, 500));

        // Reorder agents randomly if needed
        if (order === "random") {
          currentAgents.sort(() => Math.random() - 0.5);
          props.numAgents = currentAgents.length;
        }

        // Log result and move to next agent
        logger.log(`${props.currentAgent?.name} response processed`, {
          agent: props.currentAgent?.name,
          roundNum: props.currentRound,
          stepNum: props.currentCycleStep,
        });

        props.currentCycleStep++;

        // End cycle if all agents processed
        if (
          props.currentCycleStep >= currentAgents.length &&
          !autoChatInProgress
        ) {
          break;
        }
      }
      console.log("!!!_END OF CYCLE !!!", props.currentRound);
      //****END OF CYCLE */
      // Update context at end of round
      if (props.agentOrder !== "auto") {
        await updateContextFromConversation(
          currentConversation,
          contextSet.sets,
          teamName,
          set
        );
      }
    }

    // Store conversation in memory if worthy
    await storeConversationInMemory(currentConversation, [props.currentAgent], userId);

    // Reset state and finish orchestration
    finalizeOrchestration(
      set,
      order,
      numRounds,
      maxRounds,
      chatMode,
      customAgentSet
    );
  } catch (error) {
    console.error("Error in handleOrchestratedChatSubmit:", error);
    throw error; // Re-throw to preserve the original error
  }
}

//this agent will add nuance and subtlety to the conversations and will also be critical of whether or not the team is making progress with the task or discussion

//TODO: Lets brainstorm and create a verified list of common day use cases for AI automation that have not been overwhelmingly addressed by existing AI tools
//TODO: develop a system to help market an AI company
//TODO: clickbank
//TODO: pull random lyric, make description, test several models, see which writes similar to lyrics

//Provides radical new ideas and unique innovative solutions to an AI think tank
