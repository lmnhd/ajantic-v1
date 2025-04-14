'use server';

import { logger } from "@/src/lib/logger";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { DYNAMIC_NAMES } from "../../dynamic-names";
import { SERVER_getGeneralPurposeDataSingle, SERVER_storeGeneralPurposeData } from "@/src/lib/server-actions";

// --- Interfaces --- //

// These interfaces can be exported because they're just types
export interface GmailAuth {
  clientId: string;
  clientSecret: string;
  refresh_token?: string;
  access_token?: string;
}

interface GmailConfig {
  auth: GmailAuth;
  userId?: string;
}

// Interface for OAuth2 flow
export interface OAuth2Flow {
  getAuthUrl: () => string;
  handleCallback: (code: string) => Promise<any>;
}

// --- Gmail Service Class --- //
// Note: Class is no longer exported (per Next.js 'use server' rules)
class GmailService {
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
    } catch (error: any) {
      logger.tool("Failed to refresh token", { error });
      throw error;
    }
  }

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

    const encodedEmail = Buffer.from(email).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

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

  getGmail() {
    return this.gmail;
  }
}

// --- Static Methods for OAuth2 --- //
// Export an async function to create OAuth flows
export async function createOAuth2Flow(redirectUri: string): Promise<OAuth2Flow> {
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
      logger.tool('Raw tokens from Google:', tokens);
      
      // Return tokens exactly as received from Google
      return tokens;
    },
  };
}

// --- Default Service Instance --- //

// Default Gmail service instance using environment variables
const defaultGmailService = new GmailService({
  auth: {
    clientId: process.env.GOOGLE_AJANTIC_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_AJANTIC_CLIENT_SECRET || "",
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    access_token: process.env.GOOGLE_ACCESS_TOKEN,
  },
});

// --- Core Tool Functions --- //

export async function TOOLFUNCTION_sendEmail(
  to: string,
  subject: string,
  body: string,
  customAuth?: GmailAuth
): Promise<any> {
  const service = customAuth
    ? new GmailService({ auth: customAuth })
    : defaultGmailService;
  return await service.sendMessage(to, subject, body);
}

export async function TOOLFUNCTION_listEmails(
  query: string = "",
  customAuth?: GmailAuth
): Promise<any> {
  const service = customAuth
    ? new GmailService({ auth: customAuth })
    : defaultGmailService;
  return await service.listMessages(query);
}

export async function TOOLFUNCTION_getEmail(
  messageId: string,
  customAuth?: GmailAuth
): Promise<any> {
  const service = customAuth
    ? new GmailService({ auth: customAuth })
    : defaultGmailService;
  return await service.getMessage(messageId);
}

export async function TOOLFUNCTION_createDraft(
  to: string,
  subject: string,
  body: string,
  customAuth?: GmailAuth
): Promise<any> {
  const service = customAuth
    ? new GmailService({ auth: customAuth })
    : defaultGmailService;
  return await service.createDraft(to, subject, body);
}

export async function TOOLFUNCTION_listLabels(
  customAuth?: GmailAuth
): Promise<any> {
  const service = customAuth
    ? new GmailService({ auth: customAuth })
    : defaultGmailService;
  return await service.listLabels();
}

export async function TOOLFUNCTION_getExistingAuth(
  userId: string,
  email?: string
): Promise<GmailAuth | null> {
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
    } catch (error: any) {
      logger.tool('Token refresh failed:', error);
      return null;
    }
  } catch (error: any) {
    logger.tool('Failed to get stored auth:', error);
    return null;
  }
}

// Test function
export async function TOOLFUNCTION_testGmailAPI(): Promise<string> {
  try {
    const labels = await TOOLFUNCTION_listLabels();
    logger.tool("Gmail Labels:", labels);
    return "Gmail API test successful";
  } catch (error: any) {
    logger.tool("Gmail API test failed:", error);
    return `Gmail API test failed: ${error}`;
  }
} 