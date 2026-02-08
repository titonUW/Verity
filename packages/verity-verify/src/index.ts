/**
 * @verity/verify
 *
 * Verity verification engine producing Trust Reports with
 * human origin determination, confidence scoring, and policy evaluation.
 */

// Types
export type {
  TrustReport,
  ConfidenceSignal,
  HumanOriginProof,
  RealityConfidence,
  ContextPolicyDecision,
  IntegrityResult,
  ContextDecision,
  SignalPlugin,
  SignalContext,
  WorkflowPolicy,
  PolicyRule,
  PolicyContext,
  VerifyEngineConfig,
  VerifyOptions,
} from './types.js';

// Signal plugins
export {
  payloadHashSignal,
  signatureSignal,
  eventChainSignal,
  captureEventSignal,
  aiEditSignal,
  timestampSignal,
  transparencyLogSignal,
  metadataSanitySignal,
  defaultSignals,
  computeConfidence,
} from './signals.js';

// Policy engine
export {
  loadPolicy,
  loadPolicies,
  validatePolicy,
  evaluateCondition,
  evaluatePolicy,
  defaultPolicy,
} from './policy.js';

// Verification engine
export { VerityVerifyEngine, createVerifyEngine } from './engine.js';

// Server
export { createVerifyServer, startVerifyServer, type VerifyServerConfig } from './server.js';
