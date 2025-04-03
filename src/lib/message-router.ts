"use server";

import { langChainBasicAgent } from "@/src/app/api/basic-agent-lc";
import { AgentUserResponse, ContextContainerProps, ServerMessage } from "@/src/lib/types";
import {
  AgentComponentProps,
  AgentFoundationalPromptProps,
  AgentTypeEnum,
  
  ModelArgs,
  Team,
} from "@/src/lib/types";
import {
  UTILS_convertLineSetsToContext,
  UTILS_convertServerMessagesToBaseMessages,
} from "@/src/lib/utils";
import { openai } from "@ai-sdk/openai";
import { ChainValues } from "@langchain/core/utils/types";
import { convertToCoreMessages, generateObject } from "ai";
import { z } from "zod";
import { PostMessageAnalysisProps } from "./analysis_server";
import { TextChatLogProps } from "./text-chat-log";

export const messageRouter = async (
  message: string,
  messageHistory: ServerMessage[],
  agentsByName: Team,
  contextSets: ContextContainerProps[],
  modelNames: ModelArgs[],
  streaming: boolean,
  userId: string,
  agentFoundationalPromptProps: AgentFoundationalPromptProps,
  isAgentMessage: boolean,
  testing?: boolean
): Promise<AgentUserResponse | null> => {
  // if message contains a name followed by a triple-colon, then initiate a conversation with that agent
  // otherwise, pass the message round robin to each agent in chain
  let response: ChainValues | string | null = null;

  //return null;
  try {
    if (message.includes(":::")) {
      const [name, thisMessage] = message.split(":::");
      if (testing) {
        return {
          response: {},
          history: messageHistory,
          context: contextSets,
          agentProps: agentFoundationalPromptProps,
        };
      }

      if (isAgentMessage) {
        console.log("AGENT TO AGENT:", name);
        // Get the props for the agent we are talking to
        const toAgentProps = getAgentProps(
          name,
          agentsByName,
          contextSets,
          userId
        );
        response = initiateConversation(
          thisMessage,
          toAgentProps,
          messageHistory,
          contextSets,
          modelNames,
          streaming,
          agentFoundationalPromptProps.thisAgentName
        );

        while ((response as ChainValues).output.trim().includes(":::")) {
          response = await messageRouter(
            (response as ChainValues).output,
            messageHistory,
            agentsByName,
            contextSets,
            modelNames,
            streaming,
            userId,
            toAgentProps,
            true
          );
        }
        messageHistory = await updateAssistantMessages(
          messageHistory,
          response as ChainValues,
          toAgentProps.thisAgentName
        );
      }

      if (isAgentMessage) {
        console.log("POST-AGENT-TO-AGENT-isAgentMessage", response);
        return {
          response: response as ChainValues,
          history: messageHistory,
          context: contextSets,
          agentProps: agentFoundationalPromptProps,
        };
      }

      for (const agent of agentsByName.agents) {
        console.log("agent pre initiateConversation", agent);
        const _name = agent.name?.toLowerCase().trim() || "";
        if (_name === name.toLowerCase().trim()) {
          console.log(
            `FOUND AGENT ${_name} MATCHING ${name}`
            // , agentFoundationalPromptProps
          );
          response = (await initiateConversation(
            thisMessage,
            agentFoundationalPromptProps,
            messageHistory,
            contextSets,
            modelNames,
            streaming
          )) as ChainValues;
          console.log("initiateConversation -> response", response);
          messageHistory = await updateUserMessages(
            messageHistory,
            thisMessage,
            agentFoundationalPromptProps.thisAgentName
          );
          //return response;
          // update messageHistory with the response
          messageHistory = await updateAssistantMessages(
            messageHistory,
            response as ChainValues,
            _name
          );
          //if the response is a message to another agent, recurse
          while ((response as ChainValues)?.output.trim().includes(":::")) {
            response = (await messageRouter(
              (response as ChainValues).output,
              messageHistory,
              agentsByName,
              contextSets,
              modelNames,
              streaming,
              userId,
              agentFoundationalPromptProps,
              true
            )) as ChainValues | string | null;
            // update messageHistory with the response
            console.log(
              "NOW UPDATING AGENT TO AGENT",
              (response as ChainValues).output
            );
            messageHistory = await updateAssistantMessages(
              messageHistory,
              response as ChainValues,
              _name
            );
          }
          if (response) {
            const _response = reDirectResponse({
              response: response as ChainValues,
              history: messageHistory,
              context: contextSets,
              agentProps: agentFoundationalPromptProps,
            });
            return _response;
          }
        }
      }
      //if we get here, we didn't find the agent
      return null;
    } else {
      // const _response = await messageGoRound(
      //   message,
      //   agentsByName,
      //   contextSets,
      //   modelNames,
      //   userId,
      //   streaming,
      //   agentFoundationalPromptProps,
      //   messageHistory
      // );
      // console.log("_response", _response);
      // if (_response?.output) {
      //   messageHistory = updateUserMessages(
      //     messageHistory,
      //     message,
      //     agentFoundationalPromptProps.thisAgentName
      //   );
      //   messageHistory = updateAssistantMessages(
      //     messageHistory,
      //     _response as ChainValues,
      //     agentFoundationalPromptProps.thisAgentName
      //   );
      //   const completedResponse = reDirectResponse(
      //     _response as AgentUserResponse
      //   );
      //   return completedResponse;
      // }
    }
  } catch (error) {
    console.error("Error in messageRouter:", error);
    return null;
  }
  return null;
};

