"use client";
import {
  Top100Songs,
  Artist,
  FoundAlbum,
  FoundArtist,
  FoundSong,
  FoundTopHit,
  Song,
  ResearchSetLink,
  ProcessType,
} from "@/src/lib/types";
import { create } from "zustand";
import { useUser } from "@clerk/nextjs";
import { AIState } from "./aicontext";
import { FuncProps, RuleProps } from "@/components/songeditor/lyric/functionpanel";

type StoreState = {
  currentUser: any;
  top100Songs: Top100Songs;
  loading: boolean;
  modalOpen: boolean;
  dilemma: string;
  selectedArtists: Artist[];
  dialogOpen: boolean;
  foundSongs: FoundSong[];
  foundArtists: FoundArtist[];
  foundAlbums: FoundAlbum[];
  foundHits: FoundTopHit[];
  researchSetLinks: ResearchSetLink[];
  rules: RuleProps[];
  wordPlayFunctions: FuncProps[];
  choices: string[];
  _func: string;
  _message: string;
  _streamData: any;
  _taskHistory: any[];
  ui: any;
  tryCount: number;
  currentBlockNum: number;
  selectedLines: { blockNum: number; lineNum: number }[]
  aIStates: AIState[];
  optionVals: string[];
  processType: ProcessType;
  globalCustomFunctions: {name: string, value: string, id?:number}[];
  setChoices: (choices: string[]) => void;
  setCurrentUser: (user: any | null | undefined) => void;
  setFoundHits: (hits: FoundTopHit[]) => void;
  setTop100Songs: (songs: Top100Songs) => void;
  setLoading: (loading: boolean) => void;
  setModalOpen: (open: boolean) => void;
  setDilemma: (dilemma: string) => void;
  setSelectedArtists: (artists: Artist[]) => void;
  setDialogOpen: (open: boolean) => void;
  setFoundSongs: (songs: FoundSong[]) => void;
  setFoundArtists: (artists: FoundArtist[]) => void;
  setFoundAlbums: (albums: FoundAlbum[]) => void;
  setResearchSetLinks: (links: ResearchSetLink[]) => void;
  setWordPlayFunctions: (functions: FuncProps[]) => void;
  setRules: (rules: RuleProps[]) => void;
  setFunc: (func: string) => void;
  setMessage: (message: string) => void;
  setStream: (stream: any) => void;
  setTaskHistory: (taskHistory: any) => void;
  setUI: (ui: any) => void;
  setTryCount: (tryCount: number) => void;
  setCurrentBlockNum: (blockNum: number) => void;
  setSelectedLines: (lines: { blockNum: number; lineNum: number }[]) => void;
  setAIStates: (aIStates: AIState[]) => void;
  setOptionVals: (optionVals: string[]) => void;
  setProcessType: (type: ProcessType) => void;
  setGlobalCustomFunctions: (functions: {name: string, value: string, id?: number}[]) => void;
};
// export const useStore = create<StoreState>((set) => ({
//   currentUser: null,
//   setCurrentUser: (user: any) => set({ currentUser: user }),
//   top100Songs: [],
//   setTop100Songs: (songs: Top100Songs) => set({ top100Songs: songs }),
//   loading: false,
//   setLoading: (loading: boolean) => set({ loading }),
//   dilemma: "",
//   setDilemma: (dilemma: string) => set({ dilemma }),
//   selectedArtists: [] as Artist[],
//   setSelectedArtists: (artists: Artist[]) => set({ selectedArtists: artists }),
//   dialogOpen: false,
//   setDialogOpen: (open: boolean) => set({ dialogOpen: open }),
//   foundSongs: [] as FoundSong[],
//   setFoundSongs: (songs: FoundSong[]) => set({ foundSongs: songs }),
//   foundArtists: [] as FoundArtist[],
//   setFoundArtists: (artists: FoundArtist[]) => set({ foundArtists: artists }),
//   foundAlbums: [] as FoundAlbum[],
//   setFoundAlbums: (albums: FoundAlbum[]) => set({ foundAlbums: albums }),
//   foundHits: [] as FoundTopHit[],
//   setFoundHits: (hits: FoundTopHit[]) => set({ foundHits: hits }),
//   researchSetLinks: [] as ResearchSetLink[],
//   setResearchSetLinks: (sets: ResearchSetLink[]) =>
//     set({
//       researchSetLinks: sets,
//     }),
//   wordPlayFunctions: [] as FuncProps[],
//   setWordPlayFunctions: (functions: FuncProps[]) =>
//     set({ wordPlayFunctions: functions }),
//   modalOpen: false,
//   setModalOpen: (open: boolean) => set({ modalOpen: open }),
//   choices: [] as string[],
//   setChoices: (choices: string[]) => set({ choices: choices }),
//   _func: "anadiplosis",
//   setFunc: (func: string) => set({ _func: func }),
//   _message: "",
//   setMessage: (message: string) => set({ _message: message }),
//   _streamData: null,
//   setStream: (stream: any) => set({ _streamData: stream }),
//   _taskHistory: [],
//   setTaskHistory: (taskHistory: any[]) => set({ _taskHistory: taskHistory }),
//   ui: null,
//   setUI: (ui: any) => set({ ui: ui }),
//   tryCount: 0,
//   setTryCount: (tryCount: number) => set({ tryCount: tryCount }),
//   aIStates: [] as AIState[],
//   setAIStates: (aIStates: AIState[]) => set({ aIStates: aIStates }),
//   rules: [] as RuleProps[],
//   setRules: (rules: RuleProps[]) => set({ rules: rules }),
//   optionVals: [] as string[],
//   setOptionVals: (optionVals: string[]) => set({ optionVals: optionVals }),
//   processType: "line",
//   setProcessType: (type: ProcessType) => set({ processType: type }),
//   currentBlockNum: 0,
//   setCurrentBlockNum: (blockNum: number) => set({ currentBlockNum: blockNum }),
//   selectedLines: [] as { blockNum: number; lineNum: number }[],
//   setSelectedLines: (lines: { blockNum: number; lineNum: number }[]) => set({ selectedLines: lines }),
//   globalCustomFunctions: [] as {name: string, value: string, id?: number}[],
//   setGlobalCustomFunctions: (functions: {name: string, value: string, id?: number}[]) => set({ globalCustomFunctions: functions }),
// }));

