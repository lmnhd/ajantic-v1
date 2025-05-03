import { NextResponse, NextRequest } from 'next/server';
import { logger } from '@/src/lib/logger';
import { z } from 'zod';
import { generateObject } from 'ai';
import { MODEL_getModel_ai } from '@/src/lib/vercelAI-model-switcher';
import { UTILS_getModelArgsByName, UTILS_getModelsJSON } from '@/src/lib/utils';
import { ToolRequest, ToolInputParameter } from '@/src/lib/types'; // Use the main ToolRequest type

// Base schema for a single input parameter (reused)
const inputParameterSchema = z.object({
    name: z.string(),
    type: z.enum(["string", "number", "boolean", "array", "object"]),
    description: z.string(),
    required: z.boolean().optional(),
    default: z.any().optional()
});

// Schema for the structure to be refined (matches ToolRequest)
// Use passthrough to keep any extra fields from the original ToolRequest
const toolRequestSchema = z.object({
    name: z.string(),
    description: z.string(),
    purpose: z.string().optional(),
    inputs: z.array(inputParameterSchema),
    expectedOutput: z.string(),
    category: z.string().optional(),
    additionalContext: z.string().optional(),
    modificationRequests: z.array(z.string()).optional(), // Allow passing through
    examples: z.array(z.object({
        input: z.record(z.any()),
        output: z.any() // Explicitly non-optional to match ToolRequest expectation
    })).optional()
    // Include legacy fields if they exist in the ToolRequest type
}).passthrough(); // Allow other fields from ToolRequest type if necessary

// Schema for the incoming refinement request payload
const refinementRequestSchema = z.object({
    userId: z.string().optional(),
    currentStructure: toolRequestSchema,
    modifications: z.array(z.string()).min(1, "At least one modification request is required.")
});

// Schema for the AI model's desired output (focus on fields likely to be refined)
const refinedToolRequestSchema = z.object({
    name: z.string().describe("The refined tool name (e.g., PDF_TEXT_EXTRACTOR). Use uppercase and underscores."),
    description: z.string().describe("The refined one-sentence description."),
    purpose: z.string().describe("The refined 2-3 sentence purpose/use case."),
    inputs: z.array(inputParameterSchema).describe("The refined array of detailed input parameter objects."),
    expectedOutput: z.string().describe("The refined concise description of the primary output format."),
    // Note: We only ask the AI to return the core fields it's modifying.
    // Other fields like category, examples, etc., will be merged from the original structure later.
});

// Helper function to create the refinement prompt
function createRefinementPrompt(currentStructure: ToolRequest, modifications: string[]): string {
    // Describe the expected output structure clearly for the AI
    const outputSchemaDescription = `{
  name: string, // Refined formal tool name (UPPER_SNAKE_CASE)
  description: string, // Refined concise one-sentence description
  purpose: string, // Refined 2-3 sentence use case description
  inputs: Array<{name: string, type: 'string'|'number'|'boolean'|'array'|'object', description: string, required?: boolean, default?: any}>, // Refined parameters
  expectedOutput: string // Refined description of the successful output format
}`;

    return `
<TASK>
Refine the provided tool structure based *only* on the user's modification requests.
Do not add new parameters or change things not mentioned in the requests.
Return the *entire* modified tool structure for the specified fields (name, description, purpose, inputs, expectedOutput), ensuring it conforms to the specified output format.
</TASK>

<CURRENT_STRUCTURE>
${JSON.stringify(currentStructure, null, 2)}
</CURRENT_STRUCTURE>

<MODIFICATION_REQUESTS>
${modifications.map(m => `- ${m}`).join('\n')}
</MODIFICATION_REQUESTS>

<OUTPUT_STRUCTURE>
Generate a JSON object conforming to the following structure:
\`\`\`typescript
${outputSchemaDescription}
\`\`\`
</OUTPUT_STRUCTURE>

<INSTRUCTIONS>
1.  Carefully apply *each* modification request to the corresponding field(s) in the <CURRENT_STRUCTURE>.
2.  If a request is unclear or impossible, try your best to interpret the user's intent within the scope of the structure being modified.
3.  Return the *complete, updated* JSON object including name, description, purpose, inputs, and expectedOutput. Do not omit any of these fields, even if they were not explicitly modified.
4.  Maintain the correct data types for all fields.
5.  Focus ONLY on modifying the structure based on the requests. Do not generate implementation code.
</INSTRUCTIONS>

Generate ONLY the JSON object.
`;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        logger.info("API: Received request to refine tool structure", { userId: body?.userId });

        const validationResult = refinementRequestSchema.safeParse(body);
        if (!validationResult.success) {
            logger.warn("API: Invalid request format for structure refinement", { errors: validationResult.error.flatten() });
            return NextResponse.json({ error: "Invalid refinement request format.", details: validationResult.error.flatten() }, { status: 400 });
        }
        const { currentStructure, modifications, userId } = validationResult.data;

        // Prepare the prompt
        const prompt = createRefinementPrompt(currentStructure as ToolRequest, modifications);

        // Choose a model
        // TODO: Make model configurable
        const modelArgs = UTILS_getModelArgsByName(UTILS_getModelsJSON().Anthropic["claude-3-5-sonnet-20240620"].name);
        const model = await MODEL_getModel_ai(modelArgs);

        // Generate the refined structure
        const generatedResult = await generateObject({
            model: model,
            schema: refinedToolRequestSchema, // Expecting the refined structure
            prompt: prompt,
        });

        const refinedStructure = generatedResult.object;

        // Construct the final ToolRequest, merging refined fields with the original structure
        // This preserves fields the AI wasn't asked to refine (like category, legacy fields, examples, etc.)
        const finalRefinedToolRequest: ToolRequest = {
            ...(currentStructure as ToolRequest), // Start with original to preserve untouched fields
            ...refinedStructure, // Overwrite with refined fields (name, desc, purpose, inputs, expectedOutput)
            inputs: refinedStructure.inputs as ToolInputParameter[], // Ensure correct type
        };

        logger.info("API: Successfully refined tool structure", { toolName: finalRefinedToolRequest.name, requestingUserId: userId });

        // Return the refined structure
        return NextResponse.json({ refinedToolRequest: finalRefinedToolRequest });

    } catch (error) {
        logger.error("API Error during tool structure refinement:", { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json({ error: "Internal server error during tool structure refinement." }, { status: 500 });
    }
}
