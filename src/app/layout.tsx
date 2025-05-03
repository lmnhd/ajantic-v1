// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import {
  ClerkProvider,
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { cn } from "@/src/lib/utils";
import Navbar from "@/components/global/navbar";
import { Toaster } from "@/components/ui/toaster";
import { AIProvider } from "../lib/aicontext";
import AuthProviders from "../lib/providers/auth-providers";
import { StoreInitializer } from "@/components/global/StoreInitializer"; // Import the initializer

const inter = Inter({ subsets: ["latin"] });

// ... metadata ...

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
    >
      <html lang="en" suppressHydrationWarning={true}>
        <body /* ... className */ >
          <div> {/* Keep this div or adjust structure as needed */}
            <AuthProviders>
              {/* Place Initializer inside AuthProviders and ClerkProvider context */}
              <StoreInitializer />
              <AIProvider>
                <ThemeProvider
                  attribute="class"
                  defaultTheme="dark"
                  enableSystem
                  disableTransitionOnChange
                >
                  <Navbar />
                  <main className="min-h-screen bg-gradient-to-br from-violet-950/50 via-violet-900/30 to-indigo-950/50 ">{children}</main>
                  <Toaster />
                </ThemeProvider>
              </AIProvider>
            </AuthProviders>
          </div>
        </body>
      </html>
    </ClerkProvider>
  );
}