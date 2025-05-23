import { ToolRegistry } from "@/src/lib/agent-tools/tool-registry/registry";
import { isCustomToolReference, getCustomToolId } from "@/src/lib/agent-tools/tool-registry/custom-tool-ref";
import { logger } from "@/src/lib/logger";
import { CustomToolDefinition } from '@/src/lib/agent-tools/auto-gen-tool/tool-generator';
import { z, ZodTypeAny } from 'zod';
import { getDecryptedCredential } from '@/src/lib/security/credentials';
import { MissingCredentialError } from "../../agent-tools/load-agent-tools";
import { ToolRegistryEntry } from "@/src/lib/agent-tools/tool-registry/ct-types";

/**
 * Loads custom tools from the registry for use in orchestration
 * @param agentName The name of the agent
 * @param toolNames Array of tool references (including custom:id references)
 * @param userId The user ID for logging
 * @returns Object containing the loaded custom tools
 */
export async function loadCustomToolsForOrchestration(
  agentName: string,
  toolNames: (string | undefined)[],
  userId: string
): Promise<Record<string, any>> {
  const clerkId = userId;
  if (!clerkId) {
    logger.error("loadCustomToolsForOrchestration called without clerkId.", { agentName });
    throw new Error("User ID (clerkId) is required to load custom tools.");
  }

  try {
    const customTools: Record<string, any> = {};
    
    // Filter for custom tool references
    const customToolRefs = (toolNames || [])
      .filter(Boolean)
      .filter(name => isCustomToolReference(name as string));
    
    if (customToolRefs.length === 0) {
      return customTools;
    }
    
    logger.tool("Loading custom tools for orchestration", {
      agentName,
      customToolCount: customToolRefs.length
    });
    
    // Helper function to safely parse schema string
    function parseZodSchemaFromToolParameters(paramDefinitionString: string | undefined | null): ZodTypeAny {
      if (!paramDefinitionString) {
        return z.any().describe("No specific parameters defined");
      }
      try {
        // Attempt to parse the JSON string into the ToolParameter[] structure
        const parameters: { name: string; type: string; description: string; required?: boolean }[] = JSON.parse(paramDefinitionString);

        // Build a Zod object schema from the ToolParameter array
        const shape: Record<string, ZodTypeAny> = {};
        for (const param of parameters) {
          let zodType: ZodTypeAny;
          switch (param.type) {
            case 'string': zodType = z.string(); break;
            case 'number': zodType = z.number(); break;
            case 'boolean': zodType = z.boolean(); break;
            // Add cases for 'array', 'object' if needed, potentially requiring more complex parsing
            default: zodType = z.any(); // Fallback for unknown types
          }
          if (param.description) {
            zodType = zodType.describe(param.description);
          }
          if (param.required === false) { // Make optional if required is explicitly false
            shape[param.name] = zodType.optional();
          } else { // Default to required
            shape[param.name] = zodType;
          }
        }
        return z.object(shape);

      } catch (error) {
        logger.error("Failed to parse ToolParameter JSON or build Zod schema", { paramDefinitionString, error });
        return z.any().describe("Error parsing parameters definition, accepting any input");
      }
    }
    
    // Define the factory function - **IMPORTANT**: it now expects the Prisma-like type
    function createToolExecutor(toolEntry: ToolRegistryEntry) {
       // ... (rest of factory function - make sure it uses toolEntry.implementation, not functionBody) ...
       // This outer function receives the specific toolEntry for *one* tool.

       // It returns the actual execute function which closes over the toolEntry above.
       return async function execute(params: any) { // params will be whatever the Zod schema parses
         try {
           // Now, toolEntry refers to the correct one passed to createToolExecutor
           logger.tool(`Executing tool ${toolEntry.name}`, {
             toolId: toolEntry.id,
             params,
           });

           // === Potential Place for Just-In-Time Credential Fetch ===
           // If we adopted Option B earlier, we would check for a marker here
           // and call getDecryptedCredential just before execution.
           // For now, we assume the credential check happened earlier (in the loop below).

           // The rest of your existing switch logic using toolEntry
           switch (toolEntry.implementationType) {
             case "function":
               // eslint-disable-next-line no-new-func
               const fn = new Function(
                 "params",
                 `
                 return (async () => {
                   try {
                     ${toolEntry.implementation} // Use implementation
                     // Maybe return a success message or result if the function doesn't explicitly
                     return "Function executed successfully.";
                   } catch (error) {
                     console.error("Error executing custom function tool:", error);
                     return "Error in custom function: " + (error instanceof Error ? error.message : String(error));
                   }
                 })();
               `
               );
               const result = await fn(params);
               logger.tool(`Tool ${toolEntry.name} result: ${typeof result === 'string' ? result.substring(0, 100) : JSON.stringify(result)}`, { toolId: toolEntry.id });
               return result;

             case "api":
               const endpoint = (toolEntry.implementation || "").startsWith("{") // Use implementation
                 ? JSON.parse(toolEntry.implementation || "{}").endpoint || "" // Use implementation
                 : toolEntry.implementation || ""; // Use implementation
               if (!endpoint) {
                  logger.error("No API endpoint specified for tool", { toolId: toolEntry.id, name: toolEntry.name });
                  throw new Error(`No API endpoint specified for tool ${toolEntry.name}`);
               }
                logger.tool(`Calling API for tool ${toolEntry.name}`, { toolId: toolEntry.id, endpoint, params });
               const response = await fetch(endpoint, {
                 method: "POST", // Or load from toolEntry if needed
                 headers: {
                   "Content-Type": "application/json",
                   // Add any other required headers, possibly from toolEntry
                 },
                 body: JSON.stringify(params),
               });
               const apiResult = await response.text(); // Or response.json() if applicable
               logger.tool(`Tool ${toolEntry.name} API result status: ${response.status}`, { toolId: toolEntry.id });
               if (!response.ok) {
                   throw new Error(`API call failed with status ${response.status}: ${apiResult}`);
               }
               return apiResult; // Or parsed JSON

             case "dynamic-script":
               logger.warn("Dynamic script execution not yet implemented", { toolId: toolEntry.id, name: toolEntry.name });
               return `Dynamic script execution not yet implemented for tool ${toolEntry.name}`; // Placeholder

             default:
                logger.error(`Unsupported tool implementation type: ${toolEntry.implementationType}`, { toolId: toolEntry.id, name: toolEntry.name });
               return `Unsupported tool implementation type: ${toolEntry.implementationType}`;
           }
         } catch (error) {
            logger.error(`Error executing tool ${toolEntry.name}`, {
              error: error instanceof Error ? error.message : String(error),
              toolId: toolEntry.id,
              params,
            });
           return `Error executing tool ${toolEntry.name}: ${
             error instanceof Error ? error.message : String(error)
           }`;
         }
       };
    }
    
    // Process each custom tool reference
    for (const ref of customToolRefs) {
      try {
        const toolId = getCustomToolId(ref as string);
        const toolEntry = await ToolRegistry.getToolById(toolId);

        if (!toolEntry) {
          logger.warn(`Custom tool not found in registry: ${toolId}`, { agentName, ref });
          continue;
        }

        // --- BEGIN CREDENTIAL CHECK ---
        if (toolEntry.requiredCredentialNames && toolEntry.requiredCredentialNames.length > 0) {
          for (const credentialName of toolEntry.requiredCredentialNames) {
            logger.debug(`Tool "${toolEntry.name}" requires credential: ${credentialName}. Checking...`, { agentName, toolId });
            const credentialValue = await getDecryptedCredential(clerkId, credentialName);

            if (credentialValue === null) {
              logger.warn(`Required credential "${credentialName}" missing for tool "${toolEntry.name}". Aborting tool load.`, { agentName, toolId, clerkId });
              throw new MissingCredentialError(credentialName);
            } else {
              logger.debug(`Credential "${credentialName}" found for tool "${toolEntry.name}". Proceeding.`, { agentName, toolId });
            }
          }
        }
        // --- END CREDENTIAL CHECK ---

        const parametersSchema = parseZodSchemaFromToolParameters(toolEntry.parameters);

        const finalToolObject = {
          description: toolEntry.description || "No description provided.",
          parameters: parametersSchema,
          execute: createToolExecutor(toolEntry),
        };

        if(customTools[toolEntry.name]) {
             logger.warn(`Duplicate custom tool name detected: ${toolEntry.name}. Overwriting.`, { toolId: toolEntry.id, agentName });
        }
        customTools[toolEntry.name] = finalToolObject;

        logger.debug(`Successfully prepared custom tool: ${toolEntry.name}`, { toolId: toolEntry.id, agentName });

      } catch (error) {
        if (error instanceof MissingCredentialError) {
            throw error;
        }
        logger.error(`Error processing custom tool reference ${ref}`, { error, agentName });
      }
    }
    
    return customTools;
  } catch (error) {
    if (error instanceof MissingCredentialError) {
        throw error;
    }
    logger.error("Failed to load custom tools for orchestration", { error, agentName });
    return {};
  }
} 