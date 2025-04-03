"use client";
import { Check, ChevronsUpDown, PlusIcon } from "lucide-react";

import { cn } from "@/src/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Blockarize } from "@/src/app/api/blockarize";
import { useState } from "react";
import { AILyrics } from "@prisma/client";
import { useGlobalStore } from "@/src/lib/store/GloabalStoreState";

export default function MySongs({ setLyrics }: { setLyrics: any }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const {appState, globalMessages, setAppState, setGlobalMessages} = useGlobalStore();

  return (
    <div
    //className="flex flex-col col-span-2 max-h-full overflow-y-auto"
    >
      <Collapsible>
        <CollapsibleTrigger
        className="flex items-center justify-between p-2 my-6 cursor-pointer font-bold bg-orange-600/10 hover:bg-lime-600/40 rounded-sm"
        >My Songs</CollapsibleTrigger>
        <CollapsibleContent>
        <div 
        className="whitespace-pre-wrap text-center p-2 my-2 cursor-pointer font-extralight bg-orange-600/10 hover:bg-lime-600/40 rounded-sm"
        onClick={() => {
          setGlobalMessages({...globalMessages, currentState: {...globalMessages.currentState, currentSong: Blockarize(`LABEL: Intro  
          LABEL: Verse 1  
          LABEL: Chorus  
          LABEL: End   
          `
          ), songName: "[Title - Untitled]"}})}}
        ><PlusIcon className="mx-auto" size={24} /></div>
        {appState && appState.mySongs && appState.mySongs.map((song, i) => (
            <div
              key={i}
              className="whitespace-pre-wrap p-2 my-2 text-right text-violet-300 cursor-pointer font-semibold bg-orange-600/10 hover:bg-lime-600/40 rounded-sm"
              onClick={() => {
                console.log(song);
                if (!song.blockarized) return;
                console.log(song.blockarized);
                console.log("mySongs: ", appState.mySongs);
                setGlobalMessages({...globalMessages, currentState: {...globalMessages.currentState, currentSong: Blockarize(song.blockarized), songName: song.title}})
              }}
            >
              {song.title.replace(/\[Title - /gm, "").replace("]", "")}
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
