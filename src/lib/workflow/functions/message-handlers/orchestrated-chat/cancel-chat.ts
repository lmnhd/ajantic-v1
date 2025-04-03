import { ORCHESTRATION_PAUSE_resetAllFlags } from "./pause-chat";

// contains a function to statically store a flag to the session storage to indicate that the chat has been cancelled
export const ORCHESTRATED_CHAT_CANCELLED_KEY = "orchestratedChatCancelled";
// function to store the cancellation flag in the session storage
export function storeCancellationFlag() {
  sessionStorage.setItem(ORCHESTRATED_CHAT_CANCELLED_KEY, "true");
}

// function to check if the chat has been cancelled
export function isChatCancelled() {
  return sessionStorage.getItem(ORCHESTRATED_CHAT_CANCELLED_KEY) === "true";
}

// function to clear the cancellation flag from the session storage
export function clearCancellationFlag() {
  sessionStorage.removeItem(ORCHESTRATED_CHAT_CANCELLED_KEY);
  ORCHESTRATION_PAUSE_resetAllFlags();
}

// function to clear all flags
export function ORCHESTRATION_CANCEL_clearAllFlags() {
  clearCancellationFlag();
  ORCHESTRATION_PAUSE_resetAllFlags();
}