const messageGoRound = async (
  message: string,
  agentsByName: Team,
  contextSets: ContextContainerProps[],
  modelNames: ModelArgs[],
  userId: string,
  streaming: boolean,
  agentFoundationalPromptProps: AgentFoundationalPromptProps,
  messageHistory: ServerMessage[]
): Promise<ChainValues | null> => {
  let iterator = 0;
  while (iterator < agentsByName.agents.length) {
    if (message) {
      const result = await initiateConversation(
        message,
        agentFoundationalPromptProps,
        messageHistory,
        contextSets,
        modelNames,
        streaming
      );
      console.log("result", result);
      if (result === null) {
        console.log("initiateConversation() result is null, continuing");
        continue;
      }
      if (result?.output.trim().includes("PASS")) {
        continue;
      }
      return result;
    }
    iterator++;
  }
  return null;
};

const getAgentProps = (
  toAgentName: string,
  agentsByName: Team,
  contextSets: ContextContainerProps[],
  userId: string
): AgentFoundationalPromptProps => {
  const toAgent = agentsByName.agents.find(
    (agent) =>
      agent.name?.toLowerCase().trim() === toAgentName.toLowerCase().trim()
  ) as AgentComponentProps;

  const toAgentProps: AgentFoundationalPromptProps = {
    thisAgentName: toAgentName,
    userName: toAgent.name ?? "",
    agentType: toAgent.type as AgentTypeEnum,
    userId: userId,
    teamName: agentsByName.name ?? "",
    skillSet: toAgent.systemPrompt ?? "",
    tools: [],
    directives: toAgent.promptDirectives ?? [],
    peerAgents: agentsByName.agents,
    role: toAgent.roleDescription ?? "",
    mission: agentsByName.objectives ?? "",
    context: UTILS_convertLineSetsToContext(contextSets, toAgentName),
    trainingMode: false,
  };
  return toAgentProps;
};

const initiateConversation = async (
  message: string,
  toAgentProps: AgentFoundationalPromptProps,
  messageHistory: ServerMessage[],
  contextSets: ContextContainerProps[],
  modelNames: ModelArgs[],
  streaming: boolean,
  senderName?: string
): Promise<ChainValues | null> => {
  console.log(
    `INITIATE CONVERSATION WITH ${toAgentProps.thisAgentName}: ${message}`
  );

  const msgs = await UTILS_convertServerMessagesToBaseMessages(messageHistory);

  console.log("msgs", msgs);
  // return null;
  const agent = await langChainBasicAgent(
    contextSets,
    modelNames,
    streaming,
    toAgentProps
  );
  console.log("agent", agent);
  //return null;
  if (agent) {
    const result = await agent.invoke({
      input:  message,
      chat_history: msgs,
    });
    return result;
  }
  return null;
};

let prompt: string;



const reDirectResponse = ({
  response,
  history,
  context,
  nextAction,
  prompt,
  _data,
}: AgentUserResponse): AgentUserResponse => {
  return {
    response: response,
    history: history,
    context: context,
    nextAction: nextAction,
    prompt: prompt,
    _data: _data,
  } as AgentUserResponse;
  console.log("reDirectMessage", response);
  //     if (response?.output.includes("PASS")) {
  //       console.log("response-PASS", response);
  //       // Reevaluate whether to try different agent or request new agents from the user
  //       const _nextAction = await nextAction(response, history, 'Agent pass reevaluate prompt');
  //       return Pass(response, history, contextSets);
  //     } else if (response?.output.includes("FAIL")) {
  //       console.log("response-FAIL", response);
  //       // Analyze the failure and report back to the user with possible solutions
  //       const _nextAction = await nextAction(response, history, 'Agent fail reevaluate prompt');
  //       return Fail(response, history, contextSets);
  //     } else if (response?.output.includes("COMPLETE")) {
  //       console.log("response-COMPLETE", response);
  //       // Continue to next step of task or report back to user that the task is complete
  //       const _nextAction = await nextAction(response, history, 'Agent complete reevaluate prompt');
  //       return Complete(response, history, contextSets);
  //     } else {
  //       console.log("response-DEFAULT", response);
  //     }
  // history
  //     return null;
};

