"use client";
import { Sample } from "@/API";
import { getS3URL } from "@/lib/s3";
import React, { useEffect, useState } from "react";
import * as Tone from "tone";
import WaveDraw3 from "./wavedraw3";
import { getDrumColor } from "@/lib/utils";
import { Button } from "@aws-amplify/ui-react";

import { clear } from "console";
export default function SampleAuditionTile({
  sample,
  playNow,
  height,
  sampleIndex,
  handleBadSample,
  loadNextStripRow
}: {
  sample: Sample;
  playNow: { index: string; time: string };
  height: number;
  sampleIndex: string;
  handleBadSample?:any;
  loadNextStripRow?:any;
}) {
  const [player, setPlayer] = useState<Tone.Player>();
  const [sampleObject, setSampleObject] = useState<Sample>();
  const [sampleURL, setSampleURL] = useState("");
  const [numLoadTries, setNumLoadTries] = useState(0);
  const [sampleWave, setSampleWave] = useState(<canvas></canvas>);
  const [sampleWaveOBJ, setSampleWaveOBJ] = useState(<></>);

  const [initStatus, setInitStatus] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);

  const MAX_LOAD_TRIES = 3;

  const playSample = () => {
    Tone.start();

    console.log("Play Sample Clicked");

    if (player) {
      
      setIsPlaying(true);
      setTimeout(() => {
        setIsPlaying(false);
      }, 500);
      
        player.start();
      
    }
  };
  useEffect(() => {
    console.log("SampleAuditionTile useEffect", `Sample: ${sample.name} initStatus: ${initStatus} oldSampleName: ${sampleObject?.name} newSampleName: ${sample.name}`)
    // if (sampleObject?.name !== sample.name) {
    //   setInitStatus("");
    //   setNumLoadTries(0);
    // }
    const init = async () => {
      //setNumLoadTries(numLoadTries + 1);
      try {
        const _url = await getS3URL(sample.s3Path);
        player?.dispose();
        const retry = setTimeout(() => {
          if (!player?.loaded) {
            setInitStatus("");
            console.log("SampleAuditionTile Load Retry: ", sample.name);
            handleBadSample(sample.id);
            clearTimeout(retry);
            
          }
        }, 5000);
        
        const _player = new Tone.Player(_url!, () => {
          _player.toDestination();
          clearTimeout(retry)
          setPlayer(_player);
          setSampleURL(_url!);
          setSampleObject(sample);
          setInitStatus("loaded");

          setSampleWaveOBJ(
            <WaveDraw3
              height={height / 2}
              color="white"
              sampleUrl={_url!}
              key={sampleIndex}
            />
          );

          console.log("SampleAuditionTile Load Complete: ", sample.name);
        });
      } catch (error) {
        console.log("SampleAuditionTile Load Error: ", error);
      }
    };
    if(initStatus === ""){
      setInitStatus("loading");
      init();
    }else{
      if(initStatus === "loading"){
        console.log("still loading...Cancel init")
        return;
      }
      if(sampleObject?.id !== sample.id){
        console.log("revitalizing sample", `old: ${sampleObject?.name} new: ${sample.name}`)
        setInitStatus("loading");
        init();
      }
    }
      // init()
      // : () => {
      //   if(sampleObject?.id === sample.id){return}
      //    // if (numLoadTries > MAX_LOAD_TRIES) {
      //     //  setInitStatus("limit-reached");
      //      // return;
      //   //  } else {
      //     console.log("revitalizing sample", sample.name)
      //       init();
      //   //  }
      //   };
  }, [sample]);

  useEffect(() => {
    if (player && playNow.index === sampleIndex) {
      
      setIsPlaying(true);
      setTimeout(() => {
        setIsPlaying(false);
      }, 100);
    } else {
      setIsPlaying(false);
    }
    if(playNow.index === sampleIndex){
      player?.start(playNow.time);
    }
  }, [playNow]);
  return (
    <div>
      {isPlaying ? (
        <div
          className={`flex items-center relative text-xl rounded-lg justify-center my-1 w-[${height}px] p-2 h-[${height}px] scale-110 transition-all duration-100 ease-in-out ${
            initStatus === "loaded" ? "bg-red-500" : "bg-slate-900/50"
          } border-[1px] border-indigo-500 cursor-pointer hover:border-[1px] border-pink-700  `}
          onClick={playSample}
        >
          <p className="absolute top-0 right-0 mr-3">{sampleObject?.drum}</p>
          {initStatus === "loaded" && sampleWaveOBJ}
        </div>
      ) : (
        <div
          className={`flex items-center relative text-xl rounded-lg justify-center my-1 w-[${height}px] h-[${height}px] p-2 scale-100 transition-all duration-100 ease-in-out ${
            initStatus === "loaded"
              ? getDrumColor(sampleObject?.drum || "bg-lime-500/60")
              : "bg-slate-900/50"
          } border-[1px] border-indigo-500 cursor-pointer hover:border-[1px] border-pink-700  `}
          onClick={playSample}
        >
          <p className="absolute top-0 right-0 mr-3">{sampleObject?.drum}</p>
          {initStatus === "loaded" && sampleWaveOBJ}
        </div>
      )}
      <Button 
      className="w-full text-pink-400 bg-gradient-to-tr from-pink-600 to-slate-950 "
      onClick={loadNextStripRow}>Keep</Button>
    </div>
  );
}
