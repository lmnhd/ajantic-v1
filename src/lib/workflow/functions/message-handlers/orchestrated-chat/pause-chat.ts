// contains a function to statically store a flag to the session storage to indicate that the chat has been paused
export const ORCHESTRATED_CHAT_PAUSED_KEY = "orchestratedChatPaused";
export const ORCHESTRATED_CHAT_CONTINUE_KEY = "orchestratedChatContinue";
// function to store the pause flag in the session storage
export function ORCHESTRATION_PAUSE_storeFlag() {
  sessionStorage.setItem(ORCHESTRATED_CHAT_PAUSED_KEY, "true");
}

// function to check if the chat has been paused
export function ORCHESTRATION_PAUSE_isChatPaused() {
  return sessionStorage.getItem(ORCHESTRATED_CHAT_PAUSED_KEY) === "true";
}

// function to clear the pause flag from the session storage
export function ORCHESTRATION_PAUSE_clearFlag() {
  sessionStorage.removeItem(ORCHESTRATED_CHAT_PAUSED_KEY);
}

export function ORCHESTRATION_PAUSE_storeContinueFlag() {
  sessionStorage.setItem(ORCHESTRATED_CHAT_CONTINUE_KEY, "true");
}

// function to clear the continue flag from the session storage
export function ORCHESTRATION_PAUSE_clearContinueFlag() {
  sessionStorage.removeItem(ORCHESTRATED_CHAT_CONTINUE_KEY);
}

// function to check if the chat should continue  
export function ORCHESTRATION_PAUSE_continueChat() {
  // return true or false based on preset flag
  return sessionStorage.getItem(ORCHESTRATED_CHAT_CONTINUE_KEY) === "true";
}

// function to reset all flags
export function ORCHESTRATION_PAUSE_resetAllFlags() {
  ORCHESTRATION_PAUSE_clearFlag();
  ORCHESTRATION_PAUSE_clearContinueFlag();
}

