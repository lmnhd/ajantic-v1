/**
 * Model configuration for AI services
 */

import { ModelProviderEnum } from "@/src/lib/types";

// Helper function to normalize provider enum values for compatibility
const normalizeProvider = (provider: ModelProviderEnum) => {
  return provider.toString().toLowerCase();
};

export const MODEL_CONFIG = {
  // Default models for different tasks
  DEFAULT: {
    modelName: "gpt-4o-mini",
    provider: ModelProviderEnum.OPENAI,
    providerValue: normalizeProvider(ModelProviderEnum.OPENAI),
    temperature: 0,
  },
  
  AGENT: {
    modelName: "gpt-4o",
    provider: ModelProviderEnum.OPENAI,
    providerValue: normalizeProvider(ModelProviderEnum.OPENAI),
    temperature: 0,
  },

  KNOWLEDGE_BASE: {
    modelName: "gpt-4o-mini",
    provider: ModelProviderEnum.OPENAI,
    providerValue: normalizeProvider(ModelProviderEnum.OPENAI),
    temperature: 0.5, // Slightly higher temperature for more creative research queries
  },

  SCRIPT_WRITER: {
    modelName: "gpt-4o",
    provider: ModelProviderEnum.OPENAI,
    providerValue: normalizeProvider(ModelProviderEnum.OPENAI),
    temperature: 0,
  },

  SCRIPT_EVALUATOR: {
    modelName: "gpt-4o",
    provider: ModelProviderEnum.OPENAI,
    providerValue: normalizeProvider(ModelProviderEnum.OPENAI),
    temperature: 0,
  },

  REQUIREMENTS_ANALYZER: {
    modelName: "gpt-4o-mini",
    provider: ModelProviderEnum.OPENAI,
    providerValue: normalizeProvider(ModelProviderEnum.OPENAI),
    temperature: 0.3,
  }
}; 