"use client";

import React, { useEffect, useRef, useState } from "react";
// @ts-ignore
import { useFormStatus } from "react-dom";
import { cn } from "@/src/lib/utils";
import { Mic } from "lucide-react";

export const mimeType = "audio/webm";
function Recorder({
  uploadAudio,
  onDoubleClick,
  useImmediateColor,
  className,
  iconColor,
}: {
  uploadAudio: (blob: Blob) => void;
  onDoubleClick?: () => void;
  useImmediateColor?: boolean;
  className?: string;
  iconColor?: string;
}) {
  const { pending } = useFormStatus();
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const [permission, setPermission] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const [recordingStatus, setRecordingStatus] = useState<
    "inactive" | "recording"
  >("inactive");
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);

  const getMicrophonePermission = async () => {
    if ("MediaRecorder" in window) {
      try {
        const streamData = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        setPermission(true);
        setStream(streamData);
      } catch (error) {
        console.error(error);
        alert("You need to allow microphone access to use this feature");
      }
    } else {
      alert("Your browser does not support this feature");
    }
  };
  useEffect(() => {
    getMicrophonePermission();
  });

  const localChunks: Blob[] = [];

  let _timeStamp = 0;
  const startRecording = async () => {
   // _timeStamp = Date.now();
    if (stream === null || pending) return;
    //console.log("stream", stream.getAudioTracks().length);

    //return
    try {
      setRecordingStatus("recording");

      const media = new MediaRecorder(stream, { mimeType });

      mediaRecorder.current = media;
      mediaRecorder.current.start();

      localChunks.splice(0, localChunks.length);

      mediaRecorder.current.ondataavailable = (e) => {
        if (typeof e.data === "undefined") return;
        if (e.data.size === 0) return;
        console.log("ondataavailable", e.data.size);
        localChunks.push(e.data);
        console.log("localChunks1", localChunks[localChunks.length - 1].size);
      };
      
      console.log("localChunks2", localChunks);
      console.log("audioChunks", audioChunks);

      setAudioChunks(localChunks);
    } catch (error) {
      console.error("Error starting recording:", error);
      // You might want to handle the error appropriately here,
      // such as setting an error state or showing a user-friendly message
    }
  };

  const stopRecording = () => {
    //const timeStamp = Date.now();

    //const timeDiff = timeStamp - _timeStamp;

    //console.log("timeStamp2", timeDiff);
    console.log("STOP-localChunks2", localChunks);
      console.log("STOP-audioChunks", audioChunks);

    // if (timeDiff < 30000 || localChunks.length === 0) {
    //   console.log("too short");
    //   if (mediaRecorder.current?.state === "recording") {
    //     mediaRecorder.current.stop();
    //     mediaRecorder.current.onstop = () => {
    //       setAudioChunks([]);
    //       _timeStamp = 0;
    //       setRecordingStatus("inactive");
    //     };
    //   }
    //   return;
    // }
    
   // return;
    if (mediaRecorder.current === null || pending) return;

    setRecordingStatus("inactive");

   

    mediaRecorder.current.onstop = () => {
      try {
        const blob = new Blob(audioChunks, { type: mimeType });

        //if (blob.size === 0) return;

        console.log("blob", blob);

        uploadAudio(blob);
      } catch (error) {
        console.error("Error in mediaRecorder onstop:", error);
      }

      setAudioChunks([]);
    };

     //stops the recording instance
     mediaRecorder.current.stop();
  };

  return (
    <div className={cn( className ? className : "flex items-center justify-center text-white max-w-56")}>
      {!permission && (
        <button className="text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800/50" onClick={getMicrophonePermission}>Get Microphone</button>
      )}

      {/* {pending && (
        <Image
          src={activeAssistanIcon}
          alt="Recorder"
          width={50}
          height={50}
          priority
          className="grayscale object-contain"
        />
      )} */}

      {true && (
        <Mic
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onDoubleClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onDoubleClick && onDoubleClick();
          }}
          className={cn(
            "cursor-pointer hover:scale-110 duration-150 transition-all ease-in-out p-2 rounded-full",
            recordingStatus === "recording"
              ? "text-white bg-red-600 animate-pulse"
              : `${useImmediateColor ? iconColor : "text-white bg-zinc-700 hover:bg-zinc-600"}`
          )}
          size={32}
        />
      )}

      {/* {recordingStatus === "recording" && (
        <Image
          src={inactiveAssistanIcon}
          alt="Recording"
          width={350}
          height={350}
          onClick={stopRecording}
          priority={true}
          className="assistant cursor-pointer hover:scale-110 duration-150 transition-all ease-in-out object-contain"
        />
      )} */}
    </div>
  );
}

export default Recorder;
