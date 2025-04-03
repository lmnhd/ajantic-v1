"use client";
import { cn, getDrumColor } from "@/lib/utils";
import React, { useEffect, useState } from "react";
import * as Tone from "tone";
import { Step, SequenceGroup, SequenceRow } from "./sequencertypes";
import { Button } from "../ui/button";
import Clock from "@/components/sequencer/clock";
import { ClockContext } from "./clockcontext";

import LedStrip from "./ledstrip";
import { StepPatternSaves } from "@/saves/steppatternsaves";

export default function SequencerSteps({
  numSequences,
  sequences,
  pattern,
  updatePad,
  drumTypes,
  numRows,
  numSteps,
  players,
  setPlayers,
  setKeyPads,
  setMixerVolumes,
  setDrumTypes,
  bpm,
  playMode,
  actionButtonHandler,
  _currentStep,
  isPlaying,
  handleStepVolumeChanged,
  stepPatternSaves

}: {
  numSequences: number;
  sequences: SequenceGroup[];
  pattern: number;
  updatePad: any;
  drumTypes: string[];
  numRows: number;
  numSteps: number;
  players: Tone.Player[];
  setPlayers: any;
  setKeyPads: any;
  setMixerVolumes: any;
  setDrumTypes: any;
  bpm: number;
  playMode: number;
  actionButtonHandler: any;
  _currentStep: number;
  isPlaying: boolean;
  handleStepVolumeChanged: any;
  stepPatternSaves:StepPatternSaves
}) {
  const [currentPattern, setCurrentPattern] = useState<number>(pattern);
  const {
    currentStep,
    setCurrentStep,
    sequencePattern,
    handleStepChanged,
    setHandleStepChanged,
    step,
  }: {
    currentStep: number;
    setCurrentStep: any;
    sequencePattern: any;
    handleStepChanged: any;
    step: number;
    setHandleStepChanged: any;
  } = React.useContext(ClockContext);
  // const handleStepChange = (step: number) => {
  //   console.log("step changed", step);
  // };
  useEffect(() => {
    const stepChanged: any = (step: number) => {
      console.log("step changed.....", step);
    };
  }, []);

  const KeyPad = ({
    rowNum,
    stepNum,
    roll,
    selected,
    onPadClicked,
    selectedColor = "bg-indigo-300",
    isPlaying,
    handleStepChanged,
    localVolume = 100,
    handleLocalVolumeChanged = (
      rowNum: number,
      stepNum: number,
      value: number
    ) => {
      console.log("local volume changed", rowNum, stepNum, value);
    },
  }: Step) => {
    const [isActive, setIsActive] = useState(selected);
    const [rollActive, setRollActive] = useState(roll);
    const [currentVolume, setCurrentVolume] = useState(localVolume);
    const volumeMax = 106;
    const volMin = 85;
    let _vol = 80;
    const updateThisPad = () => {
      setIsActive(!isActive);
      onPadClicked(rowNum, stepNum, "selected");
      setCurrentVolume(100);
      handleLocalVolumeChanged(rowNum, stepNum, 100);
      selected = !selected;
    };
    const handleRollClicked = (e: any) => {
      //e.preventDefault();
      console.log("Roll selected...", e);
      if (!isActive) {
        return;
      }
      setRollActive(!rollActive);
      onPadClicked(rowNum, stepNum, "roll");
      roll = !roll;
    };
    const handleVolumeUp = () => {
      if (currentVolume < volumeMax) {
        setCurrentVolume(currentVolume + 3);
        _vol = currentVolume + 3;
        handleLocalVolumeChanged(rowNum, stepNum, currentVolume + 3);
      }
    };
    const handleVolumeDown = () => {
      if (currentVolume > volMin) {
        setCurrentVolume(currentVolume - 3);
        _vol = currentVolume - 3;
        handleLocalVolumeChanged(rowNum, stepNum, currentVolume - 3);
      }
    };
    const setTailWindVolume = (volume: number) => {
      switch (volume) {
        case 106:
          return "h-[100%]";
          break;
        case 103:
          return "h-[90%]";
          break;
        case 100:
          return "h-[80%]";
          break;
        case 97:
          return "h-[70%]";
          break;
        case 94:
          return "h-[60%]";
          break;
        case 91:
          return "h-[50%]";
          break;
        case 88:
          return "h-[40%]";
          break;
        case 85:
          return "h-[35%]";
          break;
        case 82:
          return "h-[30%]";
          break;
        case 79:
          return "h-[25%]";
          break;
        case 77:
          return "h-[10px]";
          break;
        case 74:
          return "h-[1px]";

        default:
          return "h-[1px]";
          break;
      }
    };
    return (
      <div>
        <div
          className={cn(
            `relative flex items-center justify-center w-6 h-20 md:w-12 md:p-2 mx-1 text-white border-[1px] border-pink-300 rounded-xl md:hover:bg-lime-500/20 hover:border-lime-400 hover:border-2 hover:scale-y-110 cursor-pointer `,
            isActive && selectedColor,
            rollActive && isActive && "border-4"
          )}
        >
          {isActive && <div className="absolute top-0">+</div>}
          {/* TOP BUTTON */}
          {isActive && (
            <div
              className="absolute top-0 left-0 rounded-t-xl w-full flex justify-center items-center h-[30%] bg-black/10 hover:bg-red-500/40"
              onClick={handleVolumeUp}
            >
              {/* <div className="absolute w-6 md:w-12 h-full"></div> */}
            </div>
          )}
          {/* CENTER-SELECT-AREA */}
          <div
            className={cn(
              `absolute flex items-center justify-center w-5 ${
                isActive ? "h-[40%]" : "h-[100%]"
              } md:w-12 md:p-2 mx-1 text-white border-[1px]? z-[20] border-lime-300 rounded-none md:hover:bg-lime-800? cursor-pointer `
              // isActive && selectedColor,
              // rollActive && "border-4"
            )}
            onClick={updateThisPad}
          ></div>
          {/* VOLUME-BAR VISUAL ELEMENT*/}
          {isActive && (
            <div
              className={cn(
                `absolute bottom-0 w-6 ${setTailWindVolume(
                  currentVolume
                )} md:w-10 md:p-2 mx-1 -z-[10]? rounded-b-xl bg-white/10 border-t-2 border-lime-400/40 `
              )}
            ></div>
          )}
          {/* BOTTOM BUTTON */}
          {isActive && <div className="absolute bottom-0 -z-[10]?">-</div>}
          {isActive && (
            <div
              className="absolute bottom-0 left-0 rounded-b-xl w-full flex justify-center items-center h-[30%] bg-black/10 hover:bg-red-500/40"
              onClick={handleVolumeDown}
            >
              {/* <div className="absolute bottom-0 w-6 md:w-12 h-20px"></div>
            <div  className="absolute">-</div> */}
            </div>
          )}
          <span>{stepNum + 1}</span>
        </div>
        <div
          title="roll"
          className={` my-3 flex  items-center justify-center cursor-crosshair md:hover:bg-lime-400/40 text-center bg-black/30 rounded-xl h-6 text-white/20 ${
            isActive ? "text-white/70" : "text-white/10"
          } ${
            rollActive && isActive
              ? getDrumColor(drumTypes[rowNum])
              : "bg-black/30"
          }`}
          //  className={` my-3 flex  items-center justify-center cursor-crosshair md:hover:bg-lime-400/40 text-center bg-black/30 rounded-xl h-6 text-white/20 ${isActive && !rollActive ?  'bg-lime-400/10 text-white/30 opacity-50' : 'bg-black/30 text-white/20 opacity-30'} ${isActive &&rollActive ? 'bg-lime-indigo/80 text-white opacity-100' : 'bg-black/30 text-white/20 opacity-0?'}`}
          onClick={handleRollClicked}
        >
          roll
        </div>
      </div>
    );
  };
  //console.log("currentBPM", bpm);
  //console.log("currentPattern", pattern);
  
  const renderSequencerSteps = async () => {
    //console.log("rendering sequencer steps for pattern - ", pattern);
    console.log("sequences length", sequences.length);
    //if(sequences.length === 0) return <></>
    if (sequences.length > 0 && sequences[0].length > 0) {
      //console.log("sequences set", sequences);
      //console.log("pattern", pattern);
      //console.log('currentPattern', currentPattern)
      const new_Sequences = sequences;
      setKeyPads(new_Sequences);
      return;
    }
    //const renderActionButtons = () => {};

    const new_sequences = Array(numSequences).fill(0);
    const rows: SequenceRow[] = Array(numRows).fill(0);
    const steps: SequenceRow = Array(numSteps).fill(0);
    const curSequenceArray = new_sequences.map((sequence, sequenceNum) => {
      return rows.map((row, rowNum) => {
        return steps.map((step, stepNum) => {
          return {
            rowNum,
            stepNum,
            roll: false,
            selected: false,
            localVolume: 100,
          };
        });
      });
    });
    const _players = rows.map((row, rowNum) => {
      return new Tone.Player().toDestination();
    });
    const _volumes = rows.map((row, rowNum) => {
      return 0;
    });
    const _drumTypes = rows.map((row, rowNum) => {
      return "none";
    });

    setKeyPads(curSequenceArray);
    setPlayers(_players);
    setMixerVolumes(_volumes);
    setDrumTypes(_drumTypes);

    //console.log("new sequences", curSequenceArray);
  };
  const loadStepPatternSavesArray = (drumType:string) => {
    return stepPatternSaves.filter((stepPatternSave) => {
      return stepPatternSave.drumType === drumType
    })
  }
  
  
  useEffect(() => {
    renderSequencerSteps();
    //sequencePattern();
  }, [pattern, currentPattern, bpm, playMode, renderSequencerSteps]);

  const getRowActionsPanel = (rowNum:number) => {
    const rowActions = [
      { name: "clear" },
      { name: "copy" },
      { name: "paste" },
      { name: "fill", variations: ["sty1", "sty2", "sty3", "sty4", "sty5"] },
  
      { name: "step1" },
      { name: "step2" },
      { name: "step4" },
      { name: "step8" },
      { name: "save"},
      { name: drumTypes[rowNum] + "-" + '0', variations: loadStepPatternSavesArray(drumTypes[rowNum]).map((stepPatternSave, indexD) => {
        //console.log("stepPatternSave", stepPatternSave, indexD)
        //if(indexD > 0) {
          return drumTypes[rowNum] + "-" + (indexD + 1)
       //}
      })
        
      },
    ];
    return rowActions;
  }
  return (
    // <Clock
    //   isPlaying={isPlaying}
    //   numSteps={numSteps}
    //   players={players}
    //   pattern={pattern}
    //   sequences={sequences}
    //   handleStepChanged={handleStepChange}
    // >
    <div>
      <div className="flex rounded-xl flex-col p-3 bg-gradient-to-r from-violet-800/10 via-indigo-700/10 to-purple-500/10 min-w-full w-fit ">
        {sequences[0]! &&
          sequences[pattern].map((row, index: number) => {
            return (
              <div
                key={`row-${index}`}
                className="flex flex-col justify-center items-center"
              >
                {drumTypes[index]} {`Pattern ${pattern + 1}`}
                <div>
                  <div className="relative">
                    <div
                      key={`row-${index}`}
                      className={`absolute flex flex-wrap? md:flex-nowrap items-center justify-center z-40 opacity-80 mx-auto md:flex-row m-4 `}
                    >
                      {row.map((keypad, stepNum: number) => {
                        return (
                          <>
                            {/* <div>{keypad.selected ? "selected" : "not selected"}</div> */}
                            <KeyPad
                              key={`step-${stepNum}`}
                              {...keypad}
                              onPadClicked={updatePad}
                              selected={keypad.selected}
                              selectedColor={getDrumColor(drumTypes[index])}
                              roll={keypad.roll}
                              currentStep={-1}
                              //isPlaying={stepNum === step}
                              isPlaying={false}
                              handleLocalVolumeChanged={handleStepVolumeChanged}
                            />
                          </>
                        );
                      })}
                    </div>
                    <div className="-z-0">
                      <LedStrip
                        start={isPlaying}
                        numSteps={numSteps}
                        isBacklitBar={true}
                        bgColorTW={getDrumColor(drumTypes[index])}
                      />
                    </div>
                  </div>
                  <div className="w-full flex justify-around gap-2 p-1  items-center bg-black/50 h-8 rounded-xl mt-8">
                    {getRowActionsPanel(index).map((action) => {
                      return (
                        <ActionButton
                          key={`action-${action.name}`}
                          actionName={action.name}
                          variations={action.variations}
                          currentRow={index}
                          actionButtonHandler={actionButtonHandler}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </div>
    // </Clock>
  );
}

const ActionButton = ({
  actionName,
  variations,
  currentRow,
  actionButtonHandler,
}: {
  actionName: string;
  variations?: string[];
  currentRow: number;
  actionButtonHandler: any;
}) => {
  //console.log("action button variations = ", variations)
  const [currentVariation, setCurrentVariation] = useState<string>(actionName);
  
  const handleVariationChange = (variation: string) => {
    console.log("action button variation = ", variation)
  
    
    const nextVariation = variations![variations!.indexOf(currentVariation)! + 1] || actionName;
    console.log("next variation", nextVariation)

    

    setCurrentVariation(nextVariation);
    actionButtonHandler(currentVariation, currentRow);
    console.log("variation changed", variation, nextVariation)
  }
  return variations !== undefined ? (
    <Button
      className="w-14 border-[1px] border-black h-full shadow-sm bg-black/20 text-violet-300/30 rounded-lg hover:text-white"
      onClick={() => handleVariationChange(currentVariation)}
    >
      <span className={``}>{currentVariation.replace('-','')}</span>
    </Button>
  ) : (
    <Button
      className="w-14 border-[1px] border-black h-full shadow-sm bg-black/20 text-violet-300/30 rounded-lg hover:text-white"
      onClick={() => actionButtonHandler(actionName, currentRow)}
    >
      <span className={``}>{actionName}</span>
    </Button>
  );
};