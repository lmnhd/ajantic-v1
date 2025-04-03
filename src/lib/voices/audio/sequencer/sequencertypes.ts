export type SequencePanelProps = {
  sequences: Song[];
  currentSequence: number;
  handleSequenceSelected: any;
  handleAddSequenceSelected: any;
};
export type Step = {
  rowNum: number;
  stepNum: number;
  selected?: boolean;
  onPadClicked?: any;
  selectedColor?: string;
  roll?: boolean;
  isPlaying?: boolean;
  currentStep?: number;
  localVolume?: number;
  handleStepChanged?: any;
  handleLocalVolumeChanged?: (
    rowNum: number,
    stepNum: number,
    localVolume: number
  ) => void;
};
export type SampleID = {
  id:string,
  index:number
}

export type SequenceRow = Step[];
export type Song = SequenceRow[];

export type VoiceSliceIndexObject = {sliceIndexes:number[][], sequenceSteps: Song[]}
