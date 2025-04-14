import { tool } from "ai";
import { z } from "zod";
import { TextChatLogProps } from "@/src/lib/text-chat-log";
import { logger } from '@/src/lib/logger';
import { 
  TOOLFUNCTION_sendEmail,
  TOOLFUNCTION_listEmails,
  TOOLFUNCTION_getEmail,
  TOOLFUNCTION_createDraft,
  TOOLFUNCTION_listLabels,
  TOOLFUNCTION_getExistingAuth,
  TOOLFUNCTION_testGmailAPI,
  createOAuth2Flow,
  OAuth2Flow
} from "./gmail_core";

// Export the Gmail tools function
export const AGENT_TOOLS_gmail = (textChatLogs: TextChatLogProps[], userId: string) => {
  return {
    getExistingAuth: tool({
      description: "Check for and get (if exists) existing Gmail authentication for the user",
      parameters: z.object({
        email: z.string().optional().describe("Optional email to check for if provided"),
      }),
      execute: async ({ email }) => {
        textChatLogs.push({
          role: "function",
          message: `Checking existing Gmail authentication`,
          agentName: "getExistingAuth",
          timestamp: new Date(),
        });

        try {
          const existingAuth = await TOOLFUNCTION_getExistingAuth(userId, email);
          
          if (existingAuth) {
            textChatLogs.push({
              role: "function",
              message: `Gmail authentication found for user`,
              agentName: "getExistingAuth",
              timestamp: new Date(),
            });
            return JSON.stringify(existingAuth);
          }
          
          textChatLogs.push({
            role: "function",
            message: `No Gmail authentication found for user`,
            agentName: "getExistingAuth",
            timestamp: new Date(),
          });
          return JSON.stringify({
            error: "No existing Gmail authentication found",
          });
        } catch (error: any) {
          const errorMessage = error.message || String(error);
          textChatLogs.push({
            role: "function",
            message: `Error checking Gmail authentication: ${errorMessage}`,
            agentName: "getExistingAuth",
            timestamp: new Date(),
          });
          return JSON.stringify({ error: errorMessage });
        }
      },
    }),

    initiateAuth: tool({
      description: "Start Gmail authentication process for the user. The tool returns the auth URL in the format 'AUTH_URL: <url>'. DO NOT tell the user to click a link or look for a URL - the system will automatically handle the popup. Simply return the tool's response directly.",
      parameters: z.object({}),
      execute: async () => {
        textChatLogs.push({
          role: "function",
          message: `Initiating Gmail authentication process`,
          agentName: "initiateAuth",
          timestamp: new Date(),
        });

        try {
          const oauth2Flow = await createOAuth2Flow(
            `${process.env.NEXT_PUBLIC_APP_URL}/api/gmail/auth`
          );

          const authUrl = oauth2Flow.getAuthUrl();
          textChatLogs.push({
            role: "function",
            message: `Generated Gmail auth URL successfully`,
            agentName: "initiateAuth",
            timestamp: new Date(),
          });
          
          return `AUTH_URL: ${authUrl}`;
        } catch (error: any) {
          const errorMessage = error.message || String(error);
          textChatLogs.push({
            role: "function",
            message: `Error initiating Gmail auth: ${errorMessage}`,
            agentName: "initiateAuth",
            timestamp: new Date(),
          });
          return JSON.stringify({ error: errorMessage });
        }
      },
    }),

    handleAuthCallback: tool({
      description: "Handle Gmail authentication callback",
      parameters: z.object({
        code: z.string().describe("Authorization code from OAuth callback"),
      }),
      execute: async ({ code }) => {
        textChatLogs.push({
          role: "function",
          message: `Handling Gmail auth callback with code`,
          agentName: "handleAuthCallback",
          timestamp: new Date(),
        });

        try {
          const oauth2Flow = await createOAuth2Flow("");
          const auth = await oauth2Flow.handleCallback(code);
          
          textChatLogs.push({
            role: "function",
            message: `Successfully authenticated with Gmail`,
            agentName: "handleAuthCallback",
            timestamp: new Date(),
          });
          
          return JSON.stringify(auth);
        } catch (error: any) {
          const errorMessage = error.message || String(error);
          textChatLogs.push({
            role: "function",
            message: `Error handling auth callback: ${errorMessage}`,
            agentName: "handleAuthCallback",
            timestamp: new Date(),
          });
          
          return JSON.stringify({ error: errorMessage });
        }
      },
    }),

    sendEmail: tool({
      description: "Send an email using Gmail",
      parameters: z.object({
        to: z.string().describe("Recipient email address"),
        subject: z.string().describe("Email subject"),
        body: z.string().describe("Email body content")
      }),
      execute: async ({ to, subject, body }) => {
        textChatLogs.push({
          role: "function",
          message: `Sending email to ${to} with subject: ${subject}`,
          agentName: "sendEmail",
          timestamp: new Date(),
        });

        try {
          const storedAuth = await TOOLFUNCTION_getExistingAuth(userId);
          if (!storedAuth) {
            textChatLogs.push({
              role: "function",
              message: `No Gmail authentication found`,
              agentName: "sendEmail",
              timestamp: new Date(),
            });
            return JSON.stringify({ error: "No Gmail authentication found" });
          }

          const result = await TOOLFUNCTION_sendEmail(to, subject, body, storedAuth);
          
          textChatLogs.push({
            role: "function",
            message: `Email sent successfully`,
            agentName: "sendEmail",
            timestamp: new Date(),
          });
          
          return JSON.stringify(result);
        } catch (error: any) {
          const errorMessage = error.message || String(error);
          textChatLogs.push({
            role: "function",
            message: `Error sending email: ${errorMessage}`,
            agentName: "sendEmail",
            timestamp: new Date(),
          });
          
          return JSON.stringify({ error: errorMessage });
        }
      },
    }),

    listEmails: tool({
      description: "List emails from Gmail inbox with optional search query",
      parameters: z.object({
        query: z.string().optional().describe("Optional search query")
      }),
      execute: async ({ query }) => {
        textChatLogs.push({
          role: "function",
          message: `Listing emails ${query ? `with query: ${query}` : ''}`,
          agentName: "listEmails",
          timestamp: new Date(),
        });

        try {
          const storedAuth = await TOOLFUNCTION_getExistingAuth(userId);
          if (!storedAuth) {
            textChatLogs.push({
              role: "function",
              message: `No Gmail authentication found`,
              agentName: "listEmails",
              timestamp: new Date(),
            });
            return JSON.stringify({ error: "No Gmail authentication found" });
          }

          const result = await TOOLFUNCTION_listEmails(query, storedAuth);
          
          textChatLogs.push({
            role: "function",
            message: `Retrieved ${result.length} emails`,
            agentName: "listEmails",
            timestamp: new Date(),
          });
          
          return JSON.stringify(result);
        } catch (error: any) {
          const errorMessage = error.message || String(error);
          textChatLogs.push({
            role: "function",
            message: `Error listing emails: ${errorMessage}`,
            agentName: "listEmails",
            timestamp: new Date(),
          });
          
          return JSON.stringify({ error: errorMessage });
        }
      },
    }),

    getEmail: tool({
      description: "Get a specific email by ID",
      parameters: z.object({
        messageId: z.string().describe("Gmail message ID"),
      }),
      execute: async ({ messageId }) => {
        textChatLogs.push({
          role: "function",
          message: `Retrieving email with ID: ${messageId}`,
          agentName: "getEmail",
          timestamp: new Date(),
        });

        try {
          const storedAuth = await TOOLFUNCTION_getExistingAuth(userId);
          if (!storedAuth) {
            textChatLogs.push({
              role: "function",
              message: `No Gmail authentication found`,
              agentName: "getEmail",
              timestamp: new Date(),
            });
            return JSON.stringify({ error: "No Gmail authentication found" });
          }

          const result = await TOOLFUNCTION_getEmail(messageId, storedAuth);
          
          textChatLogs.push({
            role: "function",
            message: `Email retrieved successfully`,
            agentName: "getEmail",
            timestamp: new Date(),
          });
          
          return JSON.stringify(result);
        } catch (error: any) {
          const errorMessage = error.message || String(error);
          textChatLogs.push({
            role: "function",
            message: `Error retrieving email: ${errorMessage}`,
            agentName: "getEmail",
            timestamp: new Date(),
          });
          
          return JSON.stringify({ error: errorMessage });
        }
      },
    }),

    createDraft: tool({
      description: "Create an email draft",
      parameters: z.object({
        to: z.string().describe("Recipient email address"),
        subject: z.string().describe("Email subject"),
        body: z.string().describe("Email body content"),
      }),
      execute: async ({ to, subject, body }) => {
        textChatLogs.push({
          role: "function",
          message: `Creating email draft to ${to} with subject: ${subject}`,
          agentName: "createDraft",
          timestamp: new Date(),
        });

        try {
          const storedAuth = await TOOLFUNCTION_getExistingAuth(userId);
          if (!storedAuth) {
            textChatLogs.push({
              role: "function",
              message: `No Gmail authentication found`,
              agentName: "createDraft",
              timestamp: new Date(),
            });
            return JSON.stringify({ error: "No Gmail authentication found" });
          }

          const result = await TOOLFUNCTION_createDraft(to, subject, body, storedAuth);
          
          textChatLogs.push({
            role: "function",
            message: `Draft created successfully`,
            agentName: "createDraft",
            timestamp: new Date(),
          });
          
          return JSON.stringify(result);
        } catch (error: any) {
          const errorMessage = error.message || String(error);
          textChatLogs.push({
            role: "function",
            message: `Error creating draft: ${errorMessage}`,
            agentName: "createDraft",
            timestamp: new Date(),
          });
          
          return JSON.stringify({ error: errorMessage });
        }
      },
    }),

    listLabels: tool({
      description: "List all Gmail labels",
      parameters: z.object({}),
      execute: async () => {
        textChatLogs.push({
          role: "function",
          message: `Listing Gmail labels`,
          agentName: "listLabels",
          timestamp: new Date(),
        });

        try {
          const storedAuth = await TOOLFUNCTION_getExistingAuth(userId);
          if (!storedAuth) {
            textChatLogs.push({
              role: "function",
              message: `No Gmail authentication found`,
              agentName: "listLabels",
              timestamp: new Date(),
            });
            return JSON.stringify({ error: "No Gmail authentication found" });
          }

          const result = await TOOLFUNCTION_listLabels(storedAuth);
          
          textChatLogs.push({
            role: "function",
            message: `Retrieved ${result.length} labels`,
            agentName: "listLabels",
            timestamp: new Date(),
          });
          
          return JSON.stringify(result);
        } catch (error: any) {
          const errorMessage = error.message || String(error);
          textChatLogs.push({
            role: "function",
            message: `Error listing labels: ${errorMessage}`,
            agentName: "listLabels",
            timestamp: new Date(),
          });
          
          return JSON.stringify({ error: errorMessage });
        }
      },
    }),

    testAPI: tool({
      description: "Test the Gmail API",
      parameters: z.object({}),
      execute: async () => {
        textChatLogs.push({
          role: "function",
          message: `Testing Gmail API`,
          agentName: "testAPI",
          timestamp: new Date(),
        });

        try {
          const result = await TOOLFUNCTION_testGmailAPI();
          
          textChatLogs.push({
            role: "function",
            message: `Gmail API test completed: ${result}`,
            agentName: "testAPI",
            timestamp: new Date(),
          });
          
          return result;
        } catch (error: any) {
          const errorMessage = error.message || String(error);
          textChatLogs.push({
            role: "function",
            message: `Error testing Gmail API: ${errorMessage}`,
            agentName: "testAPI",
            timestamp: new Date(),
          });
          
          return JSON.stringify({ error: errorMessage });
        }
      },
    }),
  };
}; 