import { z } from "zod";
import { tool } from "ai";
import { logger } from "@/src/lib/logger";
import { AGENT_TOOLS_videoComposer } from "./runway-video-composer";
import { VIDEO_RUNWAY_generateVideoWithAPI } from "./runway-video-tool-impl";

// Define the input schema for the video generation tool
export const RunwayVideoInputSchema = z.object({
  prompt: z.string().describe("The text prompt describing the video to generate"),
  negativePrompt: z.string().optional().describe("Optional text describing what to avoid in the video"),
  numFrames: z.number().optional().describe("Number of frames to generate (default: 16)"),
  numSteps: z.number().optional().describe("Number of denoising steps (default: 25)"),
  guidanceScale: z.number().optional().describe("Guidance scale for the generation (default: 7.5)"),
  seed: z.number().optional().describe("Random seed for generation"),
  width: z.number().optional().describe("Width of the video in pixels (default: 576)"),
  height: z.number().optional().describe("Height of the video in pixels (default: 320)"),
  fps: z.number().optional().describe("Frames per second (default: 8)"),
});

// Define the output schema for the video generation tool
const RunwayVideoOutputSchema = z.object({
  videoUrl: z.string().describe("URL of the generated video"),
  metadata: z.object({
    prompt: z.string(),
    negativePrompt: z.string().optional(),
    numFrames: z.number(),
    numSteps: z.number(),
    guidanceScale: z.number(),
    seed: z.number(),
    width: z.number(),
    height: z.number(),
    fps: z.number(),
    generationTime: z.number(),
  }),
});

export const AGENT_TOOLS_videoGen = (userId: string, agentName: string) => {
  return {
    VIDEO_RUNWAY_generateVideo: tool({
      description: "Generate a video using Runway's Gen-2 model based on a text prompt",
      parameters: RunwayVideoInputSchema,
      execute: async (input) => {
        logger.tool("Generating video with Runway", {
          action: "VIDEO_RUNWAY_GENERATE_START",
          agent: agentName,
          prompt: input.prompt
        });

        try {
          const result = await VIDEO_RUNWAY_generateVideoWithAPI(input);

          logger.tool("Video Generation Complete", {
            action: "VIDEO_RUNWAY_GENERATE_COMPLETE",
            agent: agentName,
            success: true
          });

          return JSON.stringify({
            success: true,
            message: "Video generated successfully",
            data: result
          });
        } catch (error) {
          logger.tool("Video Generation Error", {
            action: "VIDEO_RUNWAY_GENERATE_ERROR",
            agent: agentName,
            error: (error as Error).message
          });
          
          return JSON.stringify({
            success: false,
            message: `Failed to generate video: ${(error as Error).message}`,
            error: (error as Error).message
          });
        }
      }
    })
  };
};

// Helper function to validate the input parameters
export const validateRunwayVideoInput = (input: z.infer<typeof RunwayVideoInputSchema>) => {
  return RunwayVideoInputSchema.parse(input);
};

// Helper function to validate the output
export const validateRunwayVideoOutput = (output: z.infer<typeof RunwayVideoOutputSchema>) => {
  return RunwayVideoOutputSchema.parse(output);
};

export const AGENT_TOOLS_video = (userId: string, agentName: string) => {
  return {
    ...AGENT_TOOLS_videoGen(userId, agentName),
    ...AGENT_TOOLS_videoComposer(userId, agentName)
  };
};

// Documentation for the agent
export const AGENT_TOOLS_DIRECTIVE_VIDEO = () => {
  return `
  <INSTRUCTIONS>
      <STEP>Use the video tools to create and compose videos:</STEP>
      <STEP>VIDEO_RUNWAY_generateVideo: Generate a video using Runway's Gen-2 model</STEP>
      <STEP>VIDEO_RUNWAY_composeVideo: Combine video with text overlays and narration</STEP>
      <STEP>Parameters include prompt, negative prompt, frame count, resolution, text overlays, and more</STEP>
      <STEP>All video operations are handled securely with proper error handling</STEP>
      <STEP>Note: Video operations may take some time to complete</STEP>
  </INSTRUCTIONS>
  `;
}; 