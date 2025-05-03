// src/lib/agent-tools/tool-registry/ct-utils.ts
import { logger } from '@/src/lib/logger';

/**
 * Validates the structure of a custom tool implementation string.
 * Checks for common errors like including a full function signature instead of just the body.
 *
 * @param implementation The implementation code string.
 * @returns Object with `isValid` (boolean) and optional `error` (string).
 */
export function validateImplementationString(implementation: string | null | undefined): { isValid: boolean; error?: string } {
    if (!implementation || implementation.trim() === '') {
        return { isValid: false, error: 'Implementation code cannot be empty.' };
    }

    const trimmedImplementation = implementation.trim();

    // Check for common incorrect function declaration starts
    const functionDeclarationRegex = /^\s*(async\s+)?function\s*\(/;
    if (functionDeclarationRegex.test(trimmedImplementation)) {
        return {
            isValid: false,
            error: 'Implementation Error: Code should be an async arrow function body `async ({...}) => { ... }`, not a standard function declaration `function name(...){...}` or `async function name(...){...}`.'
        };
    }

    // Check if it correctly starts like an async arrow function accepting an object
    // This is a basic check, not full syntax validation
    const arrowFunctionRegex = /^\s*async\s*\(\s*\{?/; // Loosely checks for `async ({` or `async (`
    if (!arrowFunctionRegex.test(trimmedImplementation)) {
         return {
            isValid: false,
            error: 'Implementation Error: Code does not appear to start with the required async arrow function structure `async ({ param1, ... }) => { ... }`.'
        };
    }

    // Add more checks here if needed (e.g., basic bracket matching)

    return { isValid: true };
}