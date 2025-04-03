"use server"

import { auth } from "@/src/lib/auth";
import { authConfig } from "@/src/config/auth";




export async function callServiceAPI(endpoint: string, method: string = "GET") {
  const session = await auth(authConfig);
  

  if (!session?.accessToken) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json"
    },
    method
  });

  return response.json();
}

// Example usage in components:
const listSlackChannels = async () => {
  return callServiceAPI("https://slack.com/api/conversations.list");
};
