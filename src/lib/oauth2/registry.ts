import { PlatformRegistry } from "./core-service";

export const oauth2Platforms: PlatformRegistry = {
    gmail: {
      clientId: process.env.GOOGLE_AJANTIC_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_AJANTIC_CLIENT_SECRET || "",
      scopes: ["https://www.googleapis.com/auth/gmail.readonly",

            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/gmail.modify"],
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',

      redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth/callback`,
      storageNamespace: 'gmailAuth'
    },
    slack: {
        clientId: process.env.SLACK_CLIENT_ID || "",
        clientSecret: process.env.SLACK_CLIENT_SECRET || "",
        scopes: ['channels:read', 'chat:write'],
        authUrl: 'https://slack.com/oauth/v2/authorize',
        tokenUrl: 'https://slack.com/api/oauth.v2.access',
        redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth2/slack`,
        storageNamespace: 'slackAuth'
      },
    linkedin: {
      clientId: process.env.LINKEDIN_CLIENT_ID || "",
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET || "",
      scopes: ['openid', 'profile', 'email', 'w_member_social'],
      authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
      tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
      redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/oauth2/linkedin/callback`,
      storageNamespace: 'linkedinAuth'
    }
    // Add new platforms here
  };

//   {
//     "display_information": {
//         "name": "Demo App"
//     },
//     "settings": {
//         "org_deploy_enabled": false,
//         "socket_mode_enabled": false,
//         "is_hosted": false,
//         "token_rotation_enabled": false
//     }
// }