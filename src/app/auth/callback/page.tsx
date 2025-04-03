"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { storeServiceTokens } from "../../actions/store-service-token";
import { useAnalysisStore } from "@/src/lib/store/analysis-store";

// Define custom session type to include the properties we need
interface CustomSession {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    id?: string;
  };
  provider?: string;
  accessToken?: string;
}

export default function CallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status, update } = useSession();
  const [isMounted, setIsMounted] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Cast session to our custom type
  const customSession = session as unknown as CustomSession;

  console.log("CallbackPage component rendering", {
    isMounted,
    status,
    session,
    hasCompleted,
    userId,
  });

  // Mounting effect
  useEffect(() => {
    console.log("CALLBACK_PAGE:useEffect: Mounting component");

    setIsMounted(true);
    return () => {
      console.log("useEffect: Unmounting component");
    };
  }, []);

  // get the userId from query params or session storage
  useEffect(() => {
    const userIdFromParams = searchParams?.get("userId");
    if (userIdFromParams) {
      console.log(
        "CALLBACK_PAGE:useEffect: Got userId from query params",
        userIdFromParams
      );
      setUserId(userIdFromParams);
      return;
    }

    // Fallback to session storage if query param not found
    if (!customSession || !customSession.user?.email) {
      console.log("CALLBACK_PAGE:useEffect: No session or user email");
      return;
    }

    const _sess = sessionStorage.getItem(
      `userId_${customSession?.provider || "google"}`
    );
    if (_sess) {
      const _data = JSON.parse(_sess);
      setUserId(_data.userId);
    }
  }, [customSession, searchParams]);

  // Auth handling effect
  useEffect(() => {
    if (
      !isMounted ||
      hasCompleted ||
      status !== "authenticated" ||
      !customSession ||
      !userId
    ) {
      console.log(
        "CALLBACK_PAGE:useEffect: Not mounted, already completed, or session not ready, skipping"
      );
      return;
    }

    const handleAuth = async () => {
      console.log("CALLBACK_PAGE:useEffect: handleAuth");
      if (!userId) {
        console.error("CALLBACK_PAGE:useEffect: UserId not found");
        return;
      }
      try {
        // const _data = JSON.parse(sessionStorage.getItem(`userId_${session?.provider || 'google'}`) || '{}');
        // const userId = _data.userId;

        // if (!userId) {
        //   console.error("HANDLE_AUTH: UserId not found");

        //   return;
        // }
        await update();
        console.log("HANDLE_AUTH: Session updated");
        console.log(
          "HANDLE_AUTH: UserId:",
          userId,
          customSession.provider,
          customSession.user?.email
        );

        if (customSession.accessToken && userId && customSession.user?.email) {
          // Store tokens using Clerk userId for indexing
          const result = await storeServiceTokens(
            {
              accessToken: customSession.accessToken || "",
              provider: customSession.provider || "google",
              userId: customSession.user?.id || customSession.user?.email || "",
              expiresAt: Math.floor(Date.now() / 1000) + 3600,
            },
            userId, // Clerk userId used for indexing
            customSession.provider || "google"
          );
          if (!result.success) {
            console.error("HANDLE_AUTH: Failed to store tokens");
            //throw new Error("Failed to store tokens");
          } else {
            console.log("HANDLE_AUTH: Successfully stored tokens");
          }
          // Set auth status
          const authStatus = {
            source: "auth-callback",

            type: "AUTH_SUCCESS",
            platform: customSession?.provider?.toLowerCase() || "google",
            timestamp: Date.now(),
          };
          console.log("Storing auth status in localStorage:", authStatus);
          localStorage.setItem(
            `auth_status_${authStatus.platform.toLowerCase()}`,
            JSON.stringify(authStatus)
          );
        } else {
          console.error("handleAuth: No access token found");
        }
      } catch (error) {
        console.error("handleAuth: Authentication failed:", error);
        const authStatus = {
          source: "auth-callback",
          type: "AUTH_ERROR",
          platform: customSession?.provider || "google",
          timestamp: Date.now(),
        };
        localStorage.setItem(
          `auth_status_${authStatus.platform.toLowerCase()}`,
          JSON.stringify(authStatus)
        );
      } finally {
        setHasCompleted(true);
        console.log("handleAuth: Completed");
        // remove the userId from session storage
        //sessionStorage.removeItem(`userId_${session?.provider || 'google'}`);
        // setTimeout(() => {
        //   window.close();
        // }, 1000);
      }
    };

    handleAuth();
  }, [status]);

  // Move this to the top of the component
  // useEffect(() => {
  //   // Check for window.opener immediately
  //   if (window.opener) {
  //     console.log("Callback: Found window.opener, sending message");
  //     window.opener.postMessage({
  //       source: "auth-callback",
  //       type: "AUTH_SUCCESS"
  //     }, window.location.origin);
  //   }
  // }, []); // Empty dependency array to run once on mount

  if (!isMounted) {
    console.log("Rendering: Not mounted, returning null");
    return null;
  }

  // console.log("Rendering: Client-side code");
  // console.log("Window opener:", window.opener);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-lg font-semibold mb-2">
          {!isMounted
            ? "Initializing..."
            : !customSession
            ? "Waiting for session..."
            : !customSession.user?.email
            ? "Validating user..."
            : hasCompleted
            ? "Authentication complete!"
            : "Processing authentication..."}
        </h2>
        {status === "loading" && (
          <div className="text-sm text-gray-500">Loading session data...</div>
        )}
      </div>
    </div>
  );
}
