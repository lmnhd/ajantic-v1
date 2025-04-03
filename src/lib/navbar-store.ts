import { create } from "zustand";
import { BotIcon } from "lucide-react";
import { LucideIcon } from "lucide-react";

export interface ColoredLetter {
  letter: string;
  color: string;
  index: number;
}

export interface NavLink {
  href: string;
  label: string;
  color: string;
  isVisible?: boolean;
}

export interface PrototypeButton {
  href: string;
  label: string;
  color: string;
  isVisible?: boolean;
}

export interface NavbarState {
  type: "normal" | "minimized" | "hidden";
  title: string;
  Icon: LucideIcon;
  coloredLetters: ColoredLetter[];
  links: NavLink[];
  prototypeButton: PrototypeButton;
  // Actions
  updateNavbar: (params: {
    type?: "normal" | "minimized" | "hidden";
    title?: string;
    Icon?: LucideIcon;
    coloredLetters?: ColoredLetter[];
    links?: NavLink[];
    prototypeButton?: PrototypeButton;
  }) => void;
  resetNavbar: () => void;
}

const defaultState = {
  type: "normal" as "normal" | "minimized" | "hidden",
  title: "ajantic",
  Icon: BotIcon,
  coloredLetters: [
    { letter: "j", color: "text-pink-500", index: 1 },
    { letter: "n", color: "text-purple-500", index: 3 },
    { letter: "i", color: "text-indigo-500", index: 5 },
  ],
  links: [
    {
      href: "/research/wordplay",
      label: "think|more",
      color: "text-violet-900",
    },
    { href: "/subscribe", label: "think|less", color: "text-pink-900" },
    { href: "/research/analysis", label: "automate", color: "text-indigo-900" },
  ],
  prototypeButton: {
    href: "/research/analysis",
    label: "prototype",
    color: "text-violet-900",
    isVisible: true,
  },
};

export const useNavbarStore = create<NavbarState>()((set) => ({
  ...defaultState,

  updateNavbar: (params) => {
    set((state) => ({
      ...state,
      ...params,
    }));
  },

  resetNavbar: () => {
    set(defaultState);
  },
}));
