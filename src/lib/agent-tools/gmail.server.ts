import { generateText, tool } from "ai";
import { z } from "zod";
import { TextChatLogProps } from "../text-chat-log";
import { logger } from "@/src/lib/logger";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import type { GmailToolsFunction } from "./gmail";
import { DYNAMIC_NAMES } from "../dynamic-names";
import { INDEXEDDB_retrieveGenericData } from "@/src/lib/indexDB";
import { SERVER_getGeneralPurposeDataMany, SERVER_getGeneralPurposeDataSingle, SERVER_storeGeneralPurposeData } from "@/src/lib/server-actions";
import { GeneralPurpose } from "@prisma/client";

// TODO: Auto Form feature for agents requiring information from the user. Will create the form and add to the context.

interface GmailAuth {
  clientId: string;
  clientSecret: string;
  refresh_token?: string;
  access_token?: string;
}

interface GmailConfig {
  auth: GmailAuth;
  userId?: string;
}

// Add new interface for OAuth2 flow
interface OAuth2Flow {
  getAuthUrl: () => string;
  handleCallback: (code: string) => Promise<any>;
}

export class GmailService {
  private auth: GmailAuth;
  private userId: string;
  private oauth2Client: OAuth2Client;
  private gmail: any;

  constructor(config: GmailConfig) {
    this.auth = config.auth;
    this.userId = config.userId || "me";

    this.oauth2Client = new OAuth2Client(
      this.auth.clientId,
      process.env.GOOGLE_AJANTIC_CLIENT_SECRET,
      "" // redirectUri can be empty for token refresh
    );

    // Set credentials after creation
    this.oauth2Client.setCredentials({
      refresh_token: this.auth.refresh_token
    });

    this.gmail = google.gmail({ version: "v1", auth: this.oauth2Client });
  }

  private async refreshAccessToken(): Promise<string> {
    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      const newAccessToken = credentials.access_token;

      if (!newAccessToken) {
        throw new Error("No access token received during refresh");
      }

      this.auth.access_token = newAccessToken;
      return newAccessToken;
    } catch (error) {
      logger.tool("Failed to refresh token", { error });
      throw error;
    }
  }

  // Add static method for OAuth2 flow
  static createOAuth2Flow(redirectUri: string): OAuth2Flow {
    const oauth2Client = new OAuth2Client({
      clientId: process.env.GOOGLE_AJANTIC_CLIENT_ID,
      clientSecret: process.env.GOOGLE_AJANTIC_CLIENT_SECRET,
      redirectUri: redirectUri,
    });

    return {
      getAuthUrl: () => {
        return oauth2Client.generateAuthUrl({
          access_type: "offline",
          scope: [
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/gmail.modify"
          ].join(' '),
          prompt: "consent"
        });
      },
      handleCallback: async (code: string) => {
        const { tokens } = await oauth2Client.getToken(code);
        console.log('Raw tokens from Google:', tokens);
        
        // Return tokens exactly as received from Google
        return tokens;
      },
    };
  }

  
