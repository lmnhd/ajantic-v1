import { NextRequest, NextResponse } from "next/server";
import { GmailService } from "@/src/lib/agent-tools/gmail.server";
import { SERVER_storeGeneralPurposeData } from "@/src/lib/server-actions";
import { DYNAMIC_NAMES } from "@/src/lib/dynamic-names";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  
  // Early return if no code/state to avoid unnecessary memory allocation
  if (!code || !state) {
    return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
  }

  try {
    // Parse state once and use throughout
    const stateData = JSON.parse(decodeURIComponent(state));
    const { userId, agentName } = stateData;

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const redirectUri = new URL('/api/gmail/auth', process.env.NEXT_PUBLIC_APP_URL).toString();
    const oauth2Flow = GmailService.createOAuth2Flow(redirectUri);

    // Get auth tokens and immediately destructure what we need
    const { access_token, refresh_token } = await oauth2Flow.handleCallback(code);
    
    if (!access_token || !refresh_token) {
      throw new Error('Missing required tokens');
    }

    // Store minimal auth data
    const fullNameSpace = await DYNAMIC_NAMES.namespace_generic(userId, 'gmailAuth');
    await SERVER_storeGeneralPurposeData(
      JSON.stringify({ access_token, refresh_token }),
      'gmailAuth',
      userId,
      '', // Empty string for email for now
      fullNameSpace,
      false
    );

    // Return minimal response
    return new NextResponse(
      `<html><script>
        window.opener.postMessage({
          type: 'GMAIL_AUTH_SUCCESS',
          email: '',
          agentName: '${agentName}'
        }, '*');
        window.close();
      </script></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  } catch (error) {
    console.error('Auth error:', error);
    return new NextResponse(
      `<html><script>window.close();</script></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
}
