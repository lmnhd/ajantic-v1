// src/lib/agent-tools/tool-registry/ct-utils.ts
import { logger } from '@/src/lib/logger';
import { z } from 'zod';

// Zod schema for API implementation configuration
const apiImplementationConfigSchema = z.object({
  endpoint: z.string().min(1, "Endpoint cannot be empty."),
  method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"], { 
    errorMap: () => ({ message: "Method must be one of GET, POST, PUT, DELETE, PATCH." })
  }),
  parameterMapping: z.object({
    query: z.record(z.string()).optional().describe("Maps tool input names to API query parameter names."),
    body: z.record(z.string()).optional().describe("Maps tool input names to API body field names.")
  }).optional().describe("Defines how tool inputs map to API parameters."),
  authType: z.enum(["bearer", "basic", "apiKey"]).optional().describe("Authentication type for the API call."),
  apiKeyHeader: z.string().optional().describe("Header name for API key if authType is 'apiKey'. Defaults to X-API-Key in factory if not set."),
  timeout: z.number().int().positive().optional().describe("Timeout in milliseconds for the API call. Defaults to 30000ms in factory.")
});

/**
 * Validates the structure of a custom tool implementation string based on its type.
 *
 * @param implementation The implementation code string or JSON configuration string.
 * @param type The type of implementation (e.g., "function", "api").
 * @returns Object with `isValid` (boolean) and optional `error` (string).
 */
export function validateImplementationString(
    implementation: string | null | undefined,
    type: string | null | undefined
): { isValid: boolean; error?: string } {
    if (!implementation || implementation.trim() === '') {
        return { isValid: false, error: 'Implementation cannot be empty.' };
    }

    const trimmedImplementation = implementation.trim();

    if (type === "function") {
        // Check for common incorrect function declaration starts
        const functionDeclarationRegex = /^\s*(async\s+)?function\s*\(/;
        if (functionDeclarationRegex.test(trimmedImplementation)) {
            return {
                isValid: false,
                error: 'Implementation Error (type: function): Code should be an async arrow function body `async ({...}) => { ... }`, not a standard function declaration.'
            };
        }

        // Check if it correctly starts like an async arrow function accepting an object
        const arrowFunctionRegex = /^\s*async\s*\(\s*\{?/;
        if (!arrowFunctionRegex.test(trimmedImplementation)) {
            return {
                isValid: false,
                error: 'Implementation Error (type: function): Code does not appear to start with the required async arrow function structure `async ({ param1, ... }) => { ... }`.'
            };
        }
    } else if (type === "api") {
        let parsedConfig: any;
        try {
            parsedConfig = JSON.parse(trimmedImplementation);
        } catch (e) {
            logger.warn(`validateImplementationString (API type): JSON parsing failed for implementation: ${trimmedImplementation.substring(0, 100)}...`, { error: e });
            return { isValid: false, error: 'Implementation Error (type: api): Implementation string is not valid JSON.' };
        }

        const validationResult = apiImplementationConfigSchema.safeParse(parsedConfig);
        if (!validationResult.success) {
            const errorMessages = validationResult.error.errors.map(err => `${err.path.join('.') || 'config'}: ${err.message}`).join('; ');
            return {
                isValid: false,
                error: `Implementation Error (type: api): Invalid API configuration. Issues: ${errorMessages}`
            };
        }
        // Additional check: if parameterMapping.body is present, method should not be GET
        const { data: validatedApiConfig } = validationResult; // Destructure validated data
        if (validatedApiConfig.parameterMapping?.body && 
            Object.keys(validatedApiConfig.parameterMapping.body).length > 0 && 
            validatedApiConfig.method === "GET") {
            return {
                isValid: false,
                error: 'Implementation Error (type: api): \'parameterMapping.body\' cannot be used with GET method.'
            };
        }

    } else {
        // Unknown or unsupported type
        return { isValid: false, error: `Unsupported or missing implementation type provided for validation: ${type}` };
    }

    return { isValid: true };
}