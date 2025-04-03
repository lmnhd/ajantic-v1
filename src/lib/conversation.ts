"use server";

import { AISessionState, ServerMessage } from "@/src/lib/types";
import { Conversation } from "@prisma/client";
import { db } from "@/src/lib/db";
import { revalidatePath } from "next/cache";
import { AGENT_CONVO_SUMMARIZE } from "./agent-convo-summarize";

// Format date as "Mon-Dec-23-2024"
export const formatDayName = async (date: Date): Promise<string> => {
  try {
    // Ensure we have a valid Date object
    const validDate = new Date(date);
    if (isNaN(validDate.getTime())) {
      throw new Error("Invalid date");
    }

    const weekday = validDate.toLocaleString("en-US", { weekday: "short" });
    const month = validDate.toLocaleString("en-US", { month: "short" });
    const day = validDate.getDate().toString().padStart(2, "0");
    const year = validDate.getFullYear();

    return `${weekday}-${month}-${day}-${year}`;
  } catch (error) {
    console.error("Error formatting date:", error);
    // Fallback format: YYYY-MM-DD
    const fallbackDate = new Date();
    return fallbackDate.toISOString().split("T")[0];
  }
};

type ConversationStoreProps = {
  dayName: string;
  userId: string;
  conversations: ServerMessage[];
};

// Store conversation and update last day name
export const CONVERSATION_store = async (props: ConversationStoreProps) => {
  const { dayName, userId, conversations } = props;

  if (!dayName || !userId || !conversations) {
    console.error("Missing required parameters for conversation storage");
    return false;
  }

  const maxRetries = 3;
  let retryCount = 0;

  const messagesJson = JSON.stringify(
    conversations.map((message) => ({
      role: message.role,
      content: message.content,
      agentName: message.agentName,
      currentState: message.currentState || "{}",
    }))
  );

  while (retryCount < maxRetries) {
    try {
      // First, create the conversation
      const savedConversation = await db.conversation.create({
        data: {
          dayName: dayName,
          userId: userId,
          messages: messagesJson,
        },
      });

      // Then, update the last conversation day name
      const existingLastDay = await db.lastConversationDayName.findFirst({
        where: { userId: userId },
      });

      if (existingLastDay) {
        await db.lastConversationDayName.update({
          where: { id: existingLastDay.id },
          data: { dayName: dayName },
        });
      } else {
        await db.lastConversationDayName.create({
          data: {
            userId: userId,
            dayName: dayName,
          },
        });
      }

      // If we get here, everything succeeded
      revalidatePath("/research/analysis");
      return true;
    } catch (error) {
      console.error(
        `Error saving conversation (attempt ${retryCount + 1}/${maxRetries}):`,
        error
      );
      if (error instanceof Error) {
        console.error("Error details:", error.message);
      }

      retryCount++;
      if (retryCount === maxRetries) {
        console.error("Max retries reached, giving up");
        return false;
      }

      // Wait before retrying (exponential backoff)
      await new Promise((resolve) =>
        setTimeout(resolve, Math.pow(2, retryCount) * 1000)
      );
    }
  }

  return false;
};

type LoadByDayProps = {
  dayName: string;
  userId: string;
};

export const CONVERSATION_loadByDay = async (
  {dayName, userId}: {dayName: string, userId: string}
): Promise<{id: number, dayName: string}[]> => {
  

  if (!dayName || !userId) {
    console.error("Missing required parameters for loading conversations");
    return [];
  }

  try {
    const dayConversations = await db.conversation.findMany({
      where: {
        userId: userId,
        dayName: dayName,
      },
      orderBy: {
        id: "asc",
      },
      select: {
        id: true,
        dayName: true,
        
      },
    });

    return dayConversations;
  } catch (error) {
    console.error("Error loading conversations for day:", error);
    if (error instanceof Error) {
      console.error("Error details:", error.message);
    }
    return [];
  }
};

type UserIdProps = {
  userId: string;
};

// Load conversations for the most recent day
export const CONVERSATION_loadLatestDayConversations = async (
  props: UserIdProps
): Promise<{id: number, dayName: string}[]> => {
  const { userId } = props;

  if (!userId) {
    console.error("Missing userId for loading latest conversations");
    return [];
  }

  try {
    // Load most recent conversation day
    const lastDay = await db.lastConversationDayName.findFirst({
      where: { userId: userId },
      orderBy: {
        id: "desc",
      },
      //select: { dayName: true, id: true },
    });

    if (!lastDay?.dayName) {
      return [];
    }

    return CONVERSATION_loadByDay({ dayName: lastDay.dayName, userId });
  } catch (error) {
    console.error("Error loading latest conversations:", error);
    if (error instanceof Error) {
      console.error("Error details:", error.message);
    }
    return [];
  }
};

// Get all conversation days for a user
export const CONVERSATION_getAllConversationDaysForUser = async (
  props: UserIdProps
): Promise<string[]> => {
  const { userId } = props;

  if (!userId) {
    console.error("Missing userId for getting conversation days");
    return [];
  }

  try {
    const conversations = await db.conversation.findMany({
      where: { userId: userId },
      select: { dayName: true },
      distinct: ["dayName"],
      orderBy: {
        id: "desc",
      },
    });

    return conversations.map((conv) => conv.dayName);
  } catch (error) {
    console.error("Error getting conversation days:", error);
    if (error instanceof Error) {
      console.error("Error details:", error.message);
    }
    return [];
  }
};

// Get the most recent conversation day name
export const CONVERSATION_getLatestDayName = async (
  props: UserIdProps
): Promise<string> => {
  const { userId } = props;

  if (!userId) {
    console.error("Missing userId for getting latest day name");
    return "";
  }

  try {
    const lastDay = await db.lastConversationDayName.findFirst({
      where: { userId: userId },
    });
    return lastDay?.dayName || "";
  } catch (error) {
    console.error("Error getting latest day name:", error);
    if (error instanceof Error) {
      console.error("Error details:", error.message);
    }
    return "";
  }
};

export const CONVERSATION_getById = async (props: {id: number}) => {
  try {
    const { id } = props;
    console.log("!!!CONVERSATION_getSingleConversation!!!", id)
    const conversation = await db.conversation.findUnique({
      where: { id },
    });
    return conversation?.messages;
  } catch (error) {
    console.error("Error getting conversation by ID:", error);
    if (error instanceof Error) {
      console.error("Error details:", error.message); 
    }
    return null;
  }
};

export async function CONVERSATION_handleSummarize(
  messages: ServerMessage[],
  state: AISessionState
): Promise<string> {
  // Do your summarization logic here
  const summary = await AGENT_CONVO_SUMMARIZE(messages);

  // Return the new messages array instead of calling an update function
  return summary;
}

