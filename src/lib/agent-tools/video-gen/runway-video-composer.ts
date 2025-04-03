import { z } from "zod";
import { tool } from "ai";
import { logger } from "@/src/lib/logger";
import { pollyGetVoiceURIFaster } from "@/src/lib/speech/voices";
import { PollyVoices } from "@/src/lib/speech/voices-types";
import { VIDEO_RUNWAY_composeVideoWithOverlays } from "./runway-video-composer-impl";

// Define the input schema for video composition
const VideoCompositionInputSchema = z.object({
  videoUrl: z.string().describe("URL of the Runway-generated video"),
  narrationText: z.string().describe("Text to be narrated over the video"),
  voiceId: z.string().optional().describe("Voice ID for narration (default: Amy)"),
  textOverlays: z.array(z.object({
    text: z.string(),
    startTime: z.number(),
    duration: z.number(),
    position: z.object({
      x: z.number(),
      y: z.number()
    }),
    style: z.object({
      fontSize: z.number().optional(),
      color: z.string().optional(),
      fontFamily: z.string().optional()
    }).optional()
  })).optional(),
  backgroundMusic: z.string().optional().describe("URL of background music (optional)"),
  outputFormat: z.enum(["mp4", "mov", "webm"]).default("mp4")
});

// Define the output schema
const VideoCompositionOutputSchema = z.object({
  composedVideoUrl: z.string().describe("URL of the final composed video"),
  metadata: z.object({
    duration: z.number(),
    format: z.string(),
    textOverlays: z.array(z.object({
      text: z.string(),
      startTime: z.number(),
      duration: z.number()
    })),
    hasNarration: z.boolean(),
    hasBackgroundMusic: z.boolean()
  })
});

export const AGENT_TOOLS_videoComposer = (userId: string, agentName: string) => {
  return {
    VIDEO_RUNWAY_composeVideo: tool({
      description: "Compose a video with text overlays and voice narration",
      parameters: VideoCompositionInputSchema,
      execute: async (input) => {
        logger.tool("Starting video composition", {
          action: "VIDEO_RUNWAY_COMPOSE_START",
          agent: agentName,
          videoUrl: input.videoUrl
        });

        try {
          // 1. Generate voice narration
          const voiceUrl = await pollyGetVoiceURIFaster(
            input.narrationText,
            (input.voiceId as PollyVoices) || "Amy"
          );

          // 2. Prepare composition parameters
          const compositionParams = {
            videoUrl: input.videoUrl,
            narrationUrl: voiceUrl,
            textOverlays: input.textOverlays || [],
            backgroundMusic: input.backgroundMusic,
            outputFormat: input.outputFormat
          };

          // 3. Call video composition service
          const composedVideo = await VIDEO_RUNWAY_composeVideoWithOverlays(compositionParams);

          logger.tool("Video composition complete", {
            action: "VIDEO_RUNWAY_COMPOSE_COMPLETE",
            agent: agentName,
            success: true
          });

          return {
            composedVideoUrl: composedVideo.url,
            metadata: {
              duration: composedVideo.duration,
              format: input.outputFormat,
              textOverlays: input.textOverlays || [],
              hasNarration: true,
              hasBackgroundMusic: !!input.backgroundMusic
            }
          };
        } catch (error) {
          logger.tool("Video composition error", {
            action: "VIDEO_RUNWAY_COMPOSE_ERROR",
            agent: agentName,
            error: (error as Error).message
          });
          throw error;
        }
      }
    })
  };
};

// Documentation for the agent
export const AGENT_TOOLS_DIRECTIVE_VIDEO_COMPOSER = () => {
  return `
  <INSTRUCTIONS>
      <STEP>Use the video composition tools to create promotional videos:</STEP>
      <STEP>VIDEO_RUNWAY_composeVideo: Combine video with text overlays and narration</STEP>
      <STEP>Parameters include video URL, narration text, text overlays, and background music</STEP>
      <STEP>All video composition is handled securely with proper error handling</STEP>
      <STEP>Note: Video composition may take some time to complete</STEP>
  </INSTRUCTIONS>
  `;
}; 