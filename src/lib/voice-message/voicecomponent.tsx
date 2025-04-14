"use client";

import React, { useContext, useEffect } from "react";
//import Recorder from "./recorder";
//import VoiceSynthesizer from "./speech/voicesynthesizer";
// @ts-ignore
// import { useFormState } from "react-dom";

import { Message } from "ai";
import Recorder from "./recorder";
import transcript from "./transcript";
import { cn } from "@/src/lib/utils";
//import { AppContext } from "@/app/providers/context";

import { useActionState } from "react";

const initialState = {
  response: "",
};

function VoiceComponent({
  handleVoiceSubmit,
  handleInputChange,
  recorderDoubleClick,
  useImmediateColor,
  className,
}: {
  handleVoiceSubmit: (e: string) => void;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  recorderDoubleClick?: () => void;
  useImmediateColor?: boolean;
  className?: string;
}) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const submitButton = React.useRef<HTMLButtonElement>(null);
  const submitTextButton = React.useRef<HTMLButtonElement>(null);
  const transcriptTextInput = React.useRef<HTMLInputElement>(null);
  const [state, formAction] = useActionState(transcript, initialState);
  
  const uploadAudio = (blob: Blob) => {
    const file = new File([blob], "audio.webm", { type: blob.type });

    // set the file as the value of the hidden file input field
    if (fileRef.current) {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      fileRef.current.files = dataTransfer.files;

      //console.log("fileref", fileRef.current.files[0]);

      // Manually trigger the server action instead of form submission
      if (fileRef.current.files[0]) {
        const formData = new FormData();
        formData.append('audio', fileRef.current.files[0]);
        formAction(formData);
      }
    }
  };
  
  useEffect(() => {
    if (state.response) {
      // transcriptTextInput.current!.value = state.response;
      if(state.response && state.response !== "No audio file found") {
        console.log("VOICE_COMPONENT_USEEFFECT...", state);
        handleVoiceSubmit(state.response);
      }
    }
  }, [state, handleVoiceSubmit]);

  // useEffect(() => {
  //   console.log("transcript-vc", transcript);
  //   if (submitTextButton.current) {
  //     submitTextButton.current?.click();
  //   }
  // }, [transcript]);

  return ( true ? 
    <div className={className}>
      {/* Replaced form with div to avoid nesting forms */}
      <div className="flex flex-col bg-black?">
        <input 
          title="file" 
          type="file" 
          name="audio" 
          hidden 
          ref={fileRef} 
        />
        {/* Hidden button no longer needed since we directly call formAction */}
        <div>
          {/* Recorder */}
          <Recorder 
            className={cn(className, "w-full bg-slate-800 text-pink-400 rounded-lg")}
            uploadAudio={uploadAudio} 
            useImmediateColor={true} 
            onDoubleClick={recorderDoubleClick}
            iconColor={"text-indigo-400"}
          />
          {/* <div>
            <VoiceSynthesizer displaySettings={displaySettings} messages={messages} />
          </div> */}
        </div>
      </div>
    </div> : <></>
  );
}

export default VoiceComponent;
