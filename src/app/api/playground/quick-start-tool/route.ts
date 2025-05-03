import { NextResponse, NextRequest } from 'next/server';
import { logger } from '@/src/lib/logger';
import { z } from 'zod';
import { generateObject } from 'ai';
import { MODEL_getModel_ai } from '@/src/lib/vercelAI-model-switcher';
import { UTILS_getModelArgsByName, UTILS_getModelsJSON } from '@/src/lib/utils';
import { ToolRequest } from '@/src/lib/types'; // Use the main ToolRequest type

// Schema for the minimal input request from the UI
const quickStartInputSchema = z.object({
    userId: z.string().optional(), // **** ADDED: Accept optional userId ****
    toolName: z.string().min(1, "Tool name idea is required"),
    toolDescription: z.string().min(1, "Brief description is required"),
    suggestedInputs: z.array(z.string()).min(1, "At least one suggested input is required"),
    suggestedOutputs: z.array(z.string()).min(1, "At least one suggested output is required"),
    // toolGroup: z.string().optional(), // Optional
});

// Schema for the desired output structure (matches ToolRequest, minus implementation)
const generatedToolRequestSchema = z.object({
    name: z.string().describe("A concise, descriptive, and unique name for the tool (e.g., PDF_TEXT_EXTRACTOR, IMAGE_RESIZER). Use uppercase and underscores."),
    description: z.string().describe("A clear, one-sentence description of what the tool does."),
    purpose: z.string().describe("A more detailed explanation of the tool's purpose and use case (2-3 sentences)."),
    inputs: z.array(z.object({
        name: z.string().describe("Parameter name (camelCase or snake_case)."),
        type: z.enum(["string", "number", "boolean", "array", "object"]).describe("Parameter data type."),
        description: z.string().describe("Clear description of the parameter."),
        required: z.boolean().optional().describe("Is the parameter required? (Default: true)"),
        default: z.any().optional().describe("Optional default value if not required.")
    })).describe("An array of detailed input parameter objects."),
    expectedOutput: z.string().describe("A concise description of the primary output or return value format (e.g., 'A JSON string containing the extracted text', 'URL of the resized image', 'Boolean indicating success')."),
    // category: z.string().optional().describe("A category for the tool (e.g., FILE_OPERATIONS, DATA_ANALYSIS)."),
    // additionalContext: z.string().optional().describe("Any other relevant context or notes."),
    // examples: z.array(z.object({ ... })).optional().describe("Optional usage examples.") // Add examples later if needed
});


// Helper function to create the prompt
function createQuickStartPrompt(input: z.infer<typeof quickStartInputSchema>): string {
    // Using JSON stringify for Zod schema shape might not be ideal, let's describe it manually
    const outputSchemaDescription = `{
  name: string, // Formal tool name (UPPER_SNAKE_CASE)
  description: string, // Concise one-sentence description
  purpose: string, // 2-3 sentence use case description
  inputs: Array<{name: string, type: 'string'|'number'|'boolean'|'array'|'object', description: string, required?: boolean, default?: any}>,
  expectedOutput: string // Description of the successful output format
}`;

    return `
<TASK>
Based on the user's basic tool concept, generate a detailed and well-structured tool definition request.
Expand on the user's ideas to create clear, usable parameters and descriptions suitable for an AI agent tool.
</TASK>

<USER_CONCEPT>
Tool Name Idea: ${input.toolName}
Brief Description: ${input.toolDescription}
Suggested Inputs:
${input.suggestedInputs.map(i => `- ${i}`).join('\n')}
Suggested Outputs:
${input.suggestedOutputs.map(o => `- ${o}`).join('\n')}
</USER_CONCEPT>

<OUTPUT_STRUCTURE>
Generate a JSON object conforming to the following structure:
\`\`\`typescript
${outputSchemaDescription}
\`\`\`
</OUTPUT_STRUCTURE>

<INSTRUCTIONS>
1.  **name**: Create a formal, unique tool name (uppercase, underscores).
2.  **description**: Refine the user's description into a concise sentence.
3.  **purpose**: Elaborate on the description, explaining the use case (2-3 sentences).
4.  **inputs**:
    *   Convert *each* suggested input into a detailed parameter object.
    *   Infer the most likely \`type\` (string, number, boolean, etc.).
    *   Write a clear \`description\` for each parameter.
    *   Determine if each parameter should be \`required\` (usually true unless specified otherwise, like 'optional' in the suggestion).
    *   Add \`default\` values only if logical and the parameter is not required.
5.  **expectedOutput**: Describe the main successful return value clearly and concisely.
6.  Think critically about standard use cases for such a tool to generate realistic parameters.
</INSTRUCTIONS>

Generate ONLY the JSON object matching the specified output structure.
`;
}


export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        logger.info("API: Received request for Quick Start tool generation", { userId: body?.userId });

        const validationResult = quickStartInputSchema.safeParse(body);
        if (!validationResult.success) {
            logger.warn("API: Invalid request format for Quick Start", { errors: validationResult.error.flatten() });
            return NextResponse.json({ error: "Invalid Quick Start request format.", details: validationResult.error.flatten() }, { status: 400 });
        }
        const quickStartInput = validationResult.data;
        const userId = quickStartInput.userId; // Extract userId

        // Prepare the prompt for the LLM
        const prompt = createQuickStartPrompt(quickStartInput);

        // Choose a capable model for generation
        // TODO: Make model configurable
        const modelArgs = UTILS_getModelArgsByName(UTILS_getModelsJSON().Anthropic["claude-3-5-sonnet-20240620"].name);
        const model = await MODEL_getModel_ai(modelArgs);

        // Generate the structured ToolRequest object
        const generatedResult = await generateObject({
            model: model,
            schema: generatedToolRequestSchema,
            prompt: prompt,
        });

        const generatedToolRequest = generatedResult.object;

        // Add back any legacy fields if needed, although the UI should adapt
        // The UI expects ToolRequest, ensure compatibility
        const finalToolRequest: ToolRequest = {
            ...generatedToolRequest,
            // Ensure required ToolRequest fields are present if not generated
            inputs: generatedToolRequest.inputs || [],
            expectedOutput: generatedToolRequest.expectedOutput || "No output description generated.",
            // Add legacy fields for broader compatibility if necessary
            toolName: generatedToolRequest.name,
            toolDescription: generatedToolRequest.description,
            suggestedInputs: generatedToolRequest.inputs?.map(i => i.name) || [], // Map back for potential legacy use
            suggestedOutputs: generatedToolRequest.expectedOutput ? [generatedToolRequest.expectedOutput] : [] // Simplified mapping
        };


        logger.info("API: Successfully generated tool structure via Quick Start", { toolName: finalToolRequest.name, requestingUserId: userId });

        // Return the generated structure
        return NextResponse.json({ toolRequest: finalToolRequest });

    } catch (error) {
        logger.error("API Error during Quick Start tool generation:", { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json({ error: "Internal server error during Quick Start tool generation." }, { status: 500 });
    }
}