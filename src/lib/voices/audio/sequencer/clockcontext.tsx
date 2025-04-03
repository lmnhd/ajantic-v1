"use client";
import { Context, createContext, useEffect, useState } from "react";
import * as Tone from "tone";
import { Song, Step } from "./sequencertypes";

export const ClockContext: Context<any> = createContext({
  currentStep: 0,
  setCurrentStep: undefined,
});

export const ClockProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [pattern, setPattern] = useState<number>(0);
  const [sequences, setSequences] = useState<Song[]>([]);
  const [players, setPlayers] = useState<Tone.Player[]>([]);
  const [numRows, setNumRows] = useState<number>(1);
  const [numSteps, setNumSteps] = useState<number>(16);
  const [handleStepChanged, setHandleStepChanged] = useState<any>(undefined);
  const [sampleIDs, setSampleIDs] = useState<{id:string,index:number}[]>([]);
//   useEffect(() => {
//     sequenceContextPattern();
//   }, [isPlaying]);


  let index1 = 0;
  let step = 0;
  async function sequenceContextPattern() {
    index1 = 0;

    // Tone.Transport.scheduleRepeat(repeat, `${numSteps}n`);
    // Tone.Transport.start();
  }

  function repeat(time: any) {
    // console.log("Playing Sequence ", currentSequence)
    //console.log("keypads length", keypads )
    console.log("Sample Loader Counter Step - ", currentStep);

    step = index1 % numSteps;

    //setCurrentStep(step);
    //if(handleStepChanged){
        //handleStepChanged(step);
    //}
   

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

  return (
    <ClockContext.Provider
      value={{
        currentStep,
        setCurrentStep,
        isPlaying,
        setIsPlaying,
        pattern,
        setPattern,
        sequences,
        setSequences,
        players,
        setPlayers,
        numSteps,
        setNumSteps,
        handleStepChanged,
        setHandleStepChanged,
        sequenceContextPattern,
        numRows,
        step,
        setNumRows,
        sampleIDs,
        setSampleIDs
       

      }}
    >
      {children}
    </ClockContext.Provider>
  );
};
