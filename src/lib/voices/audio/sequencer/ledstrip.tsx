"use client";
import React, { useEffect, useState } from "react";
import * as Tone from "tone";
export default function LedStrip({
  start,
  numSteps,
  isBacklitBar,
  bgColorTW = 'bg-red-500 ',
}: {
  start: boolean;
  numSteps: number;
  isBacklitBar?: boolean;
  bgColorTW?: string;
}) {
  const [ledStep, setLedStep] = useState<number>(0);
  useEffect(() => {
    const ledRun = async () => {
      console.log("ledRun");
      Tone.Transport.scheduleRepeat(repeat, `${numSteps}n`);
      Tone.Transport.start();
    };
    function repeat(time: any) {
      //console.log('repeat');
      setLedStep((ledStep) => {
        if (ledStep == numSteps - 1) {
          return 0;
        } else {
          return ledStep + 1;
        }
      });
    }
    if (start) {
      ledRun();
    } else {
      Tone.getTransport().stop();
      Tone.getTransport().cancel();
      setLedStep(0);
    }
    
  }, [start, numSteps]);

  return (
    <div 
    className="flex gap-2 md:flex-row items-end justify-center w-full border-white border-[1px] rounded-xl"
    >
      {Array(numSteps)
        .fill(0)
        .map((num, ledIndex) => {
          
          return (
            <div key={`led-wrapper-${ledIndex}`}>

              {isBacklitBar ? <p
                key={`led-${ledIndex}`}
                className={`w-6 md:w-12 h-24 mx-1 p-2 py-4 text-xs rounded-xl text-center align-text-top mt-2   ${
                  ledIndex == ledStep
                    ? `${bgColorTW} opacity-30`
                    : "bg-black opacity-0"
                } `}
              > </p>: 
              <p
              key={`led-${ledIndex}`}
              className={`w-6 md:w-12 h-3 mx-1 text-xs rounded-3xl text-center align-text-top transition-opacity? duration-300 ease-out ${
                ledIndex == ledStep
                  ? "bg-blue-500 opacity-100"
                  : "bg-black opacity-0"
              } `}
            ></p>}
            </div>
          );
        })}
    </div>
  );
}
