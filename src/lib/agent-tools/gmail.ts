// This is a barrel file that only exports safe types and the client interface
import type { TextChatLogProps } from "../text-chat-log";

// Export only the types needed by message handlers
export interface GmailAuth {
  clientId: string;
  clientSecret: string;
  refreshToken?: string;
  accessToken?: string;
}

// Re-export the client-side auth popup
export { createAuthPopup } from './gmail-client';

// Export the type for the agent tools
export type GmailAgentTools = {
  initiateAuth: any;
  handleAuthCallback: any;
  listEmails: any;
  getEmail: any;
  sendEmail: any;
  createDraft: any;
  listLabels: any;
};

// Export the function type
export type GmailToolsFunction = (textChatLogs: TextChatLogProps[], userId:string) => GmailAgentTools;

// Re-export the agent tools function from the implementation file
export { AGENT_TOOLS_gmail } from './gmail/gmail';

export const AGENT_TOOLS_DIRECTIVE_GMAIL = () => `
<process-steps>
  <start-oauth-flow>
    <step>
      Check for existing Gmail authentication for the user using your getExistingAuth tool.
    </step>
    <step>
      If no existing authentication is found, begin the Gmail authentication process using your initiateAuth tool. You will receive the auth URL in the format 'AUTH_URL: <url>'.
    </step>
    <step>
      <IMPORTANT>
      Return the auth URL back to the user in the format you received it... 'AUTH_URL: <url>'.
      </IMPORTANT>
    </step>
    <step>
      In another call, you will receive the auth code. Use the auth code to authenticate the user's Gmail account using your handleAuthCallback tool.
    </step>
  </start-oauth-flow>
  <use-gmail-tools>
    <step>
     Using your Gmail API tools and the auth credentials, you can perform multiple operations on the user's Gmail account at their request.
    </step>
  </use-gmail-tools>
</process-steps>`

