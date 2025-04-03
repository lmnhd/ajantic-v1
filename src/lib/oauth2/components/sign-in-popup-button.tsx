"use client";

import { useState, useRef, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { getServiceTokens } from "@/src/app/actions/get-service-tokens";
import { revokeServiceTokens } from "@/src/app/actions/revoke-service-tokens";


// Save the userId to the session storage with a timestamp
//      
export function SignInPopupButton({ platform, userId }: { platform: string, userId: string }) {
  const [isPopupOpen, setIsPopupOpen] = useState(
    typeof window !== 'undefined' ? sessionStorage.getItem(`isPopupOpen_${platform}`) === 'true' : false
  );
  const [isAuthorized, setIsAuthorized] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const { data: session, update } = useSession();

  // Check for valid token on mount using Clerk userId
  useEffect(() => {
    const checkToken = async () => {
      console.log("checkToken running for user:", userId);
      try {
        const tokens = await getServiceTokens(platform, userId);
        if (tokens && tokens.accessToken) {
          console.log("Token check successful for platform:", platform.toLowerCase());
          setIsAuthorized(true);
        } else {
          console.log("No valid tokens found for platform:", platform.toLowerCase());
          setIsAuthorized(false);
        }

      } catch (error) {
        console.error("Token check failed:");
        setIsAuthorized(false);
      }
    };

    if (userId) {
      checkToken();
    }
  }, [platform, userId]);

  // Check for old userId in session storage
  useEffect(() => {
    const checkUserId = () => {
      const result = sessionStorage.getItem(`userId_${platform.toLowerCase()}`);
      if(result){
        const _data = JSON.parse(result);
        if(_data.timestamp < Date.now() - 1000 * 60 * 5){
          sessionStorage.removeItem(`userId_${platform.toLowerCase()}`);
        }
      }
    };
    checkUserId();
  }, [platform]);

  

  useEffect(() => {
    // Check for orphaned popup state on mount
    const checkPopupState = () => {
      if (typeof window !== 'undefined') {
        const popupState = sessionStorage.getItem(`isPopupOpen_${platform.toLowerCase()}`);
        if (popupState === 'true') {
          // If popup state exists but no popup window, reset it
          if (!popupRef.current || popupRef.current?.closed) {
            sessionStorage.removeItem(`isPopupOpen_${platform.toLowerCase()}`);
            setIsPopupOpen(false);
          }
        }
      }
    };

    checkPopupState();
  }, [platform]);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (typeof window !== 'undefined') {
        // Close popup if it's still open
        if (popupRef.current && !popupRef.current.closed) {
          popupRef.current.close();
        }
        console.log("removing isPopupOpen from sessionStorage");
        sessionStorage.removeItem(`isPopupOpen_${platform.toLowerCase()}`);
      }
    };
  }, [platform]);

  const openPopup = () => {
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    // Directly target the specific provider with proper encoding
    const callbackUrl = encodeURIComponent(`/auth/callback?userId=${userId}`);
    const url = `/api/auth/signin/${platform}?callbackUrl=${callbackUrl}`;
    
    popupRef.current = window.open(
      url,
      "OAuthPopup",
      `width=${width},height=${height},left=${left},top=${top},location=yes,status=yes`
    );

    if (!popupRef.current) {
      alert("Please allow popups for this site");
      return;
    }

    setIsPopupOpen(true);
    sessionStorage.setItem(`isPopupOpen_${platform.toLowerCase()}`, 'true');
  };


  useEffect(() => {
    let statusHandled = false; // Track if we've handled a status

    const checkAuthStatus = () => {
      if (typeof window === 'undefined' || statusHandled) return;

      const authStatus = localStorage.getItem(`auth_status_${platform.toLowerCase()}`);
      if (authStatus) {
        try {
          const status = JSON.parse(authStatus);
          console.log(`Auth status found for ${platform.toLowerCase()}:`, status);

          if (status.type === 'AUTH_SUCCESS') {
            console.log(`Auth success detected for ${platform.toLowerCase()}`);
            setIsAuthorized(true);
            setIsPopupOpen(false);
            sessionStorage.removeItem(`isPopupOpen_${platform.toLowerCase()}`);
            statusHandled = true; // Mark status as handled
          } else if (status.type === 'AUTH_ERROR') {
            console.log(`Auth error detected for ${platform.toLowerCase()}`);
            setIsPopupOpen(false);
            sessionStorage.removeItem(`isPopupOpen_${platform.toLowerCase()}`);
            statusHandled = true; // Mark status as handled

          }
          
          // Clean up the status
          localStorage.removeItem(`auth_status_${platform.toLowerCase()}`);
        } catch (error) {
          console.error(`Error parsing auth status for ${platform}:`, error);
          localStorage.removeItem(`auth_status_${platform.toLowerCase()}`);
        }

      }
    };

    // Check immediately when component mounts
    checkAuthStatus();

    // Also check when the popup closes
    const interval = setInterval(() => {
      if (popupRef.current?.closed) {
        checkAuthStatus();
      }
    }, 500);

    return () => {
      clearInterval(interval);
    };
  }, [platform, update]);

  // Add this useEffect to handle manual popup closure
  useEffect(() => {
    const checkPopupClosed = setInterval(() => {
      if (popupRef.current?.closed) {
        setIsPopupOpen(false);
        sessionStorage.removeItem(`isPopupOpen_${platform}`);
      }
    }, 500); // Check every 500ms

    return () => {
      clearInterval(checkPopupClosed);
    };
  }, [platform]);

  const handleRevoke = async () => {
    try {
      const result = await revokeServiceTokens(platform.toLowerCase(), userId);
      if (result.success) {
        console.log(`Successfully revoked ${platform.toLowerCase()} auth`);
        setIsAuthorized(false);
        // Clean up any local state
        localStorage.removeItem(`auth_status_${platform.toLowerCase()}`);
        sessionStorage.removeItem(`isPopupOpen_${platform.toLowerCase()}`);
      } else {
        console.error(`Failed to revoke ${platform.toLowerCase()} auth`);
      }
    } catch (error) {
      console.error(`Error revoking ${platform.toLowerCase()} auth:`, error);
    }

  };

  // if(session?.user?.id) {
  //   console.log("session?.user?.id", session?.user?.id);
  //   console.log("SignInPopupButton rendering", { isPopupOpen, isAuthorized });
  // }

  return (
    <div className="flex items-center gap-2">
      <Button 
        variant="outline" 
        onClick={openPopup}
        disabled={isPopupOpen || isAuthorized}
      >
        {isAuthorized ? `${platform} authorized` : (isPopupOpen ? "Signing in..." : `Sign in with ${platform}`)}
      </Button>
      {isAuthorized && (
        <Button
        className="w-16 text-xs"
          variant="destructive"
          onClick={handleRevoke}
          disabled={isPopupOpen}
        >
          Revoke
        </Button>
      )}
    </div>
  );
}