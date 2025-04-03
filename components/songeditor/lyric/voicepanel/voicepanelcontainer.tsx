import React, { useEffect, useState } from "react";
import SequencerSteps from "@/src/lib/voices/audio/sequencer/sequencersteps";

import { Sample } from "@/src/lib/voices/audio/audiotypes";

//import { SavedSequence } from "@/lib/voices/audio/saves/sequencegroupsaves";
import { getDateAsIDString } from "@/src/lib/voices/audio/audioutils";
import * as Tone from "tone";
import { ClockContext } from "@/src/lib/voices/audio/sequencer/clockcontext";
import useSmoothHorizontalScroll from "use-smooth-horizontal-scroll";
import * as SampleTypes from "@/src/lib/voices/audio/audiotypes";
import { useKitzContext } from "@/src/lib/voices/audio/kitzcontext";
import { DrumKit } from "@/src/lib/voices/audio/saves/kitsaves";
import { useGlobalStore } from "@/src/lib/store/GloabalStoreState";
import LedStrip from "@/src/lib/voices/audio/sequencer/ledstrip";
import { StepPatternSaves } from "@/src/lib/voices/audio/saves/steppatternsaves";
import {
  SampleID,
  SequenceRow,
  Song,
  Step,
} from "@/src/lib/voices/audio/sequencer/sequencertypes";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

import {
  AudioWaveformIcon,
  MicIcon,
  PlayCircleIcon,
  PlusIcon,
  SaveIcon,
  StopCircle,
  WavesIcon,
} from "lucide-react";
import { useActions } from "ai/rsc";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  VOICES_checkIfVoiceObjectExists,
  VOICES_getVoiceObject,
  VOICES_getVoiceSliceIndexes,
  VOICES_storeVoiceSliceIndexes,
  VOICES_updateVoiceObject,
} from "@/src/lib/voices/voices-db";
import { VoiceLineObject } from "@/src/lib/types";
import { SpeakerLoudIcon } from "@radix-ui/react-icons";
import { useToast } from "@/components/ui/use-toast";
import { SavedSequence } from "@/src/lib/voices/audio/saves/sequencegroupsaves";

