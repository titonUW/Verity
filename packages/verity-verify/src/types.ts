/**
 * Verity Verify Types
 * Type definitions for the verification engine
 */

import type {
  VerityContainer,
  TrustReport,
  ConfidenceSignal,
  HumanOriginProof,
  RealityConfidence,
  ContextPolicyDecision,
  IntegrityResult,
  ContextDecision,
} from '@verity/file';

// Re-export commonly used types
export type {
  TrustReport,
  ConfidenceSignal,
  HumanOriginProof,
  RealityConfidence,
  ContextPolicyDecision,
  IntegrityResult,
  ContextDecision,
};

// ============================================================================
// Signal Plugin Types
// ============================================================================

/**
 * Context passed to signal plugins
 */
export interface SignalContext {
  /** The container being analyzed */
  container: VerityContainer;
  /** Pre-computed integrity results */
  integrity: IntegrityResult;
  /** Set of trusted capture device key IDs */
  trustedCaptureKeyIds?: Set<string>;
  /** Set of trusted signer key IDs */
  trustedSignerKeyIds?: Set<string>;
}

/**
 * Interface for confidence signal plugins
 */
export interface SignalPlugin {
  /** Unique name for this signal */
  name: string;
  /** Human-readable description */
  description: string;
  /** Run the signal analysis */
  analyze(context: SignalContext): Promise<ConfidenceSignal>;
}

// ============================================================================
// Policy Types
// ============================================================================

/**
 * Policy rule definition
 */
export interface PolicyRule {
  /** Rule identifier */
  id: string;
  /** Condition (simplified expression) */
  condition: string;
  /** Decision if condition matches */
  decision: ContextDecision;
  /** Human-readable rationale */
  rationale: string;
}

/**
 * Workflow policy definition
 */
export interface WorkflowPolicy {
  /** Unique workflow name */
  workflow_name: string;
  /** Human-readable description */
  description: string;
  /** Policy version */
  version: string;
  /** Minimum confidence score required */
  min_confidence: number;
  /** Whether human origin proof is required */
  require_human_origin: boolean;
  /** Whether transparency log is required */
  require_transparency_log: boolean;
  /** Ordered list of rules (first match wins) */
  decision_rules: PolicyRule[];
}

/**
 * Context for policy evaluation
 */
export interface PolicyContext {
  /** Human origin proof result */
  humanOrigin: HumanOriginProof;
  /** Reality confidence result */
  confidence: RealityConfidence;
  /** Integrity result */
  integrity: IntegrityResult;
  /** Has log proof */
  hasLogProof: boolean;
  /** Log proof valid (if present) */
  logProofValid: boolean | null;
}

// ============================================================================
// Engine Types
// ============================================================================

export interface VerifyEngineConfig {
  /** Signal plugins to use */
  signals?: SignalPlugin[];
  /** Trusted capture device key IDs */
  trustedCaptureKeyIds?: Set<string>;
  /** Trusted signer key IDs */
  trustedSignerKeyIds?: Set<string>;
  /** Log public key for verification */
  logPublicKey?: string;
}

export interface VerifyOptions {
  /** Workflow name for policy evaluation */
  workflow?: string;
  /** Path to policy directory */
  policyDir?: string;
}
