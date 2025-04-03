import { tool } from "ai";
import z from "zod";
import { logger } from '@/src/lib/logger';

export const AGENT_TOOLS_userFileSystem = (textChatLogs: string[]) => {
  return {
    getFileList: tool({
      description: `Get a list of files from the user's file system.`,
      parameters: z.object({
        path: z.string().describe("The path to the directory to read."),
      }),
      execute: async ({ path }) => {
        logger.tool("File System Tool - Listing Directory", { path });
        textChatLogs.push(`Getting file list from path: ${path}`);
        
        try {
          const files = await UTILS_getFileList(path);
          logger.tool("File System Tool - Directory Listed", { 
            path,
            fileCount: files.length 
          });
          return files;
        } catch (error) {
          logger.tool("File System Tool - List Error", {
            path,
            error: (error as Error).message
          });
          throw error;
        }
      },
    }),
    readFile: tool({
      description: `Read a file from the user's file system.`,
      parameters: z.object({
        path: z.string().describe("The path to the file to read."),
      }),
      execute: async ({ path }) => {
        logger.tool("File System Tool - Reading File", { path });
        textChatLogs.push(`Reading file from path: ${path}`);
        
        try {
          const content = await UTILS_readFile(path);
          logger.tool("File System Tool - File Read", { 
            path,
            contentLength: content.length 
          });
          return content;
        } catch (error) {
          logger.tool("File System Tool - Read Error", {
            path,
            error: (error as Error).message
          });
          throw error;
        }
      },
    }),
  };
};

export const AGENT_TOOLS_powerShellCommand = (textChatLogs: string[]) =>
  tool({
    description: `Run a command in the user's file system.`,
    parameters: z.object({
      command: z.string().describe("The command to run."),
    }),
    execute: async ({ command }) => {
      logger.tool("PowerShell Tool - Executing Command", { 
        command: command.substring(0, 100) + (command.length > 100 ? "..." : "") 
      });
      textChatLogs.push(`Running PowerShell command: ${command}`);
      
      try {
        const result = await UTILS_powerShellCommand(command);
        logger.tool("PowerShell Tool - Command Complete", { 
          command: command.substring(0, 100) + (command.length > 100 ? "..." : ""),
          resultLength: result.length 
        });
        return result;
      } catch (error) {
        logger.tool("PowerShell Tool - Command Error", {
          command: command.substring(0, 100) + (command.length > 100 ? "..." : ""),
          error: (error as Error).message
        });
        throw error;
      }
    },
  });

// BACKING LOGIC

export async function UTILS_getFileList(path: string): Promise<string[]> {
  logger.tool("File System Util - Getting File List", { path });
  try {
    const files: string[] = [];
    logger.tool("File System Util - File List Retrieved", { 
      path,
      fileCount: files.length 
    });
    return files;
  } catch (error) {
    logger.tool("File System Util - List Error", {
      path,
      error: (error as Error).message
    });
    throw error;
  }
}

export async function UTILS_readFile(path: string): Promise<string> {
  logger.tool("File System Util - Reading File", { path });
  try {
    const content = "";
    logger.tool("File System Util - File Read", { 
      path,
      contentLength: content.length 
    });
    return content;
  } catch (error) {
    logger.tool("File System Util - Read Error", {
      path,
      error: (error as Error).message
    });
    throw error;
  }
}

export async function UTILS_powerShellCommand(
  command: string
): Promise<string> {
  logger.tool("PowerShell Util - Executing Command", { 
    command: command.substring(0, 100) + (command.length > 100 ? "..." : "") 
  });
  try {
    const result = "";
    logger.tool("PowerShell Util - Command Complete", { 
      command: command.substring(0, 100) + (command.length > 100 ? "..." : ""),
      resultLength: result.length 
    });
    return result;
  } catch (error) {
    logger.tool("PowerShell Util - Command Error", {
      command: command.substring(0, 100) + (command.length > 100 ? "..." : ""),
      error: (error as Error).message
    });
    throw error;
  }
}
