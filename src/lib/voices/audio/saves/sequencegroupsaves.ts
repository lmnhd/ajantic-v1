import { Song } from "../sequencer/sequencertypes";


export type SavedSequence = {
  id: string;
  name: string;
  userID:string;
  sequences: Song[];
  currentSequence: number;
  currentBPM: number;
  patternPlay: number;
  samplesToLoadOnCreate: string[];
  volumes: number[];
  drumTypes: string[];
  numRows: number;
  numSteps: number;
  tempo: number;
  samples: {
    id: string;
    index: number;
  }[];
};
