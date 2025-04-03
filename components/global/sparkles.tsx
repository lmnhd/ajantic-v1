import React from "react";
import { cn } from "@/src/lib/utils";

interface SparklesProps {
  children: React.ReactNode;
  className?: string;
}

export const Sparkles: React.FC<SparklesProps> = ({ children, className }) => {
  return (
    <div className={cn("relative", className)}>
      {children}
    </div>
  );
};
