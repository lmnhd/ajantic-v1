"use client";

import { useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useAnalysisStore } from '@/src/lib/store/analysis-store';
import { useGlobalStore } from '@/src/lib/store/GloabalStoreState';
import { __initAppState, __initAIState } from '@/src/lib/lyric-helpers'; // Adjust paths if necessary
import { INDEXEDDB_initDB } from '@/src/lib/indexDB'; // Adjust paths if necessary
import { logger } from '@/src/lib/logger'; // Assuming logger is available

export function StoreInitializer() {
  const { isLoaded, isSignedIn, user } = useUser();
  // Ensure all necessary functions/state are destructured from the store hook
  const {
    initialize,
    isInitialized,
    loadEssentialData, // Keep if truly needed globally, otherwise remove
    megaLoadStateFromBrowserOrServer // Keep if truly needed globally, otherwise remove
    // Add other functions if they are truly needed globally on initial load
  } = useAnalysisStore();
  const { appState, setAppState, setGlobalMessages } = useGlobalStore();

  useEffect(() => {
    logger.log("StoreInitializer: useEffect running...", { isLoaded, isSignedIn, userId: user?.id, isInitialized, appStateUserId: appState.currentUser?.id });

    // Only run initialization if Clerk is loaded, user is signed in, and store isn't already initialized
    if (isLoaded && isSignedIn && user?.id && !isInitialized) {
       const userId = user.id;
       logger.log(`StoreInitializer: Conditions met for user ${userId}. Initializing...`);

       const init = async () => {
         try {
             // Set global state if not already set (similar logic from TeamsPage)
             if (!appState.currentUser) {
                logger.log(`StoreInitializer: Setting initial global state for user ${userId}`);
                setGlobalMessages({
                     ...__initAIState(),
                     currentState: { ...__initAIState().currentState, userId: userId, genericData: { userName: user.username || '', INIT_DONE: 1 } },
                });
                setAppState({ ...__initAppState(), currentUser: user });
                await INDEXEDDB_initDB(); // Initialize DB if needed
             }

             // Initialize the analysis store
             logger.log(`StoreInitializer: Calling analysisStore.initialize for user ${userId}`);
             await initialize(userId); // This should set localState.userId

             // Optional: Trigger other essential loads if needed globally
             // Consider if these are better triggered by specific pages or components
             // These might be heavy and delay initialization unnecessarily if not needed everywhere.
             // logger.log(`StoreInitializer: Calling loadEssentialData for user ${userId}`);
             // await loadEssentialData(userId);
             // logger.log(`StoreInitializer: Calling megaLoadStateFromBrowserOrServer`);
             // await megaLoadStateFromBrowserOrServer();

             logger.log(`StoreInitializer: Initialization complete for user ${userId}.`);

         } catch (error) {
             // Create a structured object for the logger
             const errorDetails = { error: error instanceof Error ? error.message : String(error) };
             logger.error("StoreInitializer: Error during initialization:", errorDetails);
         }
       };
       init();
    } else {
         logger.log("StoreInitializer: Conditions not met or already initialized.", { isLoaded, isSignedIn, userId: user?.id, isInitialized });
    }

  // Add dependencies that trigger re-check if user state changes after initial load
  }, [isLoaded, isSignedIn, user, isInitialized, initialize, appState, setAppState, setGlobalMessages]);
  // Removed loadEssentialData, megaLoadStateFromBrowserOrServer from deps unless they MUST run globally on load

  // This component doesn't render anything itself
  return null;
}