// access_token =
// 'ya29.a0AXeO80QmW_DHJA5KoHw5UaHgLHuxuDk69AQDGBhziMoIeWknmGsiloHArJKnFjWczWDllqagJghtHwC73aANse6DRCXEzZXOJuI5JIuvvjc0C5zQrsAk9o32caJhlIpjCG-8BfC2DCtIOUrMYmQjkEVXwe-RVKmuNz8J1l7aaCgYKAf0SARISFQHGX2MiASdCbXsalm-hh8OVOp8Gzw0175'
// expiry_date =
// 1738183695317
// refresh_token =
// '1//05Qo3iXDNKZ5ECgYIARAAGAUSNwF-L9IrSiyG9tJ8HPfCCGhlZH9xxSXpVuGerD6kRsY1n8pcJnH1e48OFGtsShZsfcS-mty4qhc'
// scope =
// 'https://www.googleapis.com/auth/gmail.insert https://www.googleapis.com/auth/gmail.labels https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.settings.basic https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/gmail.metadata https://www.googleapis.com/auth/gmail.settings.sharing https://www.googleapis.com/auth/gmail.modify'
// token_type =
// 'Bearer'
// [[Prototype]] =
// Object

  async listMessages(query: string = "") {
    try {
      const response = await this.gmail.users.messages.list({
        userId: this.userId,
        q: query,
        maxResults: 10,
      });
      return response.data.messages || [];
    } catch (error: any) {
      if (error?.response?.status === 401 && this.auth.refresh_token) {
        await this.refreshAccessToken();
        // Retry with new token
        const response = await this.gmail.users.messages.list({
          userId: this.userId,
          q: query,
          maxResults: 10,
        });
        return response.data.messages || [];
      }
      logger.tool("Failed to list messages", { error });
      throw error;
    }
  }

  async getMessage(messageId: string) {
    try {
      const response = await this.gmail.users.messages.get({
        userId: this.userId,
        id: messageId,
        format: "full",
      });
      return response.data;
    } catch (error: any) {
      if (error?.response?.status === 401 && this.auth.refresh_token) {
        await this.refreshAccessToken();
        const response = await this.gmail.users.messages.get({
          userId: this.userId,
          id: messageId,
          format: "full",
        });
        return response.data;
      }
      logger.tool("Failed to get message", { error, messageId });
      throw error;
    }
  }

  async sendMessage(to: string, subject: string, body: string) {
    const email = [
      'Content-Type: text/plain; charset="UTF-8"\r\n',
      'MIME-Version: 1.0\r\n',
      `To: ${to}\r\n`,
      `Subject: ${subject}\r\n\r\n`,
      body
    ].join('');

    const encodedEmail = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');

    try {
      const response = await this.gmail.users.messages.send({
        userId: this.userId,
        requestBody: {
          raw: encodedEmail
        }
      });
      return response.data;
    } catch (error: any) {
      if (error?.response?.status === 401 && this.auth.refresh_token) {
        await this.refreshAccessToken();
        const response = await this.gmail.users.messages.send({
          userId: this.userId,
          requestBody: {
            raw: encodedEmail
          }
        });
        return response.data;
      }
      logger.tool("Failed to send message", { error });
      throw error;
    }
  }

  async listLabels() {
    try {
      const response = await this.gmail.users.labels.list({
        userId: this.userId,
      });
      return response.data.labels || [];
    } catch (error: any) {
      if (error?.response?.status === 401 && this.auth.refresh_token) {
        await this.refreshAccessToken();
        const response = await this.gmail.users.labels.list({
          userId: this.userId,
        });
        return response.data.labels || [];
      }
      logger.tool("Failed to list labels", { error });
      throw error;
    }
  }

  async createDraft(to: string, subject: string, body: string) {
    const email = [
      'Content-Type: text/plain; charset="UTF-8"\r\n',
      "MIME-Version: 1.0\r\n",
      `To: ${to}\r\n`,
      `Subject: ${subject}\r\n\r\n`,
      body,
    ].join("");

    const encodedEmail = Buffer.from(email)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    try {
      const response = await this.gmail.users.drafts.create({
        userId: this.userId,
        requestBody: {
          message: {
            raw: encodedEmail,
          },
        },
      });
      return response.data;
    } catch (error: any) {
      if (error?.response?.status === 401 && this.auth.refresh_token) {
        await this.refreshAccessToken();
        const response = await this.gmail.users.drafts.create({
          userId: this.userId,
          requestBody: {
            message: {
              raw: encodedEmail,
            },
          },
        });
        return response.data;
      }
      logger.tool("Failed to create draft", { error });
      throw error;
    }
  }

  public getGmail() {
    return this.gmail;
  }
}

// Default Gmail service instance using environment variables
const defaultGmailService = new GmailService({
  auth: {
    clientId: process.env.GOOGLE_AJANTIC_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_AJANTIC_CLIENT_SECRET || "",
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    access_token: process.env.GOOGLE_ACCESS_TOKEN,
  },
});

export const TOOLFUNCTION_sendEmail = async (
  to: string,
  subject: string,
  body: string,
  customAuth?: GmailAuth
) => {
  const service = customAuth
    ? new GmailService({ auth: customAuth })
    : defaultGmailService;
  return await service.sendMessage(to, subject, body);
};

export const TOOLFUNCTION_listEmails = async (
  query: string = "",
  customAuth?: GmailAuth
) => {
  const service = customAuth
    ? new GmailService({ auth: customAuth })
    : defaultGmailService;
  return await service.listMessages(query);
};

