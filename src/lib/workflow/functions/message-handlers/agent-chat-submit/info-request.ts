import { AgentTypeEnum } from "@/src/lib/types";
import { AgentComponentProps, AgentUserResponse, AISessionState, AppFrozenState } from "@/src/lib/types";
import { ValueType } from "@/src/lib/types";

import { UTILS_convertLineSetsToContext } from "@/src/lib/utils";
import { agentChannelMessageRouter } from "../../../../agent-channels";
export function handleInfoRequest(agentChat: AgentUserResponse, localState: AISessionState, get: Function, set: Function, currentAgent: AgentComponentProps): {
    infoRequestAgentChat: AgentUserResponse;
    infoRequestLocalState: AISessionState;
} | undefined {
    if (!agentChat.postMessageProps?.requestFormSchema) {
        return;
    }
  console.log(
      "REQUEST FORM SCHEMA:",
      agentChat.postMessageProps?.requestFormSchema
    );
    const updatedContext = agentChat.context;
    updatedContext.push({
      setName: agentChat.postMessageProps?.requestFormSchema?.formName ?? "",
      lines: [],
      text: agentChat.postMessageProps?.requestFormSchema?.requestMessage ?? "",
      isDisabled: false,
      formSchema: {
        schema: (agentChat.postMessageProps?.requestFormSchema?.schema ?? []).map((item: any) => {
          let mappedValueType: ValueType;
          switch (item.valueType?.toUpperCase()) {
            case 'STRING': mappedValueType = ValueType.STRING; break;
            case 'NUMBER': mappedValueType = ValueType.NUMBER; break;
            case 'BOOLEAN': mappedValueType = ValueType.BOOLEAN; break;
            case 'OBJECT': mappedValueType = ValueType.OBJECT; break;
            case 'ARRAY': mappedValueType = ValueType.ARRAY; break;
            case 'NULL': mappedValueType = ValueType.NULL; break;
            case 'UNDEFINED': mappedValueType = ValueType.UNDEFINED; break;
            case 'DATE': mappedValueType = ValueType.DATE; break;
            case 'ENUM': mappedValueType = ValueType.ENUM; break;
            case 'FILE': mappedValueType = ValueType.FILE; break;
            default: mappedValueType = ValueType.STRING;
          }
          return {
            ...item,
            valueType: mappedValueType,
          };
        }),
        formName: agentChat.postMessageProps?.requestFormSchema?.formName ?? "",
      },
      fullScreen: true,
      // Hidden from all agents
      hiddenFromAgents: localState.currentAgents?.agents.map(
        (a: AgentComponentProps) => a.name
      ),
      requestData: {
        agentName: currentAgent.name,
        message: agentChat.postMessageProps?.requestFormSchema?.requestMessage ?? "",
        history: agentChat.history,
      },
      async onFormSubmit(formData) {
        console.log("FORM DATA:", formData);
        // const agentResponse = await agentChannelMessageRouter(
        //   JSON.stringify(formData),
        //   agentChat.history,
        //   localState.currentAgents,
        //   localState.contextSet.sets,
        //   [currentAgent.modelArgs],
        //   true,
        //   {
        //     context: UTILS_convertLineSetsToContext(
        //       localState.contextSet.sets,
        //       currentAgent.name
        //     ),
        //     directives: currentAgent.promptDirectives ?? [],
        //     mission: localState.currentAgents.objectives ?? "",
        //     peerAgents: localState.currentAgents.agents
        //       .filter((a: AgentComponentProps) => a.name !== currentAgent.name)
        //       .filter((a: AgentComponentProps) => !a.disabled),
        //     skillSet:
        //       currentAgent.systemPrompt ?? "You are a helpful AI assistant.",
        //     tools: currentAgent.tools ?? [],
        //     userName: localState.genericData?.userName ?? "",
        //     trainingMode: currentAgent.training || false,
        //     role: currentAgent.roleDescription ?? "",
        //     thisAgentName: currentAgent.name,
        //     agentType: currentAgent.type as AgentTypeEnum,
        //     userId: localState.userId,
        //     teamName: localState.currentAgents.name,
        //   },
        //   localState,
        //   localState.userId,
        //   localState.currentAgents.name,
        //   false
        // );
        // handleAgentChatSubmit(formData, get, set);
      },
    });
    console.log(
      "MESSAGE_HANDLER UPDATED_CONTEXT WITH FULLSCREEN FORM...",
      updatedContext
    );
    agentChat.context = updatedContext;
    localState.contextSet.sets = updatedContext;

    return {
        infoRequestAgentChat: agentChat,
        infoRequestLocalState: localState
    }
}
