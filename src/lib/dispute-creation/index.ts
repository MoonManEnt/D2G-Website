/**
 * Unified Dispute Creation Module
 *
 * This module consolidates three dispute creation flows into a unified API:
 * - simple: Template-based dispute creation
 * - ai: AI-powered strategy and letter generation
 * - amelia: AMELIA doctrine letter generation
 *
 * Key improvements:
 * 1. Single source of truth: Letter content stored in Document, not Dispute.letterContent
 * 2. Consistent aiStrategy field across all paths
 * 3. Shared validation and utility functions
 * 4. Type-safe interfaces for all request/response types
 */

// Types
export * from "./types";

// Validation utilities
export * from "./validation";

// Letter generation strategies
export * from "./letter-strategies";

// Main creation function
export { createUnifiedDispute } from "./create-dispute";
