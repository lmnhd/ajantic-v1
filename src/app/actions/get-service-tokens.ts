"use server";

import { auth } from "@/src/lib/auth";
import { DYNAMIC_NAMES } from "@/src/lib/dynamic-names";
import { SERVER_getGeneralPurposeDataSingle, SERVER_storeGeneralPurposeData } from "@/src/lib/server-actions";


async function refreshLinkedInToken(refresh_token: string): Promise<any> {
  const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refresh_token,
      client_id: process.env.LINKEDIN_ID!,
      client_secret: process.env.LINKEDIN_SECRET!,
    }),
  });
  return response.json();
}

async function refreshDropboxToken(refresh_token: string): Promise<any> {
  const response = await fetch('https://api.dropbox.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refresh_token,
      client_id: process.env.DROPBOX_ID!,
      client_secret: process.env.DROPBOX_SECRET!,
    }),
  });
  return response.json();
}

async function refreshTwitterToken(refresh_token: string): Promise<any> {
  const basic = Buffer.from(`${process.env.TWITTER_ID}:${process.env.TWITTER_SECRET}`).toString('base64');
  const response = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basic}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refresh_token,
    }),
  });
  return response.json();
}

export async function getServiceTokens(platform: string, userId: string) {
  console.log("GET_SERVICE_TOKENS running");
  platform = platform.toLowerCase();
  
  try {
    const fullNameSpace = await DYNAMIC_NAMES.service_tokens(userId, platform);
    const storedTokens = await SERVER_getGeneralPurposeDataSingle(fullNameSpace);
    console.log("GET_SERVICE_TOKENS_stored tokens: ", {fullNameSpace, storedTokens});

    if (!storedTokens) {
      console.error("No tokens found for platform:", platform);
      return null;
    }

    const tokens = JSON.parse(storedTokens.content);
    
    // Check if token is expired or about to expire (within 5 minutes)
    if (tokens.expiresAt && 
        Math.floor(Date.now() / 1000) >= (tokens.expiresAt - 300)) {
      console.log("Token expiration check:", {
        currentTime: Math.floor(Date.now() / 1000),
        expiresAt: tokens.expiresAt,
        timeRemaining: tokens.expiresAt - Math.floor(Date.now() / 1000)
      });
      console.log("Token expired or about to expire, attempting refresh...");
      try {
        // Get the current session
        // const session = await getServerSession(authConfig);
        // if (!session) {
        //   console.error("No session found");
        //   return null;
        // }

        // Different refresh logic for different providers
        let newTokens;
        let refreshResult;
        
        switch (platform) {
          case 'github':
            // GitHub tokens don't expire by default
            newTokens = tokens;
            break;

          case 'google':
            // For Google, we need to use the refresh token to get a new access token
            refreshResult = await fetch('https://oauth2.googleapis.com/token', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                client_id: process.env.GOOGLE_ID!,
                client_secret: process.env.GOOGLE_SECRET!,
                refresh_token: tokens.refresh_token,
                grant_type: 'refresh_token',
                scope: [
                  'https://www.googleapis.com/auth/userinfo.email',
                  'https://www.googleapis.com/auth/userinfo.profile',
                  'https://www.googleapis.com/auth/gmail.readonly',
                  'https://www.googleapis.com/auth/gmail.send',
                  'https://www.googleapis.com/auth/gmail.compose',
                  'https://www.googleapis.com/auth/gmail.modify',
                  'https://www.googleapis.com/auth/gmail.labels',
                  'https://www.googleapis.com/auth/gmail.metadata',
                  'https://www.googleapis.com/auth/gmail.settings.basic',
                  'https://www.googleapis.com/auth/gmail.settings.sharing',
                  'https://www.googleapis.com/auth/gmail.insert',
                  'https://mail.google.com/',
                  'https://www.googleapis.com/auth/calendar',
                  'https://www.googleapis.com/auth/drive',
                  'https://www.googleapis.com/auth/drive.file',
                  'https://www.googleapis.com/auth/drive.appdata',
                  'https://www.googleapis.com/auth/spreadsheets'
                ].join(' ')
              }),
            }).then(res => res.json());

            if (!refreshResult.access_token) {
              console.error("Failed to refresh Google token:", refreshResult);
              return null;
            }

            // Log the timestamps for debugging
            console.log("Token Timestamps:", {
              now: Math.floor(Date.now() / 1000),
              expires: Math.floor(Date.now() / 1000) + (24 * 60 * 60),
              refreshExpires: refreshResult.expires_in
            });

            newTokens = {
              client_id: process.env.GOOGLE_ID!,
              client_secret: process.env.GOOGLE_SECRET!,
              access_token: refreshResult.access_token,
              refresh_token: tokens.refresh_token,
              // Set expiration to 24 hours from now
              expiresAt: Math.floor(Date.now() / 1000) + (24 * 60 * 60)
            };

            break;

          case 'linkedin':
            refreshResult = await refreshLinkedInToken(tokens.refresh_token);
            if (!refreshResult.access_token) {
              console.error("Failed to refresh LinkedIn token:", refreshResult);
              return null;
            }
            newTokens = {
              client_id: process.env.LINKEDIN_ID!,
              client_secret: process.env.LINKEDIN_SECRET!,
              access_token: refreshResult.access_token,
              refresh_token: refreshResult.refresh_token || tokens.refresh_token,
              expiresAt: Math.floor(Date.now() / 1000) + (refreshResult.expires_in || 7200) // LinkedIn default is 2 hours
            };

            break;

          case 'twitter':
            refreshResult = await refreshTwitterToken(tokens.refresh_token);
            if (!refreshResult.access_token) {
              console.error("Failed to refresh Twitter token:", refreshResult);
              return null;
            }
            newTokens = {
              client_id: process.env.TWITTER_ID!,
              client_secret: process.env.TWITTER_SECRET!,
              access_token: refreshResult.access_token,
              refresh_token: refreshResult.refresh_token || tokens.refresh_token,
              expiresAt: Math.floor(Date.now() / 1000) + (refreshResult.expires_in || 7200)
            };

            break;

          case 'dropbox':
            refreshResult = await refreshDropboxToken(tokens.refresh_token);
            if (!refreshResult.access_token) {
              console.error("Failed to refresh Dropbox token:", refreshResult);
              return null;
            }
            newTokens = {
              client_id: process.env.DROPBOX_ID!,
              client_secret: process.env.DROPBOX_SECRET!,
              access_token: refreshResult.access_token,
              refresh_token: tokens.refresh_token, // Dropbox refresh tokens don't change
              expiresAt: Math.floor(Date.now() / 1000) + (refreshResult.expires_in || 14400) // Dropbox default is 4 hours
            };

            break;

          default:
            console.warn(`No refresh logic implemented for provider: ${platform}`);
            newTokens = tokens;
        }

        if (newTokens) {
          // Store the updated tokens
          console.log("Storing fresh tokens for platform:", platform);
          await SERVER_storeGeneralPurposeData(
            JSON.stringify(newTokens),
            platform,
            userId,
            `oauth::${platform}::${userId}`,
            fullNameSpace,
            false
          );
          
          return newTokens;
        }
      } catch (refreshError) {
        console.error(`Failed to refresh ${platform} token:`, refreshError);
        return null;
      }
    }

    return tokens;
  } catch (error) {
    console.error("Failed to get service tokens:", error);
    return null;
  }
} 