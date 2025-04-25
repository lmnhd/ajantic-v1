"use server"
import { createInfoRequestForm } from "../actions/form-actions";

import { AgentComponentProps, ContextContainerProps, ServerMessage } from "../../types";

export async function ORCHESTRATION_infoRequestToContextFormSet(currentMessage: string, contextSets: ContextContainerProps[], currentAgent: AgentComponentProps, teamName: string) {
    // Use the server action instead of direct implementation
    return createInfoRequestForm(currentMessage, contextSets, [currentAgent], teamName);
}