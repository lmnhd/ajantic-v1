"use server";

import { logger } from "@/src/lib/logger";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

const execAsync = promisify(exec);

interface VideoCompositionParams {
  videoUrl: string;
  narrationUrl: string;
  textOverlays: Array<{
    text: string;
    startTime: number;
    duration: number;
    position: {
      x: number;
      y: number;
    };
    style?: {
      fontSize?: number;
      color?: string;
      fontFamily?: string;
    };
  }>;
  backgroundMusic?: string;
  outputFormat: string;
}

export async function VIDEO_RUNWAY_composeVideoWithOverlays(params: VideoCompositionParams) {
  const startTime = Date.now();
  const outputId = randomUUID();
  const outputPath = join(process.cwd(), "public", "videos", `${outputId}.${params.outputFormat}`);

  try {
    logger.tool("Starting video composition implementation", {
      action: "VIDEO_RUNWAY_COMPOSE_IMPL_START",
      outputId
    });

    // 1. Download the video and audio files
    const videoPath = await downloadFile(params.videoUrl);
    const narrationPath = await downloadFile(params.narrationUrl);
    const backgroundMusicPath = params.backgroundMusic ? await downloadFile(params.backgroundMusic) : null;

    // 2. Create FFmpeg filter complex for text overlays
    const textFilters = params.textOverlays.map((overlay, index) => {
      const fontSize = overlay.style?.fontSize || 24;
      const color = overlay.style?.color || "white";
      const fontFamily = overlay.style?.fontFamily || "Arial";
      
      return `drawtext=text='${overlay.text}':fontsize=${fontSize}:fontcolor=${color}:fontfile=${fontFamily}:x=${overlay.position.x}:y=${overlay.position.y}:enable='between(t,${overlay.startTime},${overlay.startTime + overlay.duration})'`;
    }).join(",");

    // 3. Build FFmpeg command
    let ffmpegCommand = `ffmpeg -i "${videoPath}" -i "${narrationPath}"`;
    
    if (backgroundMusicPath) {
      ffmpegCommand += ` -i "${backgroundMusicPath}"`;
    }

    ffmpegCommand += ` -filter_complex "${textFilters}"`;

    // Add audio mixing if background music is present
    if (backgroundMusicPath) {
      ffmpegCommand += ` -filter_complex amix=inputs=3:duration=first:dropout_transition=2`;
    } else {
      ffmpegCommand += ` -filter_complex amix=inputs=2:duration=first:dropout_transition=2`;
    }

    ffmpegCommand += ` "${outputPath}"`;

    // 4. Execute FFmpeg command
    await execAsync(ffmpegCommand);

    // 5. Clean up temporary files
    await Promise.all([
      deleteFile(videoPath),
      deleteFile(narrationPath),
      backgroundMusicPath ? deleteFile(backgroundMusicPath) : Promise.resolve()
    ]);

    const duration = Date.now() - startTime;

    logger.tool("Video composition implementation complete", {
      action: "VIDEO_RUNWAY_COMPOSE_IMPL_COMPLETE",
      outputId,
      duration
    });

    return {
      url: `/videos/${outputId}.${params.outputFormat}`,
      duration: duration
    };
  } catch (error) {
    logger.tool("Video composition implementation error", {
      action: "VIDEO_RUNWAY_COMPOSE_IMPL_ERROR",
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

// Helper function to download a file
async function downloadFile(url: string): Promise<string> {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const tempPath = join(process.cwd(), "tmp", `${randomUUID()}.tmp`);
  await writeFile(tempPath, Buffer.from(buffer));
  return tempPath;
}

// Helper function to delete a file
async function deleteFile(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch (error) {
    logger.tool("Error deleting temporary file", {
      action: "VIDEO_RUNWAY_COMPOSE_CLEANUP_ERROR",
      path,
      error: error instanceof Error ? error.message : String(error)
    });
  }
} 