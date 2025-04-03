"use client";
import React, { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ElevenLabsVoiceSelect from "./elevenlabs-voice-select";

import {
  AgentVoice,
  AgentVoiceProviderEnum,
  AISessionState,
  ElevenLabsVoice,
} from "@/src/lib/types";
import WhisperVoiceSelect from "./whisper-voice-select";
import PollyVoiceSelect from "./polly-voice-select";
import { PlaySquareIcon } from "lucide-react";

import { PlayIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import { useGlobalStore } from "@/src/lib/store/GloabalStoreState";
import { toast } from "@/components/ui/use-toast";
import { UTILS_getGenericData, UTILS_putGenericData } from "@/src/lib/utils";
import { synthesizeTextToSpeechAny } from "@/src/lib/voices/voices-db";
import { Howl } from "howler";

export default function AgentVoiceSelect({
  onChange,
  elevenLabsVoices,
  voicesLoaded,
  agentIndex,
  localState,
}: {
  onChange: (voice: AgentVoice) => void;
  elevenLabsVoices: ElevenLabsVoice[];
  voicesLoaded: boolean;
  localState: AISessionState
  agentIndex?: number;
}) {
  

  const [currentVoice, setCurrentVoice] = useState<AgentVoice | null>(null);
  



  const handleVoiceChange = (voice: AgentVoice) => {
    setCurrentVoice(voice);
    onChange(voice);
  };

  const getVoiceDefaultValue = (provider: AgentVoiceProviderEnum) => {
    const _agent = localState.currentAgents.agents[agentIndex || 0];
    if (_agent && _agent.voice && _agent.voice.provider === provider) 
      switch (provider){
        case AgentVoiceProviderEnum.ELEVEN_LABS: return "elevenlabs";
        case AgentVoiceProviderEnum.OPENAI: return "whisper";
        case AgentVoiceProviderEnum.AWS: return "polly";
      }
    return "";
  }

  const tryGetVoiceDefaultValue = () => {
    try {
      return getVoiceDefaultValue(localState.currentAgents.agents[agentIndex || 0].voice?.provider || AgentVoiceProviderEnum.ELEVEN_LABS);
    } catch (e) {
      return "";
    }
  }

  const getElevenLabNameFromId = (voice_id: string) => {
    //console.log("ELEVENLABS-VOICEID: ", voice_id);
    return elevenLabsVoices.find((v) => v.voice_id === voice_id)?.name || "";
  };

  const handleTestVoice = async () => {
    console.log("TESTING VOICE: ", currentVoice);
    if (!currentVoice) {
      console.log("NO VOICE FOUND");
      toast({
        title: "No voice found",
        description: "Please select a voice",
      });
      return;
    };
    // Play with Howler
    const _voiceURI = await synthesizeTextToSpeechAny(
      `Hello, my name is ${localState.currentAgents.agents[agentIndex || 0].name}! This is a test.`,
      currentVoice?.provider as AgentVoiceProviderEnum,
      currentVoice?.nameOrVoiceID as string,
      "test"
    );
    console.log("_voiceURI: ", _voiceURI);
    if (_voiceURI) {
      const sound = new Howl({
        src: [_voiceURI],
      });
      sound.play();
    }
  };

  // useEffect(() => {
  //   const _gdName = 'ELEVEN_LABS_VOICE_LIST'
  //   if(UTILS_getGenericData(_gdName, globalMessages)){
  //     setElevenLabsVoices(UTILS_getGenericData(_gdName, globalMessages));
  //     setVoicesLoaded(true);
  //   }else{
  //   const loadElevenLabsVoices = async () => {
  //     try {
  //       const voices = await listElevenLabsVoices();
  //       setElevenLabsVoices(voices.voices);
  //       setVoicesLoaded(true);
  //       UTILS_putGenericData(voices.voices, _gdName, globalMessages);
  //     } catch (error) {
  //       console.error("Error loading ElevenLabs voices:", error);
  //       setVoicesLoaded(false);
  //     }
  //   };
  //     if (!voicesLoaded) loadElevenLabsVoices();
  //   }
  // }, []);

  // useEffect(() => {
  //   if (agentIndex) {
  //     const agent =
  //       globalMessages.currentState.currentAgents.agents[agentIndex];
  //     if (agent.voice) {
  //       handleVoiceChange(agent.voice)
  //     } else {
  //       console.log("NO VOICE FOUND FOR AGENT: ", agent);
  //       handleVoiceChange({
  //         provider: AgentVoiceProviderEnum.ELEVEN_LABS,
  //         nameOrVoiceID: elevenLabsVoices[0]?.voice_id || "",
  //       });
  //     }
  //     return;
  //   }
  //   if (elevenLabsVoices.length > 0) {
  //     //console.log("ELEVENLABS-VOICES: ", elevenLabsVoices);
  //     const name = getElevenLabNameFromId(elevenLabsVoices[0]?.voice_id || "");
  //     setCurrentVoice({
  //       provider: AgentVoiceProviderEnum.ELEVEN_LABS,
  //       nameOrVoiceID: elevenLabsVoices[0]?.voice_id || "",
  //     });
  //   } else {
  //     //console.log("VOICES ALREADY LOADED");
  //   }
  // }, [elevenLabsVoices]);

  return voicesLoaded ? (
    <div className="flex flex-col gap-2">
      {currentVoice && (
        <div className="text-xs">
          {currentVoice.provider}:{" "}
          {currentVoice.provider === AgentVoiceProviderEnum.ELEVEN_LABS
            ? getElevenLabNameFromId(currentVoice.nameOrVoiceID as string)
            : currentVoice.nameOrVoiceID.toString()}
        </div>
      )}
      <div
      className={"flex items-center justify-between"}
      >
        <Tabs defaultValue={tryGetVoiceDefaultValue() } className="w-2/3">
          <TabsList >
            <TabsTrigger value="elevenlabs">11L</TabsTrigger>
            <TabsTrigger value="whisper">WHISPER</TabsTrigger>
            <TabsTrigger value="polly">POLLY</TabsTrigger>
          </TabsList>
          <div
          //className="flex flex-col gap-2 items-center justify-center w-full"
          >
            <TabsContent
              className="w-full flex items-center justify-center"
              value="elevenlabs"
            >
              <ElevenLabsVoiceSelect
                voices={elevenLabsVoices}
                onChange={(voice_id) => {
                  console.log("ELEVENLABS-SELECTED: ", voice_id);
                  handleVoiceChange({
                    provider: AgentVoiceProviderEnum.ELEVEN_LABS,
                    nameOrVoiceID: voice_id,
                  });
                }}
                agentIndex={agentIndex}
              />
            </TabsContent>
            <TabsContent
              //className="w-full flex items-center justify-center"
              value="whisper"
            >
              <WhisperVoiceSelect
                onChange={(voice_id) => {
                  console.log("WHISPER-SELECTED: ", voice_id);
                  handleVoiceChange({
                    provider: AgentVoiceProviderEnum.OPENAI,
                    nameOrVoiceID: voice_id,
                  });
                }}
                agentIndex={agentIndex}
              />
            </TabsContent>
            <TabsContent
              //className="w-full flex items-center justify-center"
              value="polly"
            >
              <PollyVoiceSelect
                onChange={(voice_id) => {
                  console.log("POLLY-SELECTED: ", voice_id);
                  handleVoiceChange({
                    provider: AgentVoiceProviderEnum.AWS,
                    nameOrVoiceID: voice_id,
                  });
                }}
                agentIndex={agentIndex}
              />
            </TabsContent>
          </div>
        </Tabs>
        {/* <div className="bg-gradient-to-tl from-black/5 my-2 h-1 via-pink-600/90 p-1 to-black/5"></div> */}
        <Button
          className="w-32 h-32 bg-gradient-to-r from-indigo-600 to-violet-500/80 border-pink-400 border-[1px] p-1 rounded-md  "
          onClick={() => {
            console.log("CURRENT-VOICE: ", currentVoice);
            handleTestVoice();
          }}
        >
          <PlayIcon width={40} color="pink" height={40} />
        </Button>
      </div>
    </div>
  ) : (
    <div>Loading Voices...</div>
  );
}
