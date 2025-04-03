"use client";
import { useEffect } from 'react';
import { IconType } from 'react-icons';
import { NavLink, PrototypeButton, useNavbarStore } from '@/src/lib/navbar-store';
import { LucideIcon } from 'lucide-react';

// Define the type for colored letters
export interface ColoredLetter {
  letter: string;
  color: string;
  index: number;
}

// Define the type for the navbar update parameters
interface NavbarUpdateParams {
  title: string;
  Icon: LucideIcon;
  coloredLetters: ColoredLetter[];
  links: NavLink[];
  prototypeButton: PrototypeButton;
  type: "normal" | "minimized" | "hidden";
}

export const useNavbarUpdater = ({ title, Icon, coloredLetters, links, prototypeButton, type }: NavbarUpdateParams) => {
  useEffect(() => {
    // Update navbar on mount
    useNavbarStore.getState().updateNavbar({
      title,
      Icon,
      coloredLetters,
      links,
      prototypeButton,
      type
    });

    // Reset navbar on unmount
    return () => {
      useNavbarStore.getState().resetNavbar();
    };
  }, [title, Icon, coloredLetters, links, prototypeButton, type]);
};