export default function VoicePanelContainer({
  lineText,
}: {
  lineText: string;
}) {
  const { toast } = useToast();

  const [voiceUrls, setVoiceUrls] = useState<string[]>([]);

  const [voiceObject, setVoiceObject] = useState<VoiceLineObject>();

  const [globalContext, setGlobalContext] = useState<Tone.Context>();

  const [sliceIndexes, setSliceIndexes] = useState<number[][]>([]);

  const [currentVoiceSample, setCurrentVoiceSample] = useState<Tone.Player>();

  const [sliceIndexesSaved, setSliceIndexesSaved] = useState<boolean>(true);

  const [savedSequences, setSavedSequences] = useState<SavedSequence[]>([]);
  const [numSequences, setNumSequences] = useState<number>(2);
  const [mixerVolumes, setMixerVolumes] = useState<number[]>([]);
  const [wordSamples, setWordSamples] = useState<Tone.Player[]>([]);
  const [drumTypes, setDrumTypes] = useState<string[]>([]);
  const [currentBPM, setCurrentBPM] = useState<number>(100);
  const [currentSequence, setCurrentSequence] = useState<number>(0);
  const [nextSequence, setNextSequence] = useState<number>(-1);
  const [patternPlay, setPatternPlay] = useState<number>(1); //all, single, random;
  const [stepPatternSaves, setStepPatternSaves] = useState<StepPatternSaves>(
    []
  );
  const [songName, setSongName] = useState<string>(
    `Untitled-${getDateAsIDString()}`
  );
  const [copiedRow, setCopiedRow] = useState<SequenceRow>([]);
  const [samplesToLoadOnCreate, setSamplesToLoadOnCreate] = useState<any>([]);
  const [pageLoading, setPageLoading] = useState<boolean>(false);
  const [scroll, setScroll] = useState<boolean>(false);
  const {
    currentStep,
    setCurrentStep,
    sequenceContextPattern,
    numRows,
    numSteps,
    players,
    sequences,
    setNumRows,
    setNumSteps,
    setPlayers,
    setSequences,
    isPlaying,
    setIsPlaying,
    sampleIDs,
    setSampleIDs,
  }: {
    currentStep: number;
    setCurrentStep: any;
    sequenceContextPattern: any;
    sequences: Song[];
    setSequences: any;
    players: Tone.Player[];
    setPlayers: any;
    numSteps: number;
    setNumSteps: any;
    numRows: number;
    setNumRows: any;
    isPlaying: boolean;
    setIsPlaying: any;
    sampleIDs: { id: string; index: number }[];
    setSampleIDs: any;
  } = React.useContext(ClockContext);
  const { scrollContainerRef, handleScroll, scrollTo, isAtStart, isAtEnd } =
    useSmoothHorizontalScroll();
  const {
    soundList,

    currentKit,
  }: { soundList: SampleTypes.SoundListProps; currentKit: DrumKit } =
    useKitzContext();
  const { appState, setAppState, globalMessages, setGlobalMessages } =
    useGlobalStore();

  const { VOICES_extractTextAndCreateVoice, VOICES_getAllVoicesForLine } =
    useActions();

  const _LocalStorageKitsFileName = "Kitz-Saved-Kits";
  let index1 = 0;
  let step = 0;
  let pattern = 0;
  let isLive = false;
  let mode = 0;
  let currentStepToSliceIteration = -1;
  //let isPlaying = false;

  const startUpDrums = [
    { type: SampleTypes.Drum.kick, id: "" },
    { type: SampleTypes.Drum.snare, id: "" },

    { type: SampleTypes.Drum.clap, id: "" },
    { type: SampleTypes.Drum.chat, id: "" },
  ];
  // const getStartupDrumsByIdOrRandom = () => {
  //   console.log("getStartupDrumByIdOrRandom", sampleIDs);
  //   if (soundList.items.length === 0) {
  //     console.log("no samples");
  //     return [""];
  //   }
  //   //return ""
  //   const result: string[][] = [];

  //   for (let t = 0; t < startUpDrums.length; t++) {
  //     const _drumType = startUpDrums[t].type;
  //     console.log("found drumType", _drumType);

  //     const randomSamples = soundList.items.filter((sample) => {
  //       return sample.drum === _drumType;
  //     });
  //     //now get 5 random samples for this drumtype
  //     const multiplesArray = [];
  //     for (let s = 0; s < 3; s++) {
  //       const randomIndex = Math.floor(Math.random() * randomSamples.length);
  //       multiplesArray.push(randomSamples[randomIndex]!.id);
  //     }

  //     result.push(multiplesArray);
  //     // setSampleIDs(multiplesArray)
  //     // console.log('multiplesArray', multiplesArray)
  //     // console.log('multiples-sampleIDs', sampleIDs)
  //   }
  //   setSamplesToLoadOnCreate(result);
  //   return result;
  // };

  const saveCurrentSequences = async () => {
    console.log("saveCurrentSequences");
    if (!appState.currentUser) {
      return;
    }
    let id = getDateAsIDString();
    let newName: string = songName;
    if (songName.includes("Untitled")) {
      newName = prompt("Name of track?", songName) || songName;
    }

    const check = savedSequences.find((seq) => seq.name === songName);
    if (check) {
      console.log("saveCurrentSequences savedSequences =>", savedSequences);
      const confirm = window.confirm(
        "A sequence with this name already exists. Overwrite?"
      );
      if (!confirm) {
        return;
      } else {
        id = check.id;
      }
    }
    console.log("saveCurrentSequences newID => ", id);
    //return;
    setPageLoading(true);

    const _sequences = sequences;
    const _samples = sampleIDs;
    const _volumes = mixerVolumes;
    const _drumTypes = drumTypes;
    const _numRows = numRows;
    const _numSteps = numSteps;
    const _currentSequence = currentSequence;
    const _currentBPM = currentBPM;
    const _patternPlay = patternPlay;
    const _samplesToLoadOnCreate = samplesToLoadOnCreate;

    const _kitz: SavedSequence = {
      name: newName,
      id: id,
      userID: appState.currentUser.id,
      tempo: currentBPM,
      sequences: _sequences,
      samples: _samples,
      volumes: _volumes,
      drumTypes: _drumTypes,
      numRows: _numRows,
      numSteps: _numSteps,
      currentSequence: _currentSequence,
      currentBPM: _currentBPM,
      patternPlay: _patternPlay,
      samplesToLoadOnCreate: _samplesToLoadOnCreate,
    };

    //check samples!!
    console.log("savedSequences => ", _kitz);

    // const saved = await storeKitLabSequencesToDB(_kitz);
    // const checkIfExists = savedSequences.find((seq) => seq.id === id);
    // if (!checkIfExists) {
    //   setSavedSequences([...savedSequences, _kitz]);
    // } else {
    //   setSavedSequences((prev) => {
    //     return prev.map((seq) => {
    //       if (seq.id === id) {
    //         return _kitz;
    //       }
    //       return seq;
    //     });
    //   });
    // }

    //localStorage.setItem(`KitzSeqSam`, JSON.stringify(_kitz));
    // console.log("saveCurrentSequences saved => ", saved);
    // window.alert(`Saved ${newName}!`);
    // setSongName(newName);
    // setPageLoading(false);
  };
  // const loadSequencesFromDB = async () => {
  //   console.log("loadSequencesFromDB");
  //   if (!appState.currentUser) {
  //     return;
  //   }
  //   const _sequences = await getKitLabSequences(appState.currentUser.appState.currentUserId);
  //   if (_sequences && _sequences.length > 0) {
  //     setSavedSequences(_sequences);
  //   }
  //   console.log("loadSequencesFromDB => ", _sequences);
  // };
  // const loadSequence = async (id: string) => {
  //   console.log("loadSequence", id);
  //   //console.log("loadSequence sampleID's => ",sampleIDs)

  //   const _seq: savedSequences =
  //     savedSequences.find((seq) => seq.id === id) || ({} as savedSequences);
  //   console.log("loadSequence _seq => ", _seq);

  //   //return;
  //   try {
  //     //const _seq = _curSequences?.data
  //     // const _seq = JSON.parse(String(_curSequences!.data));
  //     console.log("loadSequence _seq => ", _seq?.sequences);

  //     if (_seq) {
  //       setPageLoading(true);

  //       setNumRows(_seq!.numRows);
  //       setNumSteps(_seq!.numSteps);
  //       setCurrentBPM(_seq!.tempo);

  //       setSampleIDs(_seq!.samples);
  //       setMixerVolumes(_seq!.volumes);
  //       setDrumTypes(_seq!.drumTypes);
  //       setCurrentSequence(_seq.currentSequence);
  //       setPatternPlay(_seq.patternPlay);
  //       setSamplesToLoadOnCreate(_seq.samplesToLoadOnCreate);
  //       setCurrentSequence(_seq.currentSequence);
  //       setSongName(_seq!.name);

  //       const _players: Tone.Player[] = [];
  //       const _currentSamples: Sample[] = [];
  //       for (let i = 0; i < _seq.numRows; i++) {
  //         const _sample = _seq.samples[i];
  //         const player = new Tone.Player().toDestination();
  //         _players.push(player);
  //         _currentSamples.push(
  //           soundList.items.find((item: Sample) => item.id === _sample.id) ||
  //             soundList.items[0]!
  //         );
  //       }

  //       setCurrentVoiceSample(_currentSamples);
  //       setSequences(_seq.sequences);
  //       setPlayers(_players);

  //       setPageLoading(false);
  //       console.log("loadSequence complete");
  //       console.log("loadSequence _seq = ", _seq);
  //       console.log("loadSequence _currentSamples = ", _currentSamples);
  //       console.log("loadSequence _players = ", _players);
  //       console.log("loadSequence _seq = ", _seq);
  //     }
  //   } catch (error) {
  //     console.log("loadSequence error", error);
  //     return;
  //   }
  // };
  // const deleteSequence = async (id: string) => {
  //   console.log("deleteSequence", id);
  //   const confirm = window.confirm(
  //     "Are you sure you want to delete this sequence?"
  //   );
  //   if (!confirm) {
  //     return;
  //   }
  //   setPageLoading(true);
  //   const deleted = await deleteKitLabSequence(id);
  //   const _seqs = savedSequences.filter((seq) => seq.id !== id);
  //   setSavedSequences(_seqs);
  //   setPageLoading(false);
  //   console.log("deleteSequence deleted => ", deleted);
  //   window.alert("Sequence Deleted!");
  // };
  // const reRandomizePlayers = async () => {
  //   stop();
  //   setPageLoading(true);
  //   console.log("re-randomizing players...");
  //   // setSamplesToLoadOnCreate([])
  //   // setPlayers([])
  //   // return;

  //   const _players = [...players];
  //   for (let i = 0; i < players.length; i++) {
  //     const drumType = drumTypes[i];
  //     const filteredSamples = soundList.items.filter((sample: Sample) => {
  //       return sample.drum === drumType;
  //     });
  //     const randomIndex = Math.floor(Math.random() * filteredSamples.length);
  //     const randomSample = filteredSamples[randomIndex]!;

  //     await loadPlayer(_players[i], randomSample!);
  //   }
  //   setPlayers(_players);
  //   setPageLoading(false);
  //   console.log("players", _players);
  // };

  const updateSequences = (totalRows: number) => {
    console.log(
      "updateSequences",
      totalRows,
      sequences,
      currentSequence,
      numSteps,
      numRows,
      sequences[currentSequence]
    );
    //clear all sequences
    let newKeypads: Song[] = [];
    let _currentSequence = [];
    for (let i = 0; i < totalRows; i++) {
      const newSteps = Array(numSteps).fill(0);
      const newRow: Step[] = newSteps.map((step, stepNum) => {
        return {
          rowNum: i,
          stepNum,
          selected: false,
          roll: false,
          localVolume: 100,
        };
      });

      _currentSequence.push(newRow);
    }
    newKeypads.push(_currentSequence);
    //start with 2 sequences
    newKeypads.push(_currentSequence);

    setSequences(newKeypads);
    console.log("updateSequences - Sequences Complete!");
  };
  // const drumKitChanged = async (newKit: DrumKit) => {
  //   console.log("currentKit => drumKitChanged => newKit = ", newKit);
  //   const _players: Tone.Player[] = [];
  //   const _mixerVols: number[] = [];
  //   const _drumTypes: string[] = [];
  //   const _currentSamples: Sample[] = [];
  //   for (let i = 0; i < newKit.drumSamples.length; i++) {
  //     const _sample = newKit.drumSamples[i];
  //     const player = new Tone.Player().toDestination();
  //     _mixerVols.push(0);
  //     _drumTypes.push(_sample.drum || "any");
  //     _currentSamples.push(_sample);
  //     _players.push(player);
  //   }
  //   const _samplesToLoad: string[][] = [];
  //   const _sampleIDs: { id: string; index: number }[] = [];

  //   for (var i = 0; i < _currentSamples.length; i++) {
  //     _samplesToLoad.push([_currentSamples[i].id as string]);
  //     _sampleIDs.push({ index: i, id: _currentSamples[i].id as string });
  //   }

  //   setSamplesToLoadOnCreate(_samplesToLoad);

  //   setSampleIDs(_sampleIDs);

  //   updateSequences(newKit.drumSamples.length);

  //   setNumRows(newKit.drumSamples.length);

  //   setMixerVolumes(_mixerVols);

  //   setDrumTypes(_drumTypes);

  //   setCurrentVoiceSample(_currentSamples);

  //   setPlayers(_players);

  //   setPageLoading(false);
  //   console.log("players", _players);
  // };

  let timeOut: any;
  const afterTimeout = (message?: string, callBack?: any) => {
    if (message) {
      console.log(message);
    }
    if (callBack) {
      callBack();
    }
  };
  const loadPlayer = async (player: Tone.Player, url: string) => {
    setPageLoading(true);
    timeOut = setTimeout(() => {
      afterTimeout("load player timed out...");
    }, 10000);

    console.log("url", url);
    try {
      await player.load(url!);
    } catch (error) {
      console.log(error);
    }
    setPageLoading(false);
  };

  const updateNumRows = async (num: number) => {
    if (num < 1) {
      return;
    } else if (num > 12) {
      return;
    }

    let rowsToAdd = 0;
    let rowsToRemove = 0;
    let newKeypads = sequences;
    if (num > numRows) {
      for (let seqNum = 0; seqNum < sequences.length; seqNum++) {
        rowsToAdd = num - numRows;
        //create new rows and add to all sequences

        for (let i = 0; i < rowsToAdd; i++) {
          const newSteps = Array(numSteps).fill(0);
          const newRow = newSteps.map((step, stepNum) => {
            return {
              rowNum: numRows + i,
              stepNum,
              selected: false,
              roll: false,
            };
          });

          newKeypads[seqNum].push(newRow);
        }

        setSequences(newKeypads);

        const newPlayers = players;
        newPlayers.push(new Tone.Player().toDestination());
        setPlayers(newPlayers);

        const newMixerVolumes = mixerVolumes;
        newMixerVolumes.push(0);
        setMixerVolumes(newMixerVolumes);

        const newDrumTypes = drumTypes;
        newDrumTypes.push("none");
        setDrumTypes(newDrumTypes);

        const newSamples = currentVoiceSample;
        //newSamples!.push({} as Sample);
        setCurrentVoiceSample(newSamples);
      }
    }
    if (num < numRows) {
      rowsToRemove = numRows - num;
      const pads = sequences;
      const tempPlayers = players;
      for (let i = 0; i < rowsToRemove; i++) {
        pads.pop();
        tempPlayers.pop();
      }
      setSequences(sequences);
      setPlayers(tempPlayers);
    }

    setNumRows(num);
  };

  const updateNumSteps = async (num: number) => {
    if (num < 1) {
      return;
    } else if (num > 32) {
      return;
    }
    setNumSteps(num);
    //await renderSteps(numRows, num);
  };

  const updatePad = (rowNum: number, stepNum: number, action: string) => {
    console.log("update pad called...", currentSequence, rowNum, stepNum);
    //console.log(keypads);
    const pad = sequences[currentSequence][rowNum][stepNum];
    if (action === "selected") {
      pad.selected = !pad.selected;
    }
    if (action === "roll") {
      pad.roll = !pad.roll;
    }

    const row = sequences[currentSequence][rowNum];
    row[stepNum] = pad;
    sequences[currentSequence][rowNum] = row;
    setSequences(sequences);
    //console.log(pad);
  };
  async function sequencePattern() {
    index1 = 0;

    Tone.getTransport().scheduleRepeat(repeat, `${numSteps}n`);
    Tone.getTransport().start();
  }
  const tempoChanged = (bpm: number) => {
    console.log("tempoChanged", bpm);
    if (!Tone.getTransport().bpm) {
      return;
    }
    Tone.getTransport().bpm.value = Math.floor(bpm);
    setCurrentBPM(Math.floor(bpm));
  };
  const setPlayMode = async () => {
    if (true) {
      await stop();
    }

    mode = patternPlay + 1;
    if (mode > 1) {
      mode = 0;
    }
    console.log("setPlayMode", mode);
    setPatternPlay(mode);
    //await new Promise((resolve) => setTimeout(resolve, 1000));
    //await play();
  };
  const handleSequenceSelected = (e: any, index: number) => {
    setNextSequence(-1);
    console.log("handleSequenceSelected", index);
    if (!isPlaying && mode === 0) {
      setCurrentSequence(index);
    } else {
      // setNextSequence(index);
      pattern = index - 1;
    }
    // if(isPlaying && mode === 0){
    //   setNextSequence(index);
    //   pattern = index - 1;
    // }
    // if(isPlaying && mode === 1){
    //   setNextSequence(index);
    //   pattern = index;
    // }
  };

  const handlePatternRowAction = async (actionName: string, row: number) => {
    console.log("handlePatternRowAction", actionName, row);

    let updatedSteps: SequenceRow = [];
    switch (actionName) {
      case "clear":
        updatedSteps = sequences[currentSequence][row].map(
          (step: Step, index: number) => {
            return {
              ...step,
              selected: false,
              roll: false,
            };
          }
        );
        break;
      case "copy":
        setCopiedRow(sequences[currentSequence][row]);
        break;
      case "paste":
        updatedSteps = copiedRow.map((step: Step, index: number) => {
          return {
            ...step,
            rowNum: step.rowNum,
            stepNum: step.stepNum,
            selected: false,
            roll: false,
          };
        });

        break;
      case "fill":
        updatedSteps = sequences[currentSequence][row].map(
          (step: Step, index: number) => {
            return {
              ...step,
              rowNum: step.rowNum,
              stepNum: step.stepNum,
              selected: true,
              roll: false,
              localVolume: index % 2 === 0 ? 100 : 91,
            };
          }
        );
        break;
      case "sty1":
        updatedSteps = sequences[currentSequence][row].map(
          (step: Step, index: number) => {
            return {
              ...step,
              rowNum: step.rowNum,
              stepNum: step.stepNum,
              selected: true,
              roll: false,
              localVolume: index % 4 === 0 ? 100 : 91,
            };
          }
        );
        break;
      case "sty2":
        const volVals2 = [103, 100, 97, 94, 91, 88];
        updatedSteps = sequences[currentSequence][row].map(
          (step: Step, index: number) => {
            return {
              ...step,
              rowNum: step.rowNum,
              stepNum: step.stepNum,
              selected: true,
              roll: false,
              localVolume: volVals2[index % 6],
            };
          }
        );
        break;
      case "sty3":
        const volVals3 = [103, 100, 91];
        updatedSteps = sequences[currentSequence][row].map(
          (step: Step, index: number) => {
            return {
              ...step,
              rowNum: step.rowNum,
              stepNum: step.stepNum,
              selected: true,
              roll: false,
              localVolume: volVals3[index % 3],
            };
          }
        );
        break;
      case "sty4":
        const volVals4 = [103, 100, 97, 94, 91];
        updatedSteps = sequences[currentSequence][row].map(
          (step: Step, index: number) => {
            return {
              ...step,
              rowNum: step.rowNum,
              stepNum: step.stepNum,
              selected: true,
              roll: false,
              localVolume: volVals4[(Math.random() * volVals4.length - 1) | 0],
            };
          }
        );
        break;
      case "sty5":
        const volVals5 = [103, 100, 97, 94, 91, 88, 85, 82, 79];
        updatedSteps = sequences[currentSequence][row].map(
          (step: Step, index: number) => {
            return {
              ...step,
              rowNum: step.rowNum,
              stepNum: step.stepNum,
              selected: true,
              roll: false,
              localVolume:
                index % 2 === 0
                  ? 100
                  : volVals5[(Math.random() * volVals5.length - 1) | 0],
            };
          }
        );
        break;
      case "step1":
        updatedSteps = sequences[currentSequence][row].map(
          (step: Step, index: number) => {
            return {
              ...step,
              rowNum: step.rowNum,
              stepNum: step.stepNum,
              selected: true,
              roll: false,
              localVolume: 100,
            };
          }
        );
        break;
      case "step2":
        updatedSteps = sequences[currentSequence][row].map(
          (step: Step, index: number) => {
            return {
              ...step,
              rowNum: step.rowNum,
              stepNum: step.stepNum,
              selected: index % 2 === 0 ? true : false,
              roll: false,
            };
          }
        );
        break;
      case "step4":
        updatedSteps = sequences[currentSequence][row].map(
          (step: Step, index: number) => {
            return {
              ...step,
              rowNum: step.rowNum,
              stepNum: step.stepNum,
              selected: index % 4 === 0 ? true : false,
              roll: false,
            };
          }
        );
        break;
      case "step8":
        updatedSteps = sequences[currentSequence][row].map(
          (step: Step, index: number) => {
            return {
              ...step,
              rowNum: step.rowNum,
              stepNum: step.stepNum,
              selected: index % 8 === 0 ? true : false,
              roll: false,
            };
          }
        );
        break;
      case "save":
        const stepsToSave = sequences[currentSequence][row].map(
          (step: Step, index: number) => {
            return {
              ...step,
              selected: step.selected,
              roll: step.roll,
              rowNum: -1,
            };
          }
        );
        // const saved = await saveStepPatternToDynamo(
        //   stepsToSave,
        //   drumTypes[row],
        //   currentUser.id
        // );

        // const newSteps: StepPatternSave = {
        //   drumType: drumTypes[row],
        //   id: "",
        //   global: true,
        //   stepPattern: stepsToSave,
        //   appState.currentUserID: currentUser.id,
        // };
        // setStepPatternSaves([...stepPatternSaves, newSteps]);
        // updatedSteps = newSteps.stepPattern;
        // console.log("saved", newSteps);
        return;
      case "load":
        updatedSteps = sequences[currentSequence][row].map(
          (step: Step, index: number) => {
            return {
              ...step,
              rowNum: step.rowNum,
              stepNum: step.stepNum,
              selected: index % 8 === 0 ? true : false,
              roll: false,
            };
          }
        );
        return;
        break;
      default:
        //Extract drum type and filter step pattern saves and set using the index
        const drumNames = Object.keys(SampleTypes.Drum);
        const _drumType = actionName.split("-")[0];
        console.log("drumType", _drumType, Number(actionName.split("-")[1]));

        try {
          if (drumNames.includes(_drumType)) {
            const _pattern = stepPatternSaves.filter((pattern) => {
              return pattern.drumType === _drumType;
            })[Number(actionName.split("-")[1])];
            console.log("_pattern", _pattern);
            if (!_pattern) {
              return;
            }

            const _steps: string = String(_pattern.stepPattern);
            const parsedSteps: Step[] = JSON.parse(_steps);
            if (parsedSteps.length === 0) {
              return;
            }
            console.log("parsedSteps", parsedSteps);

            updatedSteps = parsedSteps.map((step: Step, index: number) => {
              return {
                ...step,
                rowNum: row,
              };
            });
          }
        } catch (error) {
          console.log(error);
          return;
        }
        //return;
        break;
    }
    // const updatedSequences = sequences;
    // const updatedSequence = sequences[currentSequence];
    // updatedSequence[row] = updatedSteps;
    // updatedSequences[currentSequence] = updatedSequence;
    // setSequences(updatedSequences);
    const updatedSequences = [...sequences];
    updatedSequences[currentSequence][row] = [...updatedSteps];
    setSequences(updatedSequences);
  };
  const handleAddSequenceSelected = (e: any) => {
    const value = e.target.innerText;
    setNextSequence(-1);

    if (value === "+") {
      console.log("handleAddSequenceSelected", sequences);
      const newSequences = sequences;
      const refSequence = sequences[sequences.length - 1];
      const newSequence = refSequence.map((row, index: number) => {
        return row.map((step: any, index: number) => {
          return {
            ...step,
            rowNum: step.rowNum,
            stepNum: step.stepNum,
            selected: step.selected,
            roll: step.roll,
          };
        });
      });
      newSequences.push(newSequence);
      setSequences(newSequences);
      console.log("new sequences = ", newSequences);
      setNumSequences(newSequences.length);
      //setCurrentSequence(newSequences.length - 1);
    } else {
      //remove sequence
      console.log("handleRemoveSequenceSelected", sequences);
      if (sequences.length === 1) {
        return;
      }
      const newSequences = sequences.filter((sequence, index) => {
        return index !== currentSequence;
      });

      setSequences(newSequences);
      console.log("new sequences = ", newSequences);
      setNumSequences(newSequences.length);
      if (currentSequence > newSequences.length - 1) {
        setCurrentSequence(newSequences.length - 1);
      }
      //setCurrentSequence(newSequences.length - 1);
    }
  };
  const updateCurrentSequence = () => {
    //console.log("updateCurrentSequence", currentSequence, pattern);
    //console.log("isPlaying", isPlaying);
    //console.log("isLive", isLive);

    if (isLive && patternPlay === 0) {
      //all
      if (pattern < sequences.length - 1 && isLive) {
        pattern = pattern + 1;

        // if(pattern === sequences.length - 1  && currentSequence === sequences.length - 1){
        //   pattern = 0;

        // }

        if (nextSequence > -1 && nextSequence <= sequences.length - 1) {
          pattern = nextSequence;
        }

        setCurrentSequence(pattern);
        console.log(`set pattern to ${pattern}`);
      } else {
        if (pattern === sequences.length - 1 && isLive) {
          pattern = 0;
          setCurrentSequence(0);
          console.log(`set pattern to 0`);
        }
      }
    }
    if (isLive && patternPlay === 1) {
      //single/loop
      if (isLive) {
        pattern = currentSequence;
        if (nextSequence > -1 && nextSequence <= sequences.length - 1) {
          pattern = nextSequence;
        }
        setCurrentSequence(pattern);
        console.log(`looping pattern - ${pattern}`);
      }
    }

    return;
  };
  const updateStepVolume = (rowNum: number, stepNum: number, value: number) => {
    // console.log("updateStepVolume", rowNum, stepNum, value)
    // console.log("sequence values =>=>=> ",sequences[currentSequence])
    // console.log("sequence values =>=>=> ",sequences[currentSequence][rowNum])
    //console.log("sequence values =>=>=> ",sequences[currentSequence][rowNum][stepNum])
    const pad = sequences[currentSequence][rowNum][stepNum];
    // console.log("pad", pad);

    const updatedSequences = [...sequences];
    updatedSequences[currentSequence][rowNum][stepNum] = {
      ...pad,
      localVolume: value,
    };
    setSequences([...updatedSequences]);
    // console.log(
    //   "updatedPad",
    //   updatedSequences[currentSequence][rowNum][stepNum]
    // );
  };
  function repeat(time: any) {
    // console.log("Playing Sequence ", currentSequence)
    //console.log("keypads length", keypads )
    isLive = true;
    step = index1 % numSteps;

    //setCurrentStep(step);

    for (let row = 0; row < sequences[pattern].length; row++) {
      //let note = notes[row];
      console.log("Players_ ", players);

      let samplePlayer: Tone.Player = currentVoiceSample as Tone.Player;
      if (!samplePlayer) {
        return;
      }
      let pad: Step = sequences[pattern][row][step];
      //console.log("Repeater current pad is ==>", pad);
      //setCurrentStep(step);
      // console.log(
      //   `row ${row} step ${step} index ${index1} selected ${pad.selected} time ${time}`
      // );
      // console.log(pad);
      // console.log(time);
      // console.log(index);

      if (pad.selected) {
        console.log("PAD selected: ", pad, index1, step);

        //setCurrentStep(step);
        pad.isPlaying = true;
        //console.log("roll => ", pad.roll);
        //console.log(keypads[row][step]);
        console.log("SamplePlayerLoaded = ", samplePlayer.loaded);
        if (samplePlayer.loaded) {
          const _volume = (pad.localVolume || 100) - 100;
          const mainVolume = mixerVolumes[row];
          let finalVolume = Math.floor(_volume + mainVolume);
          if (finalVolume > 6) {
            finalVolume = 6;
          }

          console.log("finalVolume", finalVolume);
          console.log("mainVolume", mainVolume);
          console.log("_volume", _volume);
          //samplePlayer.volume.setValueAtTime(finalVolume, time);
          console.log("SliceIndexes: ", sliceIndexes);

          console.log("Step: ", step);
          console.log("index1: ", index1);

          // currentStepToSliceIteration = step == 0 ? 0 : step + 1;
          // if (currentStepToSliceIteration > sliceIndexes.length - 1) {
          //   currentStepToSliceIteration = 0;
          // }
          currentStepToSliceIteration =
            (currentStepToSliceIteration + 1) % sliceIndexes.length;

          console.log(
            "CurrentStepToSliceIteration: ",
            currentStepToSliceIteration
          );

          const sampleStart =
            (currentVoiceSample!.buffer.duration / 100) *
            sliceIndexes[currentStepToSliceIteration][0];

          const sampleEnd =
            (currentVoiceSample!.buffer.duration / 100) *
            sliceIndexes[currentStepToSliceIteration][1];

          samplePlayer.start(time, sampleStart, sampleEnd);

          if (pad.roll) {
            const subTick = Tone.getTransport().bpm.value / 60 / 4 / 8;
            //samplePlayer.start(time + subTick)
            try {
              for (let j = 1; j < 9; j++) {
                const subTime = time + subTick * j;
                samplePlayer.start(subTime);
              }
            } catch (error) {
              console.log(error);
            }
          }

          //console.log("samplePlayer", samplePlayer.volume.value
        }
      }
      if (pad.isPlaying) {
        pad.isPlaying = false;
        //setCurrentStep(currentStep + 1);
      }
    }

    index1 = index1 + 1;
    if (scroll) {
      scrollTo(step < Math.floor(numSteps / 1.1) ? step * 5 : -1000);
    } else {
    }
    // console.log("currentSequence", currentSequence)
    if (step === numSteps - 1) {
      //store the current sequence to state (memory) and update pattern for realtime change
      updateCurrentSequence();
      // console.log("currentSequence => ", pattern)
      // console.log(`Keypads =`,keypads)
    }

    // if(step === numSteps - 1){
    //   scrollTo(0)
    // }else{

    //   scrollTo(step *5)
    // }
  }
  async function stop() {
    //setCurrentSequence(pattern)
    await Tone.getTransport().stop();
    await Tone.getTransport().cancel();

    setIsPlaying(false);
    isLive = false;
    //setCurrentSequence(pattern);
    //setPatternPlay(mode)
  }
  async function play() {
    //  if(samples.length === 0) {return}
    //scrollTo(0)
    scrollTo(-1000);
    console.log(Tone.getTransport().state);
    if (Tone.getTransport().state === "stopped") {
      Tone.getContext().resume();
    } else {
      //Tone.start();
    }

    if (Tone.getTransport().state === "stopped") {
      setIsPlaying(true);
      Tone.getTransport().bpm.value = currentBPM;
      pattern = currentSequence;

      try {
        sequencePattern();
        sequenceContextPattern();
      } catch (error) {
        console.log("error playing sequence", error);
        Tone.getTransport().stop();
        Tone.getTransport().cancel();
      }

      //await sequencePattern();

      console.log("current pattern", pattern, currentSequence);
    } else {
      stop();
    }
    //pattern = currentSequence;
  }

  const setDrumType = (drum: string, index: number) => {
    console.log("setDrumType", drum, index);
    let _drumTypes = drumTypes;
    _drumTypes[index] = drum;
    setDrumTypes(_drumTypes);
    console.log("drumTypes", _drumTypes);
  };
  const setVolume = (_volume: number, index: number) => {
    const _volumes = mixerVolumes;
    //const newVolume = (100 - _volume) * -1;
    _volumes[index] = _volume;
    setMixerVolumes(_volumes);
    console.log("player vol = ", players[index].volume.value);
    players[index].volume.value = _volume;
    // console.log("volumes", _volume )
    // console.log("players", players)
  };
  //let __sampleIDs:any[] = []
  const setSampleID = (id: string, index: number) => {
    console.log("setSampleID", id, index, sampleIDs);

    setSampleIDs((_sampleIDs: SampleID[]) => {
      if (_sampleIDs.length === 0) {
        return [{ id, index }];
      } else {
        const sampleID = _sampleIDs.find((item) => item.index === index);
        if (sampleID) {
          return _sampleIDs.map((item) => {
            if (item.index === index) {
              return { id, index };
            } else {
              return item;
            }
          });
        }
      }
      return [..._sampleIDs, { id, index }];
    });
  };
  const getSampleID = (index: number) => {
    const sampleID = sampleIDs.find((item) => item.index === index);
    if (sampleID) {
      return sampleID.id;
    }
    return "";
  };

  // LOAD LAST SAVED VOICE LINE IF EXISTS
  useEffect(() => {
    const initializeVoiceIfExists = async () => {
      const exists = await VOICES_extractTextAndCreateVoice({
        text: lineText,
        checkOnly: true,
      });
      console.log("exists...", exists);
      if (exists) {
        console.log("exists", exists);
        const voiceUrl = await VOICES_extractTextAndCreateVoice({
          text: lineText,
          checkOnly: false,
          alwaysNewVoice: false,
        });
        console.log("voiceUrl", voiceUrl);
        const player = new Tone.Player(voiceUrl).toDestination();
        setCurrentVoiceSample(player);
      }
    };
    initializeVoiceIfExists();
  }, []);

  // LOAD VOICE URLS FOR CONTINUOUS MODE
  useEffect(() => {
    const loadVoiceUrls = async () => {
      let urls: string[] = await VOICES_getAllVoicesForLine(lineText);

      setVoiceUrls(urls);
    };
    loadVoiceUrls();
  }, [currentVoiceSample]);

  // LOAD VOICE OBJECT IF EXISTS
  useEffect(() => {
    const checkForExistingVOBJ = async () => {
      if (
        await VOICES_checkIfVoiceObjectExists(lineText, appState.currentUser.id)
      ) {
        console.log("voice object exists");
        const vobj = await VOICES_getVoiceObject(
          lineText,
          appState.currentUser.id
        );
        setVoiceObject(vobj);
      }
    };
    console.log("Checking for existing VOBJ", lineText);
    checkForExistingVOBJ();
  }, []);

  // LOAD SLICE INDEXES IF EXISTS
  useEffect(() => {
    const checkForExistingSlices = async () => {
      const indexes = await VOICES_getVoiceSliceIndexes(
        lineText,
        appState.currentUser.id
      );
      if (indexes) {
        console.log("slice indexes", indexes);
        setSliceIndexes(indexes.sliceIndexes as number[][]);
        setSequences(indexes.sequenceSteps);
        //
      }
      //return setSliceIndexesSaved(true);
    };
    checkForExistingSlices();
  }, []);

  // UPDATE SLICEINDEXSAVED WHEN SLICE INDEXES CHANGE
  useEffect(() => {
    if (sliceIndexes) {
      console.log("Setting slice indexes saved to false");
      setSliceIndexesSaved(false);
    }
  }, [sliceIndexes]);

  // useEffect(() => {
  //   //Always load samples using 'samplesToLoadOnCreate'
  //   //no need to load players in the page itself - use sampleLoader
  //   Tone.getTransport().bpm.value = currentBPM;

  //   const loadSequenceData = async () => {
  //     const _stepPatternSaves: StepPatternSaves =
  //       (await getAllStepPatternSaves()) as StepPatternSaves;
  //     if (_stepPatternSaves) {
  //       setStepPatternSaves(_stepPatternSaves || []);
  //     }
  //   };
  //   loadSequenceData();
  // }, [soundList.items]);

  //   useEffect(() => {
  //     console.log("currentKit", currentKit);
  //     if (!currentKit) {
  //       return;
  //     }
  //     const loadSavedKit = async () => {
  //       await drumKitChanged(currentKit);
  //     };
  //     loadSavedKit();
  //   }, [currentKit]);
  // useEffect(() => {
  //   console.log("saved sequences", savedSequences);
  //   if (!appState.currentUser) {
  //     return;
  //   }
  //   const loadSavedSequence = async () => {
  //     await loadSequencesFromDB();
  //   };
  //   loadSavedSequence();
  // }, [appState.currentUser]);
  //console.log("setSampleID", sampleIDs);
  //console.log("saved", stepPatternSaves);
  return (
    <div className="p-4">
      <Tabs defaultValue="continuous" className="w-full">
        <TabsList>
          <TabsTrigger value="continuous">Continuous</TabsTrigger>
          <TabsTrigger value="single">Single</TabsTrigger>
          <TabsTrigger value="sliced">Sliced</TabsTrigger>
        </TabsList>
        <TabsContent value="continuous">
          <div className="p-2 flex items-center z-50 justify-center gap-2">
            <Button
              variant={"outline"}
              onClick={async () => {
                const url = await VOICES_extractTextAndCreateVoice({
                  text: lineText,
                  checkOnly: false,
                  alwaysNewVoice: true,
                });
                const player = new Tone.Player(url).toDestination();
                setCurrentVoiceSample(player);
              }}
            >
              render audio
            </Button>
            {currentVoiceSample && (
              <Button
                variant={"outline"}
                onClick={() => {
                  // if(!globalContext){
                  //     setGlobalContext(Tone.getContext())
                  // }
                  console.log("currentVoiceSample", currentVoiceSample);
                  if (Tone.getContext().isOffline) {
                    Tone.getContext().resume();
                  }
                  currentVoiceSample.start();
                  //setCurrentVoiceSample(undefined)
                }}
              >
                play voice
              </Button>
            )}
            {voiceUrls && voiceUrls.length > 0 && (
              <Select
                onValueChange={(url) =>
                  setCurrentVoiceSample(new Tone.Player(url).toDestination())
                }
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="stored voices" />
                </SelectTrigger>
                <SelectContent>
                  {voiceUrls.map((url, index) => (
                    <SelectItem key={index} value={url}>
                      {url
                        .replace(
                          "https://s3stackstack-voicesbucketcde2e728-zpld4elu8d2l.s3.us-east-1.amazonaws.com/",
                          ""
                        )
                        .replace(".mp3", "")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </TabsContent>
        <TabsContent value="single" className="w-full">
          <div
          //className="col-span-9 flex flex-col border-[1px]?  items-center justify-center w-full "
          >
            <div>
              <Button
                className=""
                variant={"default"}
                onClick={async () => {
                  const vobj: VoiceLineObject = (await VOICES_getVoiceObject(
                    lineText,
                    appState.currentUser.id
                  )) as VoiceLineObject;

                  setVoiceObject(vobj);

                  const _samples: Tone.Player[] = [];
                  for (const word of vobj.words) {
                    const player = new Tone.Player(word.url).toDestination();
                    _samples.push(player);
                  }

                  setWordSamples(_samples);
                }}
              >
                Render Word Slices
              </Button>
              {wordSamples.length > 0 && (
                <Button
                  onClick={async () => {
                    if (wordSamples.length === 0) {
                      return;
                    }
                    for (const player of wordSamples) {
                      player.start();
                      await new Promise((resolve) => setTimeout(resolve, 300));
                    }
                  }}
                  variant={"outline"}
                >
                  play all
                </Button>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-center w-full">
              {wordSamples.map((player, index) => (
                <Card
                  key={index}
                  className="w-32 h-32 m-2 hover:cursor-pointer hover:bg-violet-500/20? hover:text-lime-500 hover:font-bold"
                  onClick={() => player.start()}
                >
                  <CardHeader>
                    <CardTitle>{lineText.split(" ")[index]}</CardTitle>
                    {/* <CardDescription>Card Description</CardDescription> */}
                  </CardHeader>
                  <CardContent className="relative p-0 ">
                    <div
                      className="absolute flex items-center justify-center right-0 top-4 rounded-tl-lg rounded-br-lg border-l-[1px] border-t-[1px] hover:bg-blue-900 border-l-slate-500 border-t-slate-500 w-12 h-12 bg-slate-500/30"
                      onClick={async (e) => {
                        e.stopPropagation();

                        const updatedVO = await VOICES_updateVoiceObject(
                          voiceObject!,
                          index
                        );

                        setVoiceObject(updatedVO);

                        setWordSamples((prev) => {
                          return prev.map((player, i) => {
                            if (i === index) {
                              return new Tone.Player(
                                updatedVO.words[index].url
                              ).toDestination();
                            }
                            return player;
                          });
                        });

                        wordSamples[index].start();
                      }}
                    >
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <AudioWaveformIcon />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Re-Sample</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </CardContent>
                  {/* <CardFooter>
                    <p>Card Footer</p>
                  </CardFooter> */}
                </Card>
              ))}
            </div>
            <div className="relative flex flex-col items-center justify-center w-full">
              <LedStrip start={isPlaying} numSteps={numSteps} />
              <SequencerSteps
                numSequences={numSequences}
                sequences={sequences}
                pattern={currentSequence}
                updatePad={updatePad}
                drumTypes={drumTypes}
                bpm={currentBPM}
                numRows={numRows}
                numSteps={numSteps}
                players={players}
                setPlayers={setPlayers}
                setKeyPads={setSequences}
                setMixerVolumes={setMixerVolumes}
                setDrumTypes={setDrumTypes}
                playMode={patternPlay}
                actionButtonHandler={handlePatternRowAction}
                _currentStep={0}
                isPlaying={isPlaying}
                handleStepVolumeChanged={updateStepVolume}
                stepPatternSaves={stepPatternSaves}
              />
              {/* <button onClick={setUpSamples}>Set up</button> */}
              <Button
                className={`text-xl w-12 h-8 rounded-xl border-pink-700 border-[1px] my-4`}
                onClick={play}
              >
                {isPlaying && <StopCircle size={48} color="red" />}
                {!isPlaying && <PlayCircleIcon size={48} color="lime" />}
              </Button>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="sliced" className="w-full">
          <div className="flex flex-col border-[1px]? gap-5  items-center justify-center w-full ">
            <div>
              {currentVoiceSample && (
                <Button
                  onClick={async () => {
                    console.log("...Slice Indexes", sliceIndexes)
                    setSliceIndexes([...sliceIndexes, [0, 100]]);
                  }}
                  variant={"outline"}
                >
                  <PlusIcon />
                </Button>
              )}
              {sliceIndexes.length > 0 && !sliceIndexesSaved && (
                <Button
                  onClick={async () => {
                    console.log(
                      "sequences, sliceIndexes: ",
                      sequences,
                      sliceIndexes
                    );

                    const indexes = await VOICES_storeVoiceSliceIndexes(
                      lineText,
                      { sequenceSteps: sequences, sliceIndexes: sliceIndexes },
                      appState.currentUser.id
                    );
                   

                    //setSliceIndexes(JSON.parse(indexes.content));
                    setSliceIndexesSaved(true);

                    toast({
                      title: "Slice Indexes Saved",
                    });
                  }}
                >
                  <SaveIcon />
                </Button>
              )}
              <div
                className={`flex items-center justify-center flex-wrap gap-4`}
              >
                {sliceIndexes.length > 0 &&
                  // console.log("SliceIndexes", sliceIndexes) &&
                  sliceIndexes.map((slicePoints, index) => {
                    console.log("SlicePoint = ", slicePoints);
                    return (
                      <>
                        <div
                        key={index}
                          onClick={() => {
                            console.log(
                              "SlicePoint = ",
                              slicePoints[0],
                              slicePoints[1]
                            );
                            console.log(
                              "CurrentVoiceSample:  = ",
                              currentVoiceSample
                            );
                            console.log(
                              "Current Voice Sample Properties: ",
                              currentVoiceSample?.sampleTime,
                              slicePoints,
                              currentVoiceSample!.buffer.duration
                            );

                            // calculate the length of the sample divided by the percentage of the slice point
                            const sampleStart =
                              (currentVoiceSample!.buffer.duration / 100) *
                              slicePoints[0];

                            const sampleEnd =
                              (currentVoiceSample!.buffer.duration / 100) *
                              slicePoints[1];

                            console.log("SampleStartTime: ", sampleStart);

                            currentVoiceSample!.start(
                              0,
                              sampleStart,
                              sampleEnd
                            );
                          }}
                          className="flex flex-col items-center cursor-pointer hover:bg-pink-500 justify-center p-4 bg-white/20? h-32 w-48 border-gray-300 border-[1px] rounded-lg"
                        >
                          <div className="flex items-center justify-center gap-3">
                            <p className="text-xl">{slicePoints[0]}</p>-
                            <p className="text-xl">{slicePoints[1]}</p>
                          </div>
                          <div className="w-full flex flex-col items-center justify-center gap-6">
                            <Slider
                              orientation="horizontal"
                              //value={[50]} color="white"
                              //defaultValue={[slicePoints]}
                              onValueChange={(value) => {
                                setSliceIndexes((prev) => {
                                  return prev.map((slice, i) => {
                                    if (i === index) {
                                      return [value[0], slice[1]];
                                    }
                                    return [slice[0], slice[1]];
                                  });
                                });
                              }}
                              max={100}
                              step={1}
                              color="#ff7733"
                              //inverted
                              value={[slicePoints[0]]}
                              className={
                                "w-full border-[1px] h-4 text-red-500 bg-red-500 border-white"
                              }
                            />
                            <Slider
                              orientation="horizontal"
                              //value={[50]} color="white"
                              //defaultValue={[slicePoints]}
                              onValueChange={(value) => {
                                setSliceIndexes((prev) => {
                                  return prev.map((slice, i) => {
                                    if (i === index) {
                                      return [slice[0], value[0]];
                                    }
                                    return [slice[0], slice[1]];
                                  });
                                });
                              }}
                              max={100}
                              step={1}
                              color="#ff7733"
                              value={[slicePoints[1]]}
                              //inverted

                              className={
                                "w-full border-[1px] h-4 text-red-500 bg-red-500 border-white"
                              }
                            />
                          </div>
                        </div>
                      </>
                    );
                  })}
              </div>
            </div>

            {sliceIndexes.length > 0 && (
              <div className="relative flex flex-col items-center justify-center w-full">
                <LedStrip start={isPlaying} numSteps={numSteps} />
                <SequencerSteps
                  numSequences={numSequences}
                  sequences={sequences}
                  pattern={currentSequence}
                  updatePad={updatePad}
                  drumTypes={drumTypes}
                  bpm={currentBPM}
                  numRows={numRows}
                  numSteps={numSteps}
                  players={[currentVoiceSample as Tone.Player]}
                  setPlayers={setPlayers}
                  setKeyPads={setSequences}
                  setMixerVolumes={setMixerVolumes}
                  setDrumTypes={setDrumTypes}
                  playMode={patternPlay}
                  actionButtonHandler={handlePatternRowAction}
                  _currentStep={0}
                  isPlaying={isPlaying}
                  handleStepVolumeChanged={updateStepVolume}
                  stepPatternSaves={stepPatternSaves}
                />
                {/* <button onClick={setUpSamples}>Set up</button> */}
                <Button
                  className={`text-xl w-12 h-8 rounded-xl border-pink-700 border-[1px] my-4`}
                  onClick={play}
                >
                  {isPlaying && <StopCircle size={48} color="red" />}
                  {!isPlaying && <PlayCircleIcon size={48} color="lime" />}
                </Button>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
