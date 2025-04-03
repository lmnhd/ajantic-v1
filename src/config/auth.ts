import { AuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import GithubProvider from "next-auth/providers/github";
import LinkedInProvider from "next-auth/providers/linkedin";
import TwitterProvider from "next-auth/providers/twitter";
import FacebookProvider from "next-auth/providers/facebook";
import DropboxProvider from "next-auth/providers/dropbox";

export const authConfig: AuthOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_ID!,
            clientSecret: process.env.GOOGLE_SECRET!,
            authorization: {
                params: {
                    scope: [
                        'https://www.googleapis.com/auth/userinfo.email',
                        'https://www.googleapis.com/auth/userinfo.profile',
                        'https://mail.google.com/',
                        'https://www.googleapis.com/auth/calendar',
                        'https://www.googleapis.com/auth/drive',
                        'https://www.googleapis.com/auth/drive.file',
                        'https://www.googleapis.com/auth/drive.appdata',
                        'https://www.googleapis.com/auth/spreadsheets',
                        'https://www.googleapis.com/auth/youtube',
                        'https://www.googleapis.com/auth/youtube.force-ssl',
                        'https://www.googleapis.com/auth/youtube.readonly'
                    ].join(' '),
                    access_type: 'offline',
                    prompt: 'consent'
                }
            }
        }),
        GithubProvider({
            clientId: process.env.GITHUB_ID!,
            clientSecret: process.env.GITHUB_SECRET!,
            authorization: {
                params: {
                    scope: 'user:email user:follow'
                }
            }
        }),
        LinkedInProvider({
            clientId: process.env.LINKEDIN_ID!,
            clientSecret: process.env.LINKEDIN_SECRET!,
            authorization: {
                params: {
                    scope: 'openid profile email w_member_social',
                    access_type: 'offline',
                    prompt: 'consent'
                }
            },
            userinfo: {
                url: 'https://api.linkedin.com/v2/userinfo'
            },
            profile(profile) {
                return {
                    id: profile.sub,
                    name: profile.name,
                    email: profile.email,
                    image: profile.picture
                }
            },
            checks: ['pkce', 'state']
        }),
        TwitterProvider({
            clientId: process.env.TWITTER_ID!,
            clientSecret: process.env.TWITTER_SECRET!,
            authorization: {
                params: {
                    scope: 'tweet.read users.read follows.read',
                    access_type: 'offline',
                    prompt: 'consent'
                }
            }
        }),
        DropboxProvider({
            clientId: process.env.DROPBOX_ID!,
            clientSecret: process.env.DROPBOX_SECRET!,
            authorization: {
                params: { 
                    token_access_type: 'offline',
                    scope: 'account_info.read files.content.write'
                }
            },
            userinfo: {
                url: 'https://api.dropboxapi.com/2/users/get_current_account',
                request: async (context) => {
                    return await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${context.tokens.access_token}` }
                    }).then(res => res.json())
                }
            },
            profile(profile) {
                return {
                    id: profile.account_id,
                    name: profile.name.display_name,
                    email: profile.email,
                    image: profile.profile_photo_url
                }
            }
        })
    ],
    secret: process.env.NEXTAUTH_SECRET, // Requires env var later
    callbacks: {
        // Add callbacks later if needed
    }
};