"use client"
import * as Tone from "tone";
import { useEffect, useState } from "react";
import { Song, Step } from "./sequencertypes";

type ClockProps = {
    numSteps:number;
    sequences: Song[];
    pattern: number;
    players:Tone.Player[];
    isPlaying:boolean;
    handleStepChanged?:any
    children:React.ReactNode
}


export default function Clock (
    {numSteps, sequences, pattern, players, handleStepChanged, isPlaying,children}:ClockProps
)  {

    const [currentStep, setCurrentStep] = useState<number>(0);

    useEffect(() => {
        sequencePattern();
    }, [isPlaying])
    let index1 = 0;
    let step = 0;
    async function sequencePattern() {
        index1 = 0;
    
        Tone.Transport.scheduleRepeat(repeat, `${numSteps}n`);
        Tone.Transport.start();
      }
    
    function repeat(time: any) {
        // console.log("Playing Sequence ", currentSequence)
        //console.log("keypads length", keypads )
        console.log("Sample Loader Counter Step - ", currentStep);
    
        step = index1 % numSteps;
    
        setCurrentStep(step);
        handleStepChanged(step);
    
        for (let row = 0; row < sequences[pattern].length; row++) {
          //let note = notes[row];
    
          let samplePlayer: Tone.Player = players[row];
          if (!samplePlayer) {
            return;
          }
          let pad: Step = sequences[pattern][row][step];
    
          if (pad.selected) {
            // setCurrentStep(step);
            pad.isPlaying = true;
            //console.log("roll => ", pad.roll);
            //console.log(keypads[row][step]);
          }
          if (pad.isPlaying) {
            pad.isPlaying = false;
            //setCurrentStep(currentStep + 1);
          }
        }
    
        index1++;
      }

return <>{children}</>
}
