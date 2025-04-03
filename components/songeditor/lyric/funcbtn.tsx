import { Button } from "@/components/ui/button";
import React from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

export default function FunctionButton({
  icon,
  name,
  displayName,
  description,
  handleFunctionSelected,
  color,
}: {
  icon: any;
  name: string;
  displayName: string;
  description: string;
  handleFunctionSelected: any;
  color: string;
}) {
  return (
    <div
      className={`relative w-16 h-16 gap-4 my-1 flex flex-col  items-center justify-start group`}
    >
      <div
        className={`hidden text-center mb-4 group-hover:block text-xs font-thin whitespace-pre-wrap  `}
      >
        {displayName}
      </div>
      <Button
        className={`w-12 hover:bg-violet-500/30 absolute bottom-0 shadow-sm p-3 ${color} group-hover:block`}
        variant={"secondary"}
        type="button"
        //title={name}
        onClick={() => {
          handleFunctionSelected(name);
        }}
      >
        <HoverCard>
          <HoverCardTrigger>{icon}</HoverCardTrigger>
          <HoverCardContent><p className="whitespace-break-spaces w-48">{description}</p></HoverCardContent>
        </HoverCard>
      </Button>
    </div>
  );
}
