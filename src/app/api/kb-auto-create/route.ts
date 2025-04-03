import { NextResponse } from "next/server";
import { KB_autoCreate, deleteResearchEntry, deleteResearchEntries } from "./create-knowledge-base";
import { logger } from "@/src/lib/logger";

export const runtime = 'nodejs';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export async function POST(req: Request) {
  logger.log("Received auto-create knowledge base request");
  
  try {
    const { userId, agentName, responsibilities, agentTitle, agentRole, teamObjectives } = await req.json();
    logger.debug("Request parameters:", {
      userId,
      agentName,
      responsibilitiesCount: responsibilities?.length || 0,
      hasAgentTitle: !!agentTitle,
      hasAgentRole: !!agentRole,
      hasTeamObjectives: !!teamObjectives
    });

    if (!userId || !agentName) {
      logger.debug("Missing required fields", { userId, agentName });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    logger.tool("Creating knowledge base", {
      agentName,
      userId,
      responsibilitiesProvided: !!responsibilities?.length
    });

    const result = await KB_autoCreate(userId, agentName, responsibilities, agentTitle, agentRole, teamObjectives);
    logger.debug("Knowledge base creation result:", result);
    logger.log("Successfully created knowledge base");
    
    return NextResponse.json(result);

  } catch (error) {
    logger.debug("Error in auto-create API route:", {
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json(
      { error: `Failed to create knowledge base: ${getErrorMessage(error)}` },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { documentIds, namespace } = await req.json();

    if (!namespace) {
      return NextResponse.json(
        { error: 'Missing namespace' },
        { status: 400 }
      );
    }

    // Handle single or multiple document deletions
    if (Array.isArray(documentIds)) {
      const result = await deleteResearchEntries(documentIds, namespace);
      return NextResponse.json({
        success: result,
        message: result ? 'Entries deleted successfully' : 'Failed to delete entries'
      });
    } else if (documentIds) {
      const result = await deleteResearchEntry(documentIds, namespace);
      return NextResponse.json({
        success: result,
        message: result ? 'Entry deleted successfully' : 'Failed to delete entry'
      });
    } else {
      return NextResponse.json(
        { error: 'Missing documentIds' },
        { status: 400 }
      );
    }

  } catch (error) {
    logger.debug("Error deleting research entries:", {
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.json(
      { error: `Failed to delete entries: ${getErrorMessage(error)}` },
      { status: 500 }
    );
  }
}