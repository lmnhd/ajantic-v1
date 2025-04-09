/**
 * Shared state variables for pause and cancel flags.
 * NOTE: In a multi-request environment (like serverless functions), this in-memory state
 * will NOT persist reliably across requests. A more robust solution (e.g., database,
 * Redis, external state store) would be needed for production scenarios.
 */
let _orchestrationIsPaused = false;
let _orchestrationContinueSignal = false;
let _orchestrationIsCancelled = false;

// --- Pause Logic --- //

/**
 * Checks if the orchestration process is currently marked as paused.
 * @returns {boolean} True if paused, false otherwise.
 */
export const ORCHESTRATION_isPaused = (): boolean => {
  return _orchestrationIsPaused;
};

/**
 * Sets the pause flag to true.
 */
export const ORCHESTRATION_requestPause = (): void => {
  _orchestrationIsPaused = true;
  _orchestrationContinueSignal = false; // Ensure continue signal is reset when pausing
};

/**
 * Clears the pause flag, allowing the process to resume if it was paused.
 */
export const ORCHESTRATION_clearPauseFlag = (): void => {
  _orchestrationIsPaused = false;
};

/**
 * Checks if the signal to continue from a paused state has been received.
 * @returns {boolean} True if the continue signal is set, false otherwise.
 */
export const ORCHESTRATION_shouldContinueFromPause = (): boolean => {
  return _orchestrationContinueSignal;
};

/**
 * Sets the signal to continue from a paused state.
 */
export const ORCHESTRATION_signalContinueFromPause = (): void => {
  _orchestrationContinueSignal = true;
};

/**
 * Clears the continue signal flag.
 */
export const ORCHESTRATION_clearContinueSignal = (): void => {
  _orchestrationContinueSignal = false;
};

/**
 * Resets all pause-related flags to their initial state (not paused, no continue signal).
 */
export const ORCHESTRATION_resetPauseState = (): void => {
  _orchestrationIsPaused = false;
  _orchestrationContinueSignal = false;
};

// --- Cancel Logic --- //

/**
 * Checks if the orchestration process has been marked for cancellation.
 * @returns {boolean} True if cancelled, false otherwise.
 */
export const ORCHESTRATION_isCancelled = (): boolean => {
  return _orchestrationIsCancelled;
};

/**
 * Sets the cancellation flag to true.
 */
export const ORCHESTRATION_requestCancel = (): void => {
  _orchestrationIsCancelled = true;
};

/**
 * Clears the cancellation flag.
 */
export const ORCHESTRATION_clearCancelFlag = (): void => {
  _orchestrationIsCancelled = false;
};

/**
 * Resets all cancellation-related flags (not cancelled).
 */
export const ORCHESTRATION_resetCancelState = (): void => {
  _orchestrationIsCancelled = false;
};

// --- Combined Reset --- //

/**
 * Resets all pause and cancel flags to their default states.
 */
export const ORCHESTRATION_resetAllControlFlags = (): void => {
  ORCHESTRATION_resetPauseState();
  ORCHESTRATION_resetCancelState();
}; 