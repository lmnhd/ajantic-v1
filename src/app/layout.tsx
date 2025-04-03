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
const inter = Inter({ subsets: ["latin"] });

// If you have metadata, you can include it here
// export const metadata: Metadata = {
//   title: "Your App Title",
//   description: "Your App Description",
// };

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
        <body
        //className="w-3/4 mx-auto"
          // className={cn(
          //   "dark:bg-black? bg-dot-white/[0.2] dark:text-violet-200",
          //   inter.className
          // )}
          //className="w-full dark:bg-black bg-white  dark:bg-grid-white/[0.2] bg-grid-black/[0.2] relative flex items-center justify-center"
        >
          <div 
          >
            <AuthProviders>
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
