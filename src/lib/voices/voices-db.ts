"use server";
/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  S3Client,
  PutObjectCommand,
  PutObjectCommandInput,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { PutObjectRequest } from "aws-sdk/clients/s3";
import { randomUUID } from "crypto";
import OpenAI from "openai";
import { db } from "../db";
import { GeneralPurpose } from "@prisma/client";
import { AgentVoiceProviderEnum, VoiceLineObject } from "../types";
import { Song, VoiceSliceIndexObject } from "./audio/sequencer/sequencertypes";
import { pollyGetVoiceURIFaster, whisperGetVoiceURI } from "../speech/voices";
import { PollyVoices, WhisperVoices } from "../speech/voices-types";

// AWS.config.region = 'us-east-1';
// AWS.config.credentials = new AWS.CognitoIdentityCredentials({
//     IdentityId: process.env.AWS_IDENTITY_POOL_ID as string,
// });

export const storeVoiceToS3 = async (voice: Blob | Buffer | undefined) => {
  const client = new S3Client({
    region: "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.AWS_SECRET_ACCESS as string,
    },
  });
  try {
    const response = new Upload({
      client,
      params: {
        Bucket: "s3stackstack-voicesbucketcde2e728-zpld4elu8d2l",
        Key: randomUUID().toString() + ".mp3",
        Body: voice,
        // expires 3 days from now
        Expires: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
    });
    response.on("httpUploadProgress", (progress) => {
      console.log(`Uploaded ${progress.loaded} of ${progress.total} bytes`);
    });
    const result = await response.done();
    console.log("storeVoiceToS3 result...", result);
    return result.Location;
  } catch (error) {
    console.log(error);
  }
};

export async function getVoiceFromS3(key: string) {
  const client = new S3Client({
    region: "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.AWS_SECRET_ACCESS as string,
    },
  });
  const command = new GetObjectCommand({
    Bucket: "s3stackstack-voicesbucketcde2e728-zpld4elu8d2l",
    Key: key,
  });
  const response = await client.send(command);
  console.log(response);
  return response;
}
//{"text":"<string>","model_id":"<string>","voice_settings":{"stability":123,"similarity_boost":123,"style":123,"use_speaker_boost":true},"pronunciation_dictionary_locators":[{"pronunciation_dictionary_id":"<string>","version_id":"<string>"}],"seed":123,"previous_text":"<string>","next_text":"<string>","previous_request_ids":["<string>"],"next_request_ids":["<string>"]}
async function synthesizeTextToSpeech11(text: string) {
  console.log("text...", text);
  const options = {
    text: text,
    model_id: "eleven_multilingual_v2",
    voice_settings: {
      stability: 0.3,
      similarity_boost: 0.3,
    },
  };
  const json = JSON.stringify(options);

  console.log("json...", json);
//LysdQ9l5KpHjIX7Z8VX7
  const response = await fetch(
    //"https://api.elevenlabs.io/v1/text-to-speech/yNMmbyyUyvxtGUwOWF8r"
    "https://api.elevenlabs.io/v1/text-to-speech/LysdQ9l5KpHjIX7Z8VX7",
    {
      method: "POST",
      
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": "780d408565432465be6d72ce302864b1",
      },
      body: json,
    }
  );
  const data = await response.blob();

  console.log("voice data...", data);

  return data;

  // const voice = data.audio;
  // const url = await storeVoiceToS3(voice);
  // console.log(url);
  // return url;
}
async function eleventLabsVoice(text: string, voiceName: string): Promise<Blob> {
  console.log("text...", text);
  const options = {
    text: text,
    model_id: "eleven_multilingual_v2",
    voice_settings: {
      stability: 0.3,
      similarity_boost: 0.3,
    },
  };
  const json = JSON.stringify(options);

  console.log("json...", json);
//LysdQ9l5KpHjIX7Z8VX7
  const response = await fetch(
    //"https://api.elevenlabs.io/v1/text-to-speech/yNMmbyyUyvxtGUwOWF8r"
    "https://api.elevenlabs.io/v1/text-to-speech/LysdQ9l5KpHjIX7Z8VX7",
    {
      method: "POST",
      
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": "780d408565432465be6d72ce302864b1",
      },
      body: json,
    }
  );
  const data = await response.blob();

  console.log("voice data...", data);

  return data;

  // const voice = data.audio;
  // const url = await storeVoiceToS3(voice);
  // console.log(url);
  // return url;
}

export async function listElevenLabsVoices() {
  const xpikey = process.env.ELEVENLABS_API_KEY;
  const url = "https://api.elevenlabs.io/v1/voices";
  const response = await fetch(url, {
    headers: {
      "xi-api-key": xpikey as string,
    },
  });
  const data = await response.json();
  //console.log(data);
  return data;
}

