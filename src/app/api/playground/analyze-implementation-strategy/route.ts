import { NextResponse, NextRequest } from 'next/server';
import { logger } from '@/src/lib/logger';
import { consultationRequestSchema, ConsultationHistory, ConsultationRound } from './_types';
import { analyzeAndVerifyStrategy, updateConsultationHistory } from './_core/consultant_logic';
import { ToolRequest } from '@/src/lib/types';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        logger.info("API Route: Received request to analyze implementation strategy", { userId: body?.userId, toolName: body?.currentToolRequest?.name });

        // 1. Validate Request Body
        const validationResult = consultationRequestSchema.safeParse(body);
        if (!validationResult.success) {
            logger.warn("API Route: Invalid request format", { errors: validationResult.error.flatten() });
            return NextResponse.json({ error: "Invalid request format.", details: validationResult.error.flatten() }, { status: 400 });
        }

        const {
            userId,
            currentToolRequest: parsedToolRequest,
            consultationHistory: initialHistory,
            newStrategyModifications,
            modelArgs
        } = validationResult.data;

        // --- TODO: Add User Authorization Check if necessary ---
        // Ensure the requesting user (e.g., from session) matches `userId` or has permissions

        // 2. Explicitly map/cast parsed data to ensure compatibility with ToolRequest
        //    Focus on the 'examples' field identified by the error message.
        const toolRequestForAnalysis: ToolRequest = {
            ...parsedToolRequest,
            // Ensure the examples array structure matches ToolRequest['examples']
            // Specifically, ensure 'output' is present as required by ToolRequest.
            examples: parsedToolRequest.examples?.map(ex => ({
                input: ex.input,
                output: ex.output ?? null // Default 'output' to null if it's undefined in parsed data
            })),
        };

        // 3. Perform Analysis & Verification (Call orchestrator)
        const {
            finalAnalysisResult,
            finalVerificationResult,
            attemptHistory
        } = await analyzeAndVerifyStrategy(
            toolRequestForAnalysis,
            initialHistory,
            newStrategyModifications,
            modelArgs
        );

        // 4. Prepare Final History & Latest Round for Response
        const finalHistory = [...initialHistory, ...attemptHistory];
        const latestRoundResult = finalHistory[finalHistory.length - 1];

        // *** Ensure latestRoundResult exists before returning (edge case safeguard) ***
        if (!latestRoundResult) {
             logger.error("API Route: No latest round result found after analysis.", { userId, toolName: toolRequestForAnalysis.name });
             return NextResponse.json({ error: "Internal server error: Analysis did not produce a result." }, { status: 500 });
        }

        logger.info("API Route: Successfully analyzed implementation strategy", { toolName: toolRequestForAnalysis.name, userId });

        // 5. Return Response using final results
        return NextResponse.json({
            latestRound: latestRoundResult,
            updatedHistory: finalHistory,
        });

    } catch (error) {
        logger.error("API Route: Error analyzing implementation strategy:", { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined });
        // Consider more specific error responses based on where the error occurred (analysis, verification)
        return NextResponse.json({ error: "Internal server error during analysis." }, { status: 500 });
    }
}
