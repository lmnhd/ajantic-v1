import { NextRequest, NextResponse } from "next/server";
import { GmailService } from "@/src/lib/agent-tools/gmail.server";

export async function POST(request: NextRequest) {
  try {
    const { action, auth, ...params } = await request.json();
    
    if (!auth) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const gmailService = new GmailService({ auth });
    
    switch (action) {
      case 'listMessages':
        return NextResponse.json(
          await gmailService.listMessages(params.query)
        );
      
      case 'getMessage':
        return NextResponse.json(
          await gmailService.getMessage(params.messageId)
        );
      
      case 'sendEmail':
        return NextResponse.json(
          await gmailService.sendMessage(
            params.to,
            params.subject,
            params.body
          )
        );
      
      case 'createDraft':
        return NextResponse.json(
          await gmailService.createDraft(
            params.to,
            params.subject,
            params.body
          )
        );
      
      case 'listLabels':
        return NextResponse.json(
          await gmailService.listLabels()
        );
      
      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Gmail operation error:', error);
    return NextResponse.json(
      { error: "Operation failed" },
      { status: 500 }
    );
  }
}