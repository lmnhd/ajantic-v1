"use client";
import { Button } from "@/components/ui/button";
import { signIn } from "next-auth/react";

export function SignInButton({ platform }: { platform: string }) {
  console.log("SignInButton", platform);
  const handleSignIn = () => {
    // Triggers NextAuth sign-in, which redirects user to the OAuth provider
    signIn(platform, { callbackUrl: `/auth/callback`, redirect: true });
  };

  return (
    <Button variant="outline" onClick={handleSignIn}>
      Sign in with {platform}
    </Button>
  );
}