// const nextAction = async ({response, history, context, agentProps, prompt}: AgentUserResponse): Promise<AgentUserResponse | null> => {
//   const { object: _nextAction } = await generateObject({
//     model: openai('gpt-4o'),
//     messages: [],
//     output: "enum",
//     enum: ["RETURN-TO-USER", "TRY-AGENT", "REPORT-FAILURE"],
//     prompt: prompt,
//   });

//   return {response: response, history: history, context: context, agentProps: agentProps, nextAction: _nextAction};
// };

export const updateAssistantMessages = async (
  messages: ServerMessage[],
  response: ChainValues | string,
  agentName: string,
  subMessages?: ServerMessage[]
): Promise<ServerMessage[]> => {
  console.log("updateAssistantMessages", messages);
  //return messages;
  if (typeof response === "string") {
    messages.push({
      role: "assistant",
      content: response,
      // .replaceAll("COMPLETE", "")
      // .replaceAll("FAIL", "")
      // .replaceAll("PASS", "")
      agentName: agentName,
      subMessages: subMessages,
    });
  } else {
    messages.push({
      role: "assistant",
      content: response.output
        ? response.output
            .replaceAll("COMPLETE", "")
            .replaceAll("FAIL", "")
            .replaceAll("PASS", "")
        : "",
      agentName: agentName,
      subMessages: subMessages,
    });
  }
  //messages.push({role: "assistant", content: "", agentName: agentName, subMessages: subMessages});
  return messages;
};

export const updateUserMessages = async (
  messages: ServerMessage[],
  response: string,
  toAgent: string
): Promise<ServerMessage[]> => {
  messages.push({ role: "user", content: response, agentName: toAgent });
  //console.log("UPDATE-USER-MESSAGES", messages);
  return messages;
};

//   export const updateAgentMessages = (messages: ServerMessage[], response: string, fromAgent: string, toAgent: string): ServerMessage[] => {
//     console.log("UPDATE-AGENT-MESSAGES", response, messages);

//     const _newMessage = messages.filter(m => m.role === "assistant").pop();
//     if (_newMessage && _newMessage.role === "assistant" ) {
//       if (_newMessage.subMessages) {
//         console.log("_NEW-MESSAGE-SUBMESSAGES", _newMessage.subMessages);
//         _newMessage.subMessages?.push({role: "agent", content: response ? "From " + fromAgent + ": " + response.replaceAll("COMPLETE", "").replaceAll("FAIL", "").replaceAll("PASS", "") : ""});
//       } else {
//         console.log("ADDING-SUBMESSAGES");
//         _newMessage.subMessages = [{role: "agent", content: response ? "From " + fromAgent + ": " + response.replaceAll("COMPLETE", "").replaceAll("FAIL", "").replaceAll("PASS", "") : "", agentName: fromAgent}];
//       }
//       // messages.push({role: "assistant", content: response ? "From " + fromAgent + ": " + response.replaceAll("COMPLETE", "").replaceAll("FAIL", "").replaceAll("PASS", "") : "", agentName: toAgent});
//       console.log("_NEW-MESSAGE", _newMessage);
//       messages[messages.length - 1] = _newMessage;
//      console.log("UPDATE-AGENT-MESSAGES-2", messages);
//     return messages;
//   }
//   return messages;
// }

// const Pass: AgentUserResponse = (
//   response: ChainValues,
//   messages: ServerMessage[],
//   context: ContextContainerProps[],
//   prompt: string
// ) => {
//   // Reevaluate whether to try different agent or request new agents from the user
//   prompt = prompt;
//   return 'PASS' as string;
// };

// const Fail: AgentUserResponse = (
//   response: ChainValues,
//   messages: ServerMessage[],
//   context: ContextContainerProps[],
//   prompt: string
// ) => {
//   prompt = prompt;
//   return 'FAIL' as string;
// };

// const Complete: AgentUserResponse = (
//   response: ChainValues,
//   messages: ServerMessage[],
//   context: ContextContainerProps[],
//   prompt: string
// ) => {
//   prompt = prompt;
//   return 'COMPLETE' as string;
// }
