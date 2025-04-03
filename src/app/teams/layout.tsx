import React from 'react';
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Teams - Ajantic",
  description: "Manage collaborative AI teams",
};

export default function TeamsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      {/* Placeholder for potential header/nav spacing */}
      <div className="h-12"></div> 
      <div className="container mx-auto px-2 h-full">
        {children}
      </div>
    </div>
  );
} 