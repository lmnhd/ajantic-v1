import { ResearchSet } from "@/src/lib/types";
import React from "react";

export default function ResearchSetsPanel({
  sets,
  handleSetSelected,
}: {
  sets: {id: number, name:string}[];
  handleSetSelected: (id: number) => void;
}) {
  return (
    <div className="flex gap-3">
      {sets.map((set, index) => (
        <div
          key={index}
          className="bg-blue-800/30  rounded-lg p-4 mb-4 cursor-pointer hover:bg-indigo-700"
          onClick={() => handleSetSelected(set.id)}
        >
          <h3 className="text-xs ">{set.name}</h3>
        
        </div>
      ))}
    </div>
  );
}
