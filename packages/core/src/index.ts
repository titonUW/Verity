/**
 * @verity/core
 *
 * Shared types and schemas for the Verity AI content authenticity platform.
 * This package provides Zod schemas for request/response validation and
 * TypeScript types for the entire platform.
 */

// Export all schemas
export * from './schemas/index.js';

// Export all types
export * from './types/index.js';

// Utility functions
export { calibrateConfidence, verdictFromConfidence, aggregateVerdicts } from './utils.js';
