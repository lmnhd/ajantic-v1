export const autoGenToolPrompts = {
     generateToolImplementationPrompt: (scrapingToolImplementationConfigPromptSchemaShape: any, request: any, parametersString: string, acceptedStrategyString: string) => `
You are an expert JavaScript/TypeScript developer AND configuration specialist tasked with creating OR MODIFYING the implementation details and structure for a custom tool.
Your goal is to generate a robust, efficient, and correct implementation (JS/TS code string, API JSON config string, OR Scraping JSON config object) and a refined tool definition based ONLY on the provided details.

<instructions>
1.  **Understand Context:** Review all provided information: \`<tool_details>\`, \`<accepted_strategy>\` (if available), \`<current_implementation>\` (if available), and any \`<modification_requests>\`.
    *   **CRITICAL: The \`<accepted_strategy>\` is the PRIMARY GUIDE.** Adhere strictly to its \`recommendedType\`. Use its \`strategyDetails\` and heed its \`warnings\` and hints (like \`scrapingMethodHint\`).

2.  **Determine Implementation Type (Based on Strategy):**
    *   If \`recommendedType\` is 'api', follow API Implementation Guidelines (point 3). Your \`implementationType\` output MUST be "api".
    *   If \`recommendedType\` is 'function', follow Function Implementation Guidelines (point 4). Your \`implementationType\` output MUST be "function".
    *   If \`recommendedType\` is 'scraping', follow Scraping Implementation Guidelines (point 5). Your \`implementationType\` output MUST be "scraping".

3.  **API Implementation Guidelines (type='api'):**
    *   The \`implementation\` field MUST be a JSON string containing the API configuration:
    \`\`\`json
    {
      "endpoint": "https://api.example.com/endpoint",
      "method": "GET|POST|PUT|DELETE",
      "parameterMapping": {
            "query": { "apiQueryParam": "toolInputName" },
            "body": { "apiBodyField": "toolInputName" }
          },
          "authType": "bearer|basic|apiKey",
          "apiKeyHeader": "X-API-KEY"
    }
    \`\`\`
    *   Ensure required tool 'inputs' match parameters needed for the API call.
    *   If auth is needed, add credentials to \`requiredCredentialNames\`.

4.  **Function Implementation Guidelines (type='function'):**
    *   The \`implementation\` field MUST be a complete JavaScript/TypeScript async arrow function body as a string: \`async ({ param1, param2 }) => { ...body... }\`.
    *   Accept a single object argument destructuring the parameters defined in the final \`inputs\` array.
    *   Use standard Node.js modules sparingly. Avoid external libraries.
    *   Include robust error handling (try/catch).

5.  **Scraping Implementation Guidelines (type='scraping'):**
    *   The \`implementation\` field MUST be a **JSON formatted OBJECT**. It must conform to this structure: ${JSON.stringify(scrapingToolImplementationConfigPromptSchemaShape)}.
    *   **CRITICAL CHANGE:** The \`implementation\` field for a 'scraping' type tool MUST be a direct JSON object, NOT a stringified JSON object.
    *   **Example Structure (conceptual):**
    \`\`\`json
        {
            "implementationType": "scraping",
            "baseDomain": "example.com",
            "toolPurposeDescription": "Scrapes data...",
            "sourceFinderConfig": { /* ... */ },
            "authConfig": { /* ... */ },
            "scrapingMethodsConfig": { /* ... */ },
            "dataExtractionChain": [ /* ... */ ]
        }\`\`\`
    *   Refer to earlier prompt details for specifics on \`sourceFinderConfig\`, \`authConfig\`, \`scrapingMethodsConfig\`, and \`dataExtractionChain\`.
    *   **Tool Inputs**: Ensure the tool\'s \`inputs\` array includes parameters needed by the scraping config.

6.  **Refine Tool Definition (ALL Types - VERY IMPORTANT):**
    *   Based on the '<tool_details>', '<modification_requests>', AND ESPECIALLY the '<accepted_strategy>', you MUST review and potentially refine the tool\'s structural elements: 'name', 'description', 'inputs', 'expectedOutput', 'implementationType', and 'requiredCredentialNames'.
    *   **Inputs:** MUST be an array of objects, where each object defines a parameter and has 'name', 'type', 'description', and optionally 'required' and 'default' fields. This MUST align with the chosen implementation. API needs API params, Function needs function args, Scraping needs args for URL patterns/search AND the final agent query.
        *   Example: \`"inputs": [{ "name": "city", "type": "string", "description": "The city name.", "required": true }, { "name": "days", "type": "number", "description": "Number of forecast days.", "required": false, "default": 1 }]\`
    *   **Expected Output:** Describe what the implementation returns.
    *   **Implementation Type:** MUST be correctly set to "api", "function", or "scraping".
    *   **Required Credential Names:** Populate if needed. Each item: \`{ "name": "CRED_NAME", "label": "User Friendly Label" }\`.
    *   Ensure consistency between the definition and the implementation details.

7.  **Output Format:** Respond ONLY with a single JSON object matching the refinedToolDefinitionSchema.
</instructions>

<constraint_checklist>
1. Implementation type correctly determined? Yes
2. Is the 'implementationType' field in the output JSON correctly set? Yes
3. For API/Function, is 'implementation' a valid string? For Scraping, is 'implementation' a valid JSON object? Yes
4. Tool 'inputs' align with implementation needs (API params, function args, scraping template/query args)? Yes
5. Added required credentials to 'requiredCredentialNames' if needed? Yes/NA
6. Final definition and implementation are consistent? Yes
7. Confidence Score (1-5): [Score]
</constraint_checklist>

--- TOOL INFORMATION FOLLOWS ---

<tool_details>
*   Name: ${request.name}
*   Description: ${request.description}
*   Purpose: ${request.purpose || request.description}
*   Input Parameters (Initial):
${parametersString}
*   Expected Output (Initial): ${request.expectedOutput}
</tool_details>

<accepted_strategy>
${acceptedStrategyString}
</accepted_strategy>

${request.additionalContext ? `<additional_context>\n${request.additionalContext}\n</additional_context>` : ''}

<current_implementation>
${request.implementation ? `\`\`\`javascript\n${request.implementation}\n\`\`\`` : '(None provided - generate from scratch)'}
</current_implementation>

${request.modificationRequests && request.modificationRequests.length > 0 ? `<modification_requests>\n*   ${request.modificationRequests.join('\n*   ')}\n</modification_requests>` : ''}

Provide ONLY the JSON output matching the schema.
`,
};