export const TOOLFUNCTION_getEmail = async (
  messageId: string,
  customAuth?: GmailAuth
) => {
  const service = customAuth
    ? new GmailService({ auth: customAuth })
    : defaultGmailService;
  return await service.getMessage(messageId);
};

export const TOOLFUNCTION_createDraft = async (
  to: string,
  subject: string,
  body: string,
  customAuth?: GmailAuth
) => {
  const service = customAuth
    ? new GmailService({ auth: customAuth })
    : defaultGmailService;
  return await service.createDraft(to, subject, body);
};

export const TOOLFUNCTION_listLabels = async (customAuth?: GmailAuth) => {
  const service = customAuth
    ? new GmailService({ auth: customAuth })
    : defaultGmailService;
  return await service.listLabels();
};

export const TOOLFUNCTION_getExistingAuth = async (userId: string, email?: string): Promise<GmailAuth | null> => {
  try {
    const fullNameSpace = await DYNAMIC_NAMES.namespace_generic(userId, 'gmailAuth');
    const storedAuth = await SERVER_getGeneralPurposeDataSingle(fullNameSpace);

    if (!storedAuth?.content) return null;
    
    const auth: GmailAuth = JSON.parse(storedAuth.content);
    auth.clientId = process.env.GOOGLE_AJANTIC_CLIENT_ID || "";
    auth.clientSecret = process.env.GOOGLE_AJANTIC_CLIENT_SECRET || "";
    
    // Verify token and refresh if needed
    try {
      const oauth2Client = new OAuth2Client(
        process.env.GOOGLE_AJANTIC_CLIENT_ID,
        process.env.GOOGLE_AJANTIC_CLIENT_SECRET,
        "" // redirectUri can be empty for token refresh
      );
      
      // Set credentials after creation
      oauth2Client.setCredentials({
        refresh_token: auth.refresh_token
      });
      
      const { credentials } = await oauth2Client.refreshAccessToken();
      auth.access_token = credentials.access_token || undefined;
      
      // Update stored auth if token was refreshed
      await SERVER_storeGeneralPurposeData(
        JSON.stringify(auth),
        'gmailAuth',
        userId,
        storedAuth.meta3,
        fullNameSpace,
        false
      );
      
      return auth;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return null;
    }
  } catch (error) {
    console.error('Failed to get stored auth:', error);
    return null;
  }
};

// Add this helper function to handle popup window
export const createAuthPopup = (authUrl: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Popup window dimensions
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    // Open popup
    const popup = window.open(
      authUrl,
      "Gmail Auth",
      `width=${width},height=${height},left=${left},top=${top}`
    );

    // Handle popup closure and message events
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "GMAIL_AUTH_CODE") {
        cleanup();
        resolve(event.data.code);
      }
    };

    const handleClose = () => {
      cleanup();
      reject(new Error("Auth popup was closed"));
    };

    const cleanup = () => {
      window.removeEventListener("message", handleMessage);
      clearInterval(popupChecker);
    };

    // Check if popup was closed
    const popupChecker = setInterval(() => {
      if (popup?.closed) {
        handleClose();
      }
    }, 1000);

    window.addEventListener("message", handleMessage);
  });
};

