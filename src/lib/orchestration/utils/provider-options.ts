import { AgentComponentProps, ModelProviderEnum } from "@/src/lib/types";
import { logger } from "@/src/lib/logger";

/**
 * Determines provider-specific options based on the agent's configuration.
 * Currently handles enabling Anthropic 'thinking' mode for specific models.
 *
 * @param agentConfig The configuration of the agent.
 * @returns An object containing provider-specific options, or an empty object if none apply.
 */
export function ORCHESTRATION_getProviderOptions(
    agentConfig: AgentComponentProps
): Record<string, any> { // Using Record<string, any> for flexibility
    
    let providerOptions = {};

    // Enable Anthropic thinking ONLY for claude-3-7-sonnet-20250219
    if (agentConfig.modelArgs.provider === ModelProviderEnum.ANTHROPIC && 
        agentConfig.modelArgs.modelName === "claude-3-7-sonnet-20250219") {
        providerOptions = {
            anthropic: { 
                // Enable thinking mode with a token budget
                thinking: { type: "enabled", budgetTokens: agentConfig.modelArgs.maxInputTokens ?? 12000 }, 
            },
        };
        logger.log(`Enabled Anthropic thinking for agent ${agentConfig.name} (model: claude-3-7-sonnet-20250219)`);
    }

    // --- Add other provider-specific logic here --- //
    // Example:
    // if (agentConfig.modelArgs.provider === ModelProviderEnum.GOOGLE) { ... }

    return providerOptions;
} 