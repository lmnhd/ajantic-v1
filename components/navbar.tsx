"use client";
import React from "react";
import Link from "next/link";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from "@clerk/nextjs";

export default function Navbar() {
  return (
    <header className="fixed right-0 left-0 top-0 w-full py-2 px-4 bg-black/40 backdrop-blur-lg z-[50] flex items-center border-b-[1px] border-neutral-900 justify-between">
      <Link href="/" className="text-xl font-bold">
        Ajantic
      </Link>
      <div className="flex items-center gap-4">
        <SignedIn>
          <UserButton />
        </SignedIn>
        <SignedOut>
          <SignInButton />
        </SignedOut>
      </div>
    </header>
  );
} 