// import type {
//   Top100Songs,
//   Artist,
//   FoundSong,
//   FoundArtist,
//   FoundAlbum,
//   FoundTopHit,
// } from "@/lib/types";

// export const useStore = create((set) => ({
//   top100Songs: [] as Top100Songs[],
//   setTop100Songs: (songs: Top100Songs[]) => set({ top100Songs: songs }),
//   loading: false,
//   setLoading: (loading: boolean) => set({ loading }),
//   dilemma: "",
//   setDilemma: (dilemma: string) => set({ dilemma }),
//   selectedArtists: [] as Artist[],
//   setSelectedArtists: (artists: Artist[]) => set({ selectedArtists: artists }),
//   dialogOpen: false,
//   setDialogOpen: (open: boolean) => set({ dialogOpen: open }),
//   foundSongs: [] as FoundSong[],
//   setFoundSongs: (songs: FoundSong[]) => set({ foundSongs: songs }),
//   foundArtists: [] as FoundArtist[],
//   setFoundArtists: (artists: FoundArtist[]) => set({ foundArtists: artists }),
//   foundAlbums: [] as FoundAlbum[],
//   setFoundAlbums: (albums: FoundAlbum[]) => set({ foundAlbums: albums }),
//   foundHits: [] as FoundTopHit[],
//   setFoundHits: (hits: FoundTopHit[]) => set({ foundHits: hits }),
// }));
