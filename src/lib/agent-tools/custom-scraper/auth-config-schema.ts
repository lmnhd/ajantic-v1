import { z } from 'zod';

export const credentialRequirementSchema = z.object({
    name: z.string().min(1, "Credential name cannot be empty."),
    label: z.string().min(1, "Credential label cannot be empty."),
});

export const authConfigSchema = z.object({
    method: z.enum(['none', 'form', 'basic', 'bearerToken', 'apiKeyHeader']).default('none'),
    loginUrl: z.string().url("Login URL must be a valid URL.").optional(),
    usernameSelector: z.string().optional(),
    passwordSelector: z.string().optional(),
    submitSelector: z.string().optional(),
    apiKeyHeaderName: z.string().optional(), // e.g., 'Authorization' or 'X-API-KEY'
    apiKeyPrefix: z.string().optional(), // e.g., 'Bearer ' - include trailing space if needed
    requiredCredentialNames: z.array(credentialRequirementSchema).default([]),
}).refine(data => {
    if (data.method === 'form' && (!data.loginUrl || !data.usernameSelector || !data.passwordSelector || !data.submitSelector)) {
        // console.warn("Form auth missing required fields: loginUrl, usernameSelector, passwordSelector, submitSelector");
        return false;
    }
    if (data.method === 'apiKeyHeader' && !data.apiKeyHeaderName) {
        // console.warn("apiKeyHeader auth missing apiKeyHeaderName");
        return false;
    }
    if ((data.method === 'basic' || data.method === 'bearerToken' || data.method === 'apiKeyHeader') && data.requiredCredentialNames.length === 0) {
        // console.warn(`${data.method} auth typically requires at least one credential to be named.`);
        // Allowing this for now, but it's a strong indicator of misconfiguration.
        // If an API key is hardcoded or comes from a global env var NOT managed by per-tool credentials, this might be valid.
    }
    return true;
}, {
    message: "AuthConfig has missing fields required for the selected method, or expected credentials are not listed for the chosen auth method.",
});

export type AuthConfig = z.infer<typeof authConfigSchema>;
export type CredentialRequirement = z.infer<typeof credentialRequirementSchema>; 