import React, { useEffect } from "react";
import { Song, SequencePanelProps, SequenceRow } from "./sequencertypes";


export default function SequencePanel({currentSequence,handleAddSequenceSelected,handleSequenceSelected,sequences}:SequencePanelProps) {
  

  const renderSequences = () => {
    return sequences.map((sequence, index) => {
      return (
        <div
        key={"sequence -" + index}
          className={`flex items-center justify-center w-14 h-6 ${
            index === currentSequence ? "bg-violet-900" : "bg-slate-900"
          } text-lime-500 border-[1px] border-indigo-900 rounded-xl mx-1 cursor-pointer hover:bg-indigo-500 hover:text-black`}
          onClick={(e) => handleSequenceSelected(e, index)}
        >
          <p>{index + 1}</p>
        </div>
      );
    });
  };
  const renderButtons = (symbol: string) => {
    return (
      <div
      key={`button-${symbol}`}
        className={`flex items-center justify-center w-10 h-6 text-lime-500 border-[1px] border-indigo-900 rounded-xl mx-1 cursor-pointer hover:bg-red-500 hover:text-black`}
        onClick={(e) => handleAddSequenceSelected(e)}
      >
        <p>{symbol}</p>
      </div>
    );
  };

  useEffect(() => {
    renderSequences();
    //console.log("sequences", sequences);
  }, [
     sequences
  ]);

  return (
    <div  className="flex flex-wrap gap-1 items-center justify-center w-full max-w-lg  mx-auto ">
      {renderButtons("-")}
      {/* sequence buttons */}
      {renderSequences()}
      {renderButtons("+")}
      
    </div>
  );
}