export async function getElevenLabsVoice(nameOrVoiceID: string, text: string, userId: string) {
  console.log("getElevenLabsVoice...", nameOrVoiceID, text, userId);
  //return;
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${nameOrVoiceID}`;
  const dbGPName = 'elevenlabs-voice-' + userId + '-' + nameOrVoiceID;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": process.env.ELEVENLABS_API_KEY as string,
    },
    body: JSON.stringify({
      text: text,
      voice_settings: {
        stability: 0.3,
        similarity_boost: 0.3,
        style: 0.3,
        use_speaker_boost: true,
      },
      model_id: "eleven_multilingual_v2",
    }),
    
  });

  console.log("response...", response);
  const data = await response.blob();
  console.log("data...", data);
  // convert to file
  //const file = new File([data], randomUUID().toString() + ".mp3", { type: "audio/mpeg" });


  const _voiceURL = await storeVoiceToS3(data);
  // await db.generalPurpose.create({
  //   data: {
  //     name: dbGPName,
  //     meta1: text,
  //     meta2: userId,
  //     meta3: "",
  //     content: _voiceURL as string,
  //   },
  // });
  return _voiceURL;
}

export async function synthesizeTextToSpeechAny(text: string, providerName: AgentVoiceProviderEnum, voiceName: string, userId: string): Promise<string | undefined> {

  switch(providerName) {
    case AgentVoiceProviderEnum.ELEVEN_LABS:
      console.log("synthesizeTextToSpeechAny ELEVEN_LABS...", voiceName, text, userId);
      return await getElevenLabsVoice(voiceName, text, userId);
      break;
     case AgentVoiceProviderEnum.AWS:
      console.log("synthesizeTextToSpeechAny AWS...", voiceName, text, userId);
      return pollyGetVoiceURIFaster(text, voiceName as PollyVoices);
    case AgentVoiceProviderEnum.OPENAI:
      console.log("synthesizeTextToSpeechAny OPENAI...", voiceName, text, userId);
      return whisperGetVoiceURI(text, voiceName as WhisperVoices);
      break;
    default:
      throw new Error("Invalid provider name");
  }

} 
// params
// name: 'text-to-voice'
// meta1: text
// meta2: url
// content: -voiceparams-
export const VOICES_extractTextAndCreateVoice = async ({ text, checkOnly, alwaysNewVoice }: { text: string, checkOnly?: boolean, alwaysNewVoice?: boolean }) => {
  const generalPurposeDataName = "text-to-voice";
  console.log('VOICES_extractTextAndCreateVoice: ', text, checkOnly, alwaysNewVoice);
  //return {}
  try {
    let _existingVoices: GeneralPurpose[] = [];
    
      _existingVoices = await db.generalPurpose.findMany({
        where: {
          name: generalPurposeDataName,
          meta1: text,
        },
        select: {
          content: true,
          id: true,
          createdAt: true,
          meta1: true,
          meta2: true,
          meta3: true,
          name: true,
          updatedAt: true,
        },
      });
    if(checkOnly) {
      console.log('Check only result: ', _existingVoices.length > 0);
      return _existingVoices.length > 0;
    }
    if (_existingVoices.length > 0 && !alwaysNewVoice) {
      console.log('Existing voice found: ', _existingVoices.length);
      return _existingVoices.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      )[0].content;
    } else {
      console.log('Creating new voice...');
      const voice = await synthesizeTextToSpeech11(text);
      const _voiceURL = await storeVoiceToS3(voice);
      const _newVoice = await db.generalPurpose.create({
        data: {
          name: generalPurposeDataName,
          meta1: text,
          meta2: `count: ${_existingVoices.length}`,
          meta3: "",
          content: _voiceURL as string,
        },
      });
      console.log('New voice created: ', _newVoice.content);
      return _newVoice.content;
    }
  } catch (error) {

    console.log(error);
    // Handle the error here
  }
};
export const VOICES_extractTextAndCreateVoiceForChat = async ({ text, providerName, voiceName}: { text: string, providerName: string, voiceName: string}) => {
  const generalPurposeDataName = "text-to-voice-chat";
  console.log('VOICES_extractTextAndCreateVoiceForChat: ', 'text: ', text, 'generalPurposeDataName: ', generalPurposeDataName);
  //return {}
  try {
    let _existingVoices: GeneralPurpose[] = [];
    
      _existingVoices = await db.generalPurpose.findMany({
        where: {
          name: generalPurposeDataName,
          meta1: text,
        },
        select: {
          content: true,
          id: true,
          createdAt: true,
          meta1: true,
          meta2: true,
          meta3: true,
          name: true,
          updatedAt: true,
        },
      });
    if (_existingVoices.length > 0) {
      console.log('Existing voice found: ', _existingVoices.length);
      return _existingVoices.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      )[0].content;
    } else {
      console.log('Creating new voice...');
      const voice = await synthesizeTextToSpeech11(text);
      const _voiceURL = await storeVoiceToS3(voice);
      const _newVoice = await db.generalPurpose.create({
        data: {
          name: generalPurposeDataName,
          meta1: text,
          meta2: `count: ${_existingVoices.length}`,
          meta3: "",
          content: _voiceURL as string,
        },
      });
      console.log('New voice created: ', _newVoice.content);
      return _newVoice.content;
    }
  } catch (error) {

    console.log(error);
    // Handle the error here
  }
};

export const VOICES_getAllVoicesForLine = async (lineText: string) => {
  const voiceURLs: string[] = [];
  let _existingVoices: GeneralPurpose[] = [];
  try {
    _existingVoices = await db.generalPurpose.findMany({
      where: {
        name: "text-to-voice",
        meta1: lineText,
      },
      select: {
        content: true,
        id: true,
        createdAt: true,
        meta1: true,
        meta2: true,
        meta3: true,
        name: true,
        updatedAt: true,
      },
    });
    if (_existingVoices.length > 0) {
      _existingVoices.forEach((voice) => {
        voiceURLs.push(voice.content);
      });
    }
  } catch (error) {
    console.log(error);
    // Handle the error here
  }
  return voiceURLs;
}

export const VOICES_getVoiceObject = async (lineText: string, userId: string) => {
  const generalDBName = 'voice-object-' + userId

  const vobj = await db.generalPurpose.findFirst({
    where: {name: generalDBName, meta1: lineText},
    select: {
      content: true,
      id: true,
      createdAt: true,
      meta1: true,
      meta2: true,
      meta3: true,
      name: true,
      updatedAt: true,
    },
    
  })
  if(vobj) {
    const result: VoiceLineObject = JSON.parse(vobj.content);
    result.id = vobj.id;
    return result;
  } else {
    const _words = lineText.split(' ');

    const vlo:VoiceLineObject = {lineText: lineText, words: [], userId: userId, id:0};

    for (const word of _words) {

      const _voiceURL = await VOICES_extractTextAndCreateVoice({text: word});

      vlo.words.push({word: word, url: _voiceURL as string});

    }
    try {

      const savedVLO = await db.generalPurpose.create({
        data: {
          name: generalDBName,
          meta1: lineText,
          meta2: userId,
          meta3: '',
          content: JSON.stringify(vlo),
        }
      })

      vlo.id = savedVLO.id;

      return vlo;

    } catch (error) {
      console.log(error);
      
      
    }
    
  }
  
}
export const VOICES_checkIfVoiceObjectExists = async (lineText: string, userId: string) => {
  const generalDBName = 'voice-object-' + userId

  const vobj = await db.generalPurpose.findFirst({
    where: {name: generalDBName, meta1: lineText},
    select: {
      content: true,
      id: true,
      createdAt: true,
      meta1: true,
      meta2: true,
      meta3: true,
      name: true,
      updatedAt: true,
    },
    
  })
  return vobj ? true : false;

}

export const VOICES_updateVoiceObject = async (vlo: VoiceLineObject, wordIndexToChange: number) => {
  const generalDBName = 'voice-object-' + vlo.userId;
  const _word = vlo.words[wordIndexToChange];
  const _voiceURL = await VOICES_extractTextAndCreateVoice({text: _word.word, checkOnly: false, alwaysNewVoice: true});

  console.log("Updated Voice URL: ", _voiceURL)
  vlo.words[wordIndexToChange].url = _voiceURL as string;
  const result = db.generalPurpose.update({
    where: {id: vlo.id},
    data: {
      content: JSON.stringify(vlo),

    }
  })
  return vlo
}

export const VOICES_storeVoiceSliceIndexes = async (lineText: string, voiceSliceIndexes: VoiceSliceIndexObject, userId: string) => {
  const generalDBName = 'voice-slice-indexes-' + userId;

  const _existing = await db.generalPurpose.findFirst({
    where: {name: generalDBName, meta1: userId, meta2: lineText},
    select: {
      content: true,
      id: true,
      createdAt: true,
      meta1: true,
      meta2: true,
      meta3: true,
      name: true,
      updatedAt: true,
  }})
  if(_existing){
    const result = await db.generalPurpose.update({
      where: {id: _existing.id},
      data: {
        content: JSON.stringify(voiceSliceIndexes),
      }
    })
    return result;
  }

 
  const _voiceSliceIndexes = await db.generalPurpose.create({
    data: {
      name: generalDBName,
      meta1: userId,
      meta2: lineText,
      meta3: Date.now().toString(),
      content: JSON.stringify(voiceSliceIndexes),
    }
  })
  return _voiceSliceIndexes;
}


export const VOICES_getVoiceSliceIndexes = async (lineText: string, userId: string, indexDBId?: number) => {
  if(indexDBId){
    return JSON.parse((await db.generalPurpose.findUnique({
      where: {id: indexDBId},
      select: {
        content: true,
        id: true,
        createdAt: true,
        meta1: true,
        meta2: true,
        meta3: true,
        name: true,
        updatedAt: true,
      },
    }))!.content) as VoiceSliceIndexObject
  }
  const generalDBName = 'voice-slice-indexes-' + userId;
  const _voiceSliceIndexes = await db.generalPurpose.findFirst({
    where: {name: generalDBName, meta1: userId, meta2: lineText},
    select: {
      content: true,
      id: true,
      createdAt: true,
      meta1: true,
      meta2: true,
      meta3: true,
      name: true,
      updatedAt: true,
    },
    
  })
  return _voiceSliceIndexes ? JSON.parse(_voiceSliceIndexes.content) as VoiceSliceIndexObject : {sliceIndexes: [[0,100]], sequenceSteps: []};
}