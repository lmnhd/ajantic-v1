"use client";
import React from "react";
import {
  MicIcon,
  MenuIcon,
  ArrowLeftRightIcon,
  BotIcon,
  LucideIcon,
} from "lucide-react";
import Link from "next/link";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from "@clerk/clerk-react";
import { useNavbarStore } from "@/src/lib/navbar-store";
import { cn } from "@/src/lib/utils";

function Navbar() {
  const { title, Icon, coloredLetters, links, prototypeButton, type } =
    useNavbarStore();

  if (type === "hidden") return null;
  if (type === "minimized") return (
    <header className="fixed right-0 left-0 top-0 w-full py-2 px-4 bg-black/40 backdrop-blur-lg z-[50] flex items-center border-b-[1px] border-neutral-900 justify-between">
      <Link href="/">
        <Icon className="text-purple-500" size={24} />
      </Link>
      <SignedIn>
        <UserButton />
      </SignedIn>
      <SignedOut>
        <SignInButton />
      </SignedOut>
    </header>
  )
  return (
    <header className="fixed right-0 text-blue-500 left-0 top-0 w-full py-4 px-4 bg-black/40 backdrop-blur-lg z-[50] flex items-center border-b-[1px] border-neutral-900 justify-between">
      <Link href="/">
        <aside className="flex items-center gap-[2px]">
          <p className="text-3xl font-semibold tracking-widest">
            {title.split("").map((letter, index) => {
              const coloredLetter = coloredLetters.find(
                (l) => l.index === index
              );
              return coloredLetter ? (
                <span key={index} className={cn(coloredLetter.color, "ml-1")}>
                  {coloredLetter.letter}
                </span>
              ) : (
                letter
              );
            })}
          </p>
          <Icon className="mx-1 font-extralight text-purple-500" size={30} />
        </aside>
      </Link>
      <nav className="absolute left-[50%] top-[50%] transform translate-x-[-50%] translate-y-[-50%] hidden md:block">
        <ul className="flex items-center justify-around space-x-8">
          {links.map(
            (link, index) =>
              link.isVisible !== false && (
                <li key={index}>
                  <Link
                    className={cn(
                      "hover:text-violet-400 hover:scale-110",
                      link.color
                    )}
                    href={link.href}
                  >
                    {link.label}
                  </Link>
                </li>
              )
          )}
        </ul>
      </nav>
      <aside className="flex items-center gap-4">
        {prototypeButton.isVisible && (
          <Link
            href={prototypeButton.href}
            className="relative inline-flex h-10 overflow-hidden rounded-full p-[3px] focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-50"
          >
            <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#E2CBFF_0%,#393BB2_50%,#E2CBFF_100%)]" />
            <span className="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-full bg-slate-950 px-3 py-1 text-sm font-medium text-white backdrop-blur-3xl">
              {prototypeButton.label}
            </span>
          </Link>
        )}
        <SignedOut>
          <SignInButton mode="modal" />
        </SignedOut>
        <SignedIn>
          <UserButton />
        </SignedIn>
        <MenuIcon className="md:hidden" />
      </aside>
    </header>
  );
}

export default Navbar;
