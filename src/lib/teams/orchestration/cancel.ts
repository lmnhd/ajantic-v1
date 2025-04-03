/**
 * Orchestration cancellation utilities
 */

let activeRequests: Map<string, AbortController> = new Map();

/**
 * Register a new cancellable request
 */
export function registerRequest(id: string): AbortController {
  const controller = new AbortController();
  activeRequests.set(id, controller);
  return controller;
}

/**
 * Cancel a specific request by ID
 */
export function cancelRequest(id: string): boolean {
  const controller = activeRequests.get(id);
  if (controller) {
    controller.abort();
    activeRequests.delete(id);
    return true;
  }
  return false;
}

/**
 * Cancel all active requests
 */
export function cancelAllRequests(): void {
  for (const controller of activeRequests.values()) {
    controller.abort();
  }
  activeRequests.clear();
}

export default {
  registerRequest,
  cancelRequest,
  cancelAllRequests
}; 