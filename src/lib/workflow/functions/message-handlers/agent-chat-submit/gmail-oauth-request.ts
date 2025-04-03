import { AgentComponentProps, ServerMessage } from "@/src/lib/types";

import { AISessionState } from "@/src/lib/types";

import { AgentUserResponse, AppFrozenState } from "@/src/lib/types";
import { formatDayName, CONVERSATION_store } from "../../../../conversation";
import {
  createAuthPopup,
  GmailAuthBrowser,
} from "../../../../agent-tools/gmail-client";

import { agentChannelMessageRouter } from "../../../../agent-channels";
import { DYNAMIC_NAMES } from "../../../../dynamic-names";
import { SERVER_storeGeneralPurposeData } from "@/src/lib/server-actions";

export async function handleGmailOauthRequest(
  agentChat: AgentUserResponse,
  localState: AISessionState,
  currentAgent: AgentComponentProps,
  platform: string

) {
  if (!agentChat.postMessageProps?.metaData?.authUrl) return;
  if (!localState.userId) return;


  
  
  try {
    // Create a promise that will resolve when auth is complete
    const authCompletionPromise = new Promise((resolve, reject) => {
      const handleAuthMessage = (event: MessageEvent) => {
        console.log('OAUTH-REQUEST: handleAuthMessage:', event.data);
        if (event.data.type === 'GMAIL_AUTH_SUCCESS') {
          window.removeEventListener('message', handleAuthMessage);
          resolve(event.data);
        } else if (event.data.type === 'GMAIL_AUTH_ERROR') {
          console.log('OAUTH-REQUEST: handleAuthMessage:', event.data);
          window.removeEventListener('message', handleAuthMessage);
          reject(new Error(event.data.error));
        }
      };
      
      window.addEventListener('message', handleAuthMessage);
    });

    // Debug state parameter
    console.log('Local State userId:', localState.userId);
    const baseAuthUrl = agentChat.postMessageProps.metaData.authUrl;
    const hasState = baseAuthUrl.includes('state=');
    
    const stateParam = {
      agentName: agentChat.agentProps.thisAgentName,
      userId: localState.userId
    };
    
    const authUrl = hasState 
      ? baseAuthUrl.replace(/state=([^&]*)/, `state=${encodeURIComponent(JSON.stringify(stateParam))}`)
      : `${baseAuthUrl}&state=${encodeURIComponent(JSON.stringify(stateParam))}`;
    console.log('OAUTH-REQUEST: Final authUrl:', authUrl);
    
    // Capture both popup and message promises
    const popupPromise = createAuthPopup(authUrl);
    
    // Wait for auth completion or timeout
    const authResult = await Promise.race([
      Promise.all([popupPromise, authCompletionPromise]),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Auth timeout')), 60000)
      )
    ]);

    console.log('OAUTH-REQUEST: Auth result:', authResult);

    // Add auth success message to conversation
    const authSuccessMessage: ServerMessage = {
      role: "assistant",
      content: `Gmail authentication successful for ${(authResult as any).email}. You can now proceed with your previous task using the authenticated Gmail account.`,
      agentName: agentChat.agentProps.thisAgentName,
      currentState: JSON.stringify(localState)
    };

    // Update agent chat with success info and original context
    agentChat.history = [
      ...agentChat.history,
      {
        role: "user",
        content: "Gmail authentication completed",
        agentName: "user",
        currentState: ''
      },
      authSuccessMessage
    ];
    
    // Add original request context to help agent resume
    const originalRequest = agentChat.history.find(
      msg => msg.role === "user" && msg.content.includes("gmail")
    );
    if (originalRequest) {
      agentChat.response = `I'm now authorized to access Gmail for ${(authResult as any).email}. Let me proceed with your request: "${originalRequest.content}"`;
    } else {
      agentChat.response = `Gmail authentication successful. How can I help you with your email tasks?`;
    }

    agentChat.postMessageProps.nextFlag = "CONTINUE";
    delete agentChat.postMessageProps.metaData.authUrl; // Clear auth URL as it's no longer needed
    
    console.log('Auth object size:', new TextEncoder().encode(JSON.stringify(authResult)).length / 1024 / 1024, 'MB');
    
    interface AuthResult {
      clientId: string;
      access_token: string;
      refresh_token: string;
      expiry_date: number;
    }
    
    const minimalAuth = {
      clientId: (authResult as AuthResult).clientId,
      access_token: (authResult as AuthResult).access_token,
      refresh_token: (authResult as AuthResult).refresh_token,
      expiry_date: (authResult as AuthResult).expiry_date
    };

    // Store minimal auth data
    const fullNameSpace = await DYNAMIC_NAMES.namespace_generic(localState.userId, 'gmailAuth');
    console.log('OAUTH-REQUEST: Storing minimal auth data:', minimalAuth);
    await SERVER_storeGeneralPurposeData(
      JSON.stringify(minimalAuth),
      'gmailAuth',
      localState.userId,
      (authResult as any).email,
      fullNameSpace,
      false
    );
    
    console.log('OAUTH-REQUEST: Calling router with Auth success message:', authSuccessMessage);
    // Then call router with original args
    return agentChannelMessageRouter(
      authSuccessMessage.content,
      agentChat.history,
      localState.currentAgents,
      agentChat.context,
      [currentAgent.modelArgs],
      false,
      agentChat.agentProps,
      localState,
      localState.userId,
      localState.currentAgents.name,
      false,
    );

  } catch (error) {
    console.error("OAUTH-REQUEST: Auth error:", error);
    
    // Add auth failure message to conversation
    const authFailureMessage: ServerMessage = {
      role: "assistant",
      content: "Gmail authentication failed. Please try again.",
      agentName: agentChat.agentProps.thisAgentName,
      currentState: ''
    };

    agentChat.history = [
      ...agentChat.history,
      {
        role: "user",
        content: "Gmail authentication failed",
        agentName: "user",
        currentState: ''
      },
      authFailureMessage
    ];
    
    agentChat.response = "Authentication failed. Please try again.";
    agentChat.postMessageProps.nextFlag = "FAIL";
    
    console.log('OAUTH-REQUEST: Calling router with Auth failure message:', authFailureMessage);
    // Call handleAgentChatSubmit with error state
    return agentChannelMessageRouter(
      authFailureMessage.content, 
      agentChat.history,
      localState.currentAgents,
      agentChat.context,
      [currentAgent.modelArgs],
      false,
      agentChat.agentProps,
      localState,
      localState.userId,
      localState.currentAgents.name,
      false,
    );
  }
}

