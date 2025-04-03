"use server";

import { z } from "zod";
import { RunwayVideoInputSchema } from "./runway-video-tool";

export async function VIDEO_RUNWAY_generateVideoWithAPI(input: z.infer<typeof RunwayVideoInputSchema>) {
  const startTime = Date.now();
  const apiKey = process.env.RUNWAY_API_KEY;

  if (!apiKey) {
    throw new Error("RUNWAY_API_KEY environment variable is not set");
  }

  const response = await fetch("https://api.runwayml.com/v1/inference/gen-2", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: input.prompt,
      negative_prompt: input.negativePrompt,
      num_frames: input.numFrames || 16,
      num_steps: input.numSteps || 25,
      guidance_scale: input.guidanceScale || 7.5,
      seed: input.seed,
      width: input.width || 576,
      height: input.height || 320,
      fps: input.fps || 8,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Runway API error: ${error.message || response.statusText}`);
  }

  const result = await response.json();
  const duration = Date.now() - startTime;

  return {
    videoUrl: result.output.video_url,
    metadata: {
      prompt: input.prompt,
      negativePrompt: input.negativePrompt,
      numFrames: input.numFrames || 16,
      numSteps: input.numSteps || 25,
      guidanceScale: input.guidanceScale || 7.5,
      seed: input.seed,
      width: input.width || 576,
      height: input.height || 320,
      fps: input.fps || 8,
      generationTime: duration,
    },
  };
} 