import { tool } from "ai";

import { z } from "zod";
import { logger } from "@/src/lib/logger";
import { TOOLFUNCTION_CONTEXT_SETS } from "./context-sets/context-sets";
import { AgentComponentProps, ContextContainerProps } from "@/src/lib/types";
import { S3_storeFileToS3 } from "@/src/lib/agent-tools/s3-storage/s3-core";
export const AGENT_TOOLS_s3Store = (contextSets: ContextContainerProps[], currentAgent: AgentComponentProps) => {
  return {
    FILE_STORE: tool({
      description: "Store a file to a virtual storage space and recieve a URL to the file",
      parameters: z.object({
        file: z.any().describe("The file to store"),
        fileName: z.string().describe("The name of the file"),
        fileExtension: z.string().describe("The extension of the file"),
        contentType: z.string().describe("The content type of the file"),
      }),
      execute: async ({ file, fileName, fileExtension, contentType }) => {
        try {
            console.log("S3_storeFileToS3", { file, fileName, fileExtension });
            logger.tool("S3_storeFileToS3", { file, fileName, fileExtension });
    
            const result = await S3_storeFileToS3(file, fileExtension, contentType);
            console.log("S3_storeFileToS3 result", { result });
            logger.tool("S3_storeFileToS3 result", { result });
            await TOOLFUNCTION_CONTEXT_SETS(contextSets, "addSet", currentAgent, fileName || "Stored File", "URL: " + result);
            
            return result;
        } catch (error) {
          console.error("Error storing file to S3", error);
          logger.error("Error storing file to S3", { error });

          return "Error storing file to S3";
        }
      },
    }),
  };
};

export const AGENT_TOOLS_DIRECTIVE_FILE_STORE = () => {
  return `
<INSTRUCTIONS>
    <STEP>Use the FILE_STORE tool to store files in the virtual storage space.</STEP>
    <STEP>Provide the file to store and the file extension.</STEP>
    <STEP>You will be returned a URL to the file in the virtual storage space. Make sure to save this URL if you want to retrieve the file later.</STEP>
</INSTRUCTIONS>
  `;
};
