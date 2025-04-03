"use client";

import React, { useEffect, useRef } from "react";
import * as Tone from "tone";
import WaveformData from "waveform-data";
import useCanvas from "./useCanvas";

export default function WaveDraw3({
  sampleUrl,
  height,
  color = 'white'
}:{
  sampleUrl:string,
  height:number,
  color?:string}) {
  const [data, setData] = React.useState<any>(null);
  const audioContext = new AudioContext();
  const canvasRef = useRef(null);
  
  const draw = (waveform: any, context: any, height: number) => {
    // Loop forwards, drawing the upper half of the waveform

    const channel = waveform.channel(0);
    const scaleY = (amplitude: number, _height: number) => {
      const range = 256;
      const offset = 128;

      return height - ((amplitude + offset) * _height) / range;
    };
    context.fillStyle = color;
    context?.beginPath();
    for (let x = 0; x < waveform.length; x++) {
      const val = channel.max_sample(x);

      context?.lineTo(x + 0.5, scaleY(val, height) + 0.5);
    }

    // Loop backwards, drawing the lower half of the waveform
    for (let x = waveform.length - 1; x >= 0; x--) {
      const val = channel.min_sample(x);

      context?.lineTo(x + 0.5, scaleY(val, height) + 0.5);
    }

    context?.closePath();
    context?.stroke();
    context?.fill();
  };

useEffect(() => {
    fetch(
        sampleUrl
      )
        .then((response) => response.arrayBuffer())
        .then((buffer) => {
          const options = {
            audio_context: audioContext,
            array_buffer: buffer,
            scale: 128,
          };
          console.log(options);
          
           return new Promise((resolve, reject) => {
              WaveformData.createFromAudio(options, (err, waveform) => {
                if (err) {
                  reject(err);
                } else {
                  resolve(waveform);
                }
              });
            }).then((waveform) => {
              setData(waveform);
            });
          
        });
},[sampleUrl])
  if(data){
    const canvas: any = canvasRef.current;
    
    const context = canvas.getContext("2d");
    draw(data, context, height);
    
  }
console.log(data);
  return <div>
    <canvas ref={canvasRef} width={height} height={height} />
  </div>;
}
