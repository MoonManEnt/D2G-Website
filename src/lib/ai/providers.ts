/**
 * AI SDK Provider Configuration
 *
 * Centralized provider configuration wrapping the Vercel AI SDK.
 * Supports Claude (primary) and OpenAI (fallback).
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

// Singleton provider instances (reused across requests)
let _anthropic: ReturnType<typeof createAnthropic> | null = null;
let _openai: ReturnType<typeof createOpenAI> | null = null;

function getAnthropicProvider() {
  if (!_anthropic) {
    _anthropic = createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return _anthropic;
}

function getOpenAIProvider() {
  if (!_openai) {
    _openai = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return _openai;
}

/**
 * Get a language model instance by provider and model name.
 */
export function getModel(provider: "CLAUDE" | "OPENAI", modelName: string): LanguageModel {
  if (provider === "CLAUDE") {
    return getAnthropicProvider()(modelName);
  }
  return getOpenAIProvider()(modelName);
}

/**
 * Check if any AI provider is available (has API key configured).
 */
export function isAIAvailable(): boolean {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);
}

/**
 * Check if a specific provider is available.
 */
export function isProviderAvailable(provider: "CLAUDE" | "OPENAI"): boolean {
  if (provider === "CLAUDE") return !!process.env.ANTHROPIC_API_KEY;
  return !!process.env.OPENAI_API_KEY;
}
