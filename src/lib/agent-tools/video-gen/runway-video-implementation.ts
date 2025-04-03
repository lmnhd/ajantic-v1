"use server";

import axios from 'axios';
import dotenv from 'dotenv';
import { logger } from "@/src/lib/logger";

dotenv.config();

interface IRunwayVideoGenParams {
  prompt: string;
  negativePrompt?: string;
  numFrames?: number;
  numSteps?: number;
  guidanceScale?: number;
  seed?: number;
  width?: number;
  height?: number;
  fps?: number;
}

export async function VIDEO_RUNWAY_generateVideo(params: IRunwayVideoGenParams) {
  try {
    const startTime = Date.now();
    
    logger.tool("Starting Runway video generation", {
      action: "VIDEO_RUNWAY_START",
      prompt: params.prompt
    });
    
    // Prepare the request payload
    const payload = {
      input: {
        prompt: params.prompt,
        negative_prompt: params.negativePrompt || "",
        num_frames: params.numFrames || 16,
        num_steps: params.numSteps || 25,
        guidance_scale: params.guidanceScale || 7.5,
        seed: params.seed || Math.floor(Math.random() * 1000000),
        width: params.width || 576,
        height: params.height || 320,
        fps: params.fps || 8,
      }
    };

    // Make the API request
    const response = await axios.post(
      'https://api.runwayml.com/v1/inference/gen-2',
      payload,
      {
        headers: {
          'Authorization': `Bearer ${process.env.RUNWAY_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Calculate generation time
    const generationTime = Date.now() - startTime;

    logger.tool("Runway video generation complete", {
      action: "VIDEO_RUNWAY_COMPLETE",
      generationTime
    });

    // Return the video URL and metadata
    return {
      videoUrl: response.data.output.video_url,
      metadata: {
        prompt: params.prompt,
        negativePrompt: params.negativePrompt,
        numFrames: params.numFrames || 16,
        numSteps: params.numSteps || 25,
        guidanceScale: params.guidanceScale || 7.5,
        seed: params.seed || Math.floor(Math.random() * 1000000),
        width: params.width || 576,
        height: params.height || 320,
        fps: params.fps || 8,
        generationTime
      }
    };
  } catch (error) {
    logger.tool("Runway video generation error", {
      action: "VIDEO_RUNWAY_ERROR",
      error: error instanceof Error ? error.message : String(error)
    });

    if (axios.isAxiosError(error)) {
      throw new Error(`Runway API Error: ${error.response?.data?.error || error.message}`);
    }
    throw error;
  }
} 