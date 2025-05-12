import { NextResponse, NextRequest } from 'next/server';
import { logger } from '@/src/lib/logger';
import { apiConsultationRequestZodSchema, ConsultationHistory, ConsultationRound, ApiConsultationRequest as ConsultationRequestType } from './_types';
import { analyzeAndVerifyStrategy, updateConsultationHistory } from './_core/consultant_logic';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        logger.info("API Route: Received request to analyze implementation strategy", { userId: body?.userId, toolName: body?.currentToolRequest?.name });

        // 1. Validate Request Body
        const validationResult = apiConsultationRequestZodSchema.safeParse(body);
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

        // 2. Use the parsedToolRequest which is already of type ConsultationRequest['currentToolRequest']
        // The mapping for examples is a safeguard for the output optionality issue.
        const toolRequestForConsultation: ConsultationRequestType['currentToolRequest'] = {
            ...parsedToolRequest,
            examples: parsedToolRequest.examples?.map((ex: { input: Record<string, any>; output?: any; }) => ({
                input: ex.input,
                output: ex.output ?? null // Default output if undefined, to satisfy stricter interpretations
            })),
        };

        // 3. Perform Analysis & Verification (Call orchestrator)
        const {
            finalAnalysisResult,
            finalVerificationResult,
            attemptHistory
        } = await analyzeAndVerifyStrategy(
            toolRequestForConsultation,
            initialHistory,
            newStrategyModifications,
            modelArgs
        );

        // 4. Prepare Final History & Latest Round for Response
        const finalHistory = [...initialHistory, ...attemptHistory];
        const latestRoundResult = finalHistory[finalHistory.length - 1];

        // *** Ensure latestRoundResult exists before returning (edge case safeguard) ***
        if (!latestRoundResult) {
             logger.error("API Route: No latest round result found after analysis.", { userId, toolName: toolRequestForConsultation.name });
             return NextResponse.json({ error: "Internal server error: Analysis did not produce a result." }, { status: 500 });
        }

        logger.info("API Route: Successfully analyzed implementation strategy", { toolName: toolRequestForConsultation.name, userId });

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