// Update the initiateAuth tool
export const AGENT_TOOLS_gmail: GmailToolsFunction = (
  textChatLogs: TextChatLogProps[],
  userId: string
) => {
  return {
    getExistingAuth: tool({
      description:
        "Check for and get (if exists) existing Gmail authentication for the user",
      parameters: z.object({
        email: z.string().optional().describe("Optional email to check for if provided"),
      }),
      execute: async ({ email }) => {
        const existingAuth: GmailAuth | null =
          await TOOLFUNCTION_getExistingAuth(userId, email);
        if (existingAuth) {
          return JSON.stringify(existingAuth);
        }
        return JSON.stringify({
          error: "No existing Gmail authentication found",
        });
      },
    }),
    initiateAuth: tool({
      description:
        "Start Gmail authentication process for the user. The tool returns the auth URL in the format 'AUTH_URL: <url>'. DO NOT tell the user to click a link or look for a URL - the system will automatically handle the popup. Simply return the tool's response directly.",
      parameters: z.object({}),
      execute: async () => {
        const oauth2Flow = GmailService.createOAuth2Flow(
          `${process.env.NEXT_PUBLIC_APP_URL}/api/gmail/auth`
        );
        return `AUTH_URL: ${oauth2Flow.getAuthUrl()}`;
      },
    }),

    // Add new tool for handling OAuth callback
    handleAuthCallback: tool({
      description: "Handle Gmail authentication callback",
      parameters: z.object({
        code: z.string().describe("Authorization code from OAuth callback"),
      }),
      execute: async ({ code }) => {
        try {
          logger.tool("Gmail Tool - Handle Auth Callback");
          const oauth2Flow = GmailService.createOAuth2Flow(""); // Redirect URI not needed for token exchange
          const auth = await oauth2Flow.handleCallback(code);
          return JSON.stringify(auth);
        } catch (error) {
          logger.tool("Gmail Tool - Handle Auth Callback Error", { error });
          return JSON.stringify({ error: "Failed to handle auth callback" });
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
        try {
          logger.tool("Gmail Tool - Send Email", { to, subject });
          const storedAuth = await TOOLFUNCTION_getExistingAuth(userId);
          if (!storedAuth) {
            return JSON.stringify({ error: "No Gmail authentication found" });
          }

          const result = await TOOLFUNCTION_sendEmail(
            to,
            subject,
            body,
            storedAuth
          );
          logger.tool("Gmail Tool - Send Email Complete", { result });
          return result;
        } catch (error) {
          logger.tool("Gmail Tool - Send Email Error", { error });
          return JSON.stringify({ error: "Failed to send email" });
        }
      },
    }),

    listEmails: tool({
      description: "List emails from Gmail inbox with optional search query",
      parameters: z.object({
        query: z.string().optional().describe("Optional search query")
      }),
      execute: async ({ query }) => {
        try {
          logger.tool("Gmail Tool - List Emails", { query });
          const storedAuth = await TOOLFUNCTION_getExistingAuth(userId);
          if (!storedAuth) {
            return JSON.stringify({ error: "No Gmail authentication found" });
          }

          const result = await TOOLFUNCTION_listEmails(query, storedAuth);
          logger.tool("Gmail Tool - List Emails Complete", { resultCount: result.length });
          return result;
        } catch (error) {
          logger.tool("Gmail Tool - List Emails Error", { error });
          return JSON.stringify({ error: "Failed to list emails" });
        }
      },
    }),

    testAPI: tool({
      description: "Test the Gmail API",
      parameters: z.object({}),
      execute: async () => {
        try {
          logger.tool("Gmail Tool - Test API");
          const result = await TEST_GMAIL_API();
          logger.tool("Gmail Tool - Test API Complete", { result });
          return result;
        } catch (error) {
          logger.tool("Gmail Tool - Test API Error", { error });
          return JSON.stringify({ error: "Failed to test Gmail API" });
        }
      },
    }),

    getEmail: tool({
      description: "Get a specific email by ID",
      parameters: z.object({
        messageId: z.string().describe("Gmail message ID"),
      }),
      execute: async ({ messageId }) => {
        try {
          logger.tool("Gmail Tool - Get Email", { messageId });
          const storedAuth = await TOOLFUNCTION_getExistingAuth(userId);
          if (!storedAuth) {
            return JSON.stringify({ error: "No Gmail authentication found" });
          }

          const result = await TOOLFUNCTION_getEmail(messageId, storedAuth);
          logger.tool("Gmail Tool - Get Email Complete", { messageId });
          return result;
        } catch (error) {
          logger.tool("Gmail Tool - Get Email Error", { error });
          return JSON.stringify({ error: "Failed to get email" });
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
        try {
          logger.tool("Gmail Tool - Create Draft", { to, subject });
          const storedAuth = await TOOLFUNCTION_getExistingAuth(userId);
          if (!storedAuth) {
            return JSON.stringify({ error: "No Gmail authentication found" });
          }

          const result = await TOOLFUNCTION_createDraft(to, subject, body, storedAuth);
          logger.tool("Gmail Tool - Create Draft Complete", { result });
          return result;
        } catch (error) {
          logger.tool("Gmail Tool - Create Draft Error", { error });
          return JSON.stringify({ error: "Failed to create draft" });
        }
      },
    }),

    listLabels: tool({
      description: "List all Gmail labels",
      parameters: z.object({}),
      execute: async () => {
        try {
          logger.tool("Gmail Tool - List Labels");
          const storedAuth = await TOOLFUNCTION_getExistingAuth(userId);
          if (!storedAuth) {
            return JSON.stringify({ error: "No Gmail authentication found" });
          }

          const result = await TOOLFUNCTION_listLabels(storedAuth);
          logger.tool("Gmail Tool - List Labels Complete", {
            labelCount: result.length,
          });
          return result;
        } catch (error) {
          logger.tool("Gmail Tool - List Labels Error", { error });
          return JSON.stringify({ error: "Failed to list labels" });
        }
      },
    }),

    executeCustomGmailCommand: tool({
      description:
        "Execute a custom Gmail API command. Use this when no specific tool exists for your needs. Refer to Gmail API documentation for available endpoints and parameters.",
      parameters: z.object({
        endpoint: z
          .string()
          .describe(
            "Gmail API endpoint (e.g., 'users.messages.modify', 'users.settings.filters.create')"
          ),
        method: z
          .string()
          .describe("API method (e.g., 'get', 'post', 'patch', 'delete')"),
        params: z
          .record(z.any())
          .describe("Request parameters specific to the endpoint"),
      }),
      execute: async ({ endpoint, method, params }) => {
        try {
          logger.tool("Gmail Tool - Custom Command", { endpoint, method });
          const service = defaultGmailService;

          // Parse endpoint path (e.g., 'users.messages.modify' -> ['users', 'messages', 'modify'])
          const path = endpoint.split(".");
          let apiMethod = service.getGmail();

          // Navigate to the correct API method
          path.forEach((p) => {
            apiMethod = apiMethod[p];
          });

          const result = await apiMethod({
            userId: "me",
            ...params,
          });

          logger.tool("Gmail Tool - Custom Command Complete", { endpoint });
          return result.data;
        } catch (error) {
          logger.tool("Gmail Tool - Custom Command Error", { error });
          return JSON.stringify({
            error: `Failed to execute custom command: ${
              error instanceof Error ? error.message : String(error)
            }`,
          });
        }
      },
    }),
  };
};

// Updated test function
export const TEST_GMAIL_API = async () => {
  try {
    const labels = await TOOLFUNCTION_listLabels();
    console.log("Gmail Labels:", labels);
    return "Gmail API test successful";
  } catch (error) {
    console.error("Gmail API test failed:", error);
    return `Gmail API test failed: ${error}`;
  }
};

interface GmailAuthBrowser {
  clientId: string;
  clientSecret: string;
  refreshToken?: string;
  accessToken?: string;
}

export const gmailApiFetch = {
  listMessages: async (auth: GmailAuthBrowser, query = "") => {
    const response = await fetch("/api/gmail", {
      method: "POST",
      body: JSON.stringify({ action: "listMessages", auth, query }),
    });
    return response.json();
  },

  getMessage: async (auth: GmailAuthBrowser, messageId: string) => {
    const response = await fetch("/api/gmail", {
      method: "POST",
      body: JSON.stringify({ action: "getMessage", auth, messageId }),
    });
    return response.json();
  },

  sendMessage: async (
    auth: GmailAuthBrowser,
    to: string,
    subject: string,
    body: string
  ) => {
    const response = await fetch("/api/gmail", {
      method: "POST",
      body: JSON.stringify({
        action: "sendEmail",
        auth,
        to,
        subject,
        body,
      }),
    });
    return response.json();
  },

  createDraft: async (
    auth: GmailAuthBrowser,
    to: string,
    subject: string,
    body: string
  ) => {
    const response = await fetch("/api/gmail", {
      method: "POST",
      body: JSON.stringify({
        action: "createDraft",
        auth,
        to,
        subject,
        body,
      }),
    });
    return response.json();
  },

  listLabels: async (auth: GmailAuthBrowser) => {
    const response = await fetch("/api/gmail", {
      method: "POST",
      body: JSON.stringify({
        action: "listLabels",
        auth,
      }),
    });
    return response.json();
  },
};
