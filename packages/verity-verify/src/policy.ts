/**
 * Verity Policy Engine
 * Context-aware policy evaluation for workflow decisions
 */

import * as fs from 'fs';
import * as path from 'path';
import yaml from 'js-yaml';
import type {
  WorkflowPolicy,
  PolicyContext,
  PolicyRule,
  ContextDecision,
  ContextPolicyDecision,
} from './types.js';

// ============================================================================
// Policy Loading
// ============================================================================

/**
 * Load a policy from a YAML file
 * @param filePath - Path to policy YAML file
 * @returns Parsed policy
 */
export function loadPolicy(filePath: string): WorkflowPolicy {
  const content = fs.readFileSync(filePath, 'utf-8');
  const policy = yaml.load(content) as WorkflowPolicy;
  validatePolicy(policy);
  return policy;
}

/**
 * Load all policies from a directory
 * @param dirPath - Path to policies directory
 * @returns Map of workflow name to policy
 */
export function loadPolicies(dirPath: string): Map<string, WorkflowPolicy> {
  const policies = new Map<string, WorkflowPolicy>();

  if (!fs.existsSync(dirPath)) {
    return policies;
  }

  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    if (file.endsWith('.yaml') || file.endsWith('.yml')) {
      const filePath = path.join(dirPath, file);
      try {
        const policy = loadPolicy(filePath);
        policies.set(policy.workflow_name, policy);
      } catch (err) {
        console.warn(`Failed to load policy ${file}:`, (err as Error).message);
      }
    }
  }

  return policies;
}

/**
 * Validate a policy object
 * @param policy - Policy to validate
 * @throws Error if invalid
 */
export function validatePolicy(policy: WorkflowPolicy): void {
  if (!policy.workflow_name) {
    throw new Error('Policy missing workflow_name');
  }
  if (!policy.version) {
    throw new Error('Policy missing version');
  }
  if (typeof policy.min_confidence !== 'number') {
    throw new Error('Policy missing or invalid min_confidence');
  }
  if (typeof policy.require_human_origin !== 'boolean') {
    throw new Error('Policy missing or invalid require_human_origin');
  }
  if (typeof policy.require_transparency_log !== 'boolean') {
    throw new Error('Policy missing or invalid require_transparency_log');
  }
  if (!Array.isArray(policy.decision_rules)) {
    throw new Error('Policy missing or invalid decision_rules');
  }
}

// ============================================================================
// Condition Evaluation
// ============================================================================

/**
 * Evaluate a simple condition expression
 * Supports: confidence < N, confidence >= N, human_origin == YES/NO,
 *           integrity_ok == true/false, has_log == true/false, log_ok == true/false
 *
 * @param condition - Condition string
 * @param context - Evaluation context
 * @returns True if condition matches
 */
export function evaluateCondition(condition: string, context: PolicyContext): boolean {
  const trimmed = condition.trim().toLowerCase();

  // Always match
  if (trimmed === 'true' || trimmed === 'default') {
    return true;
  }

  // IMPORTANT: Check compound conditions FIRST (before simple pattern matches)
  // Compound: AND
  if (trimmed.includes(' and ')) {
    const parts = trimmed.split(' and ');
    return parts.every((part) => evaluateCondition(part, context));
  }

  // Compound: OR
  if (trimmed.includes(' or ')) {
    const parts = trimmed.split(' or ');
    return parts.some((part) => evaluateCondition(part, context));
  }

  // Confidence comparisons
  const confidenceMatch = trimmed.match(
    /^confidence\s*(>=|<=|>|<|==|!=)\s*(\d+)$/
  );
  if (confidenceMatch) {
    const op = confidenceMatch[1];
    const value = parseInt(confidenceMatch[2], 10);
    const score = context.confidence.score;

    switch (op) {
      case '>=':
        return score >= value;
      case '<=':
        return score <= value;
      case '>':
        return score > value;
      case '<':
        return score < value;
      case '==':
        return score === value;
      case '!=':
        return score !== value;
    }
  }

  // Human origin checks
  if (trimmed.includes('human_origin')) {
    const yesMatch = trimmed.match(/human_origin\s*==\s*(yes|true)/);
    if (yesMatch) {
      return context.humanOrigin.value === 'YES';
    }
    const noMatch = trimmed.match(/human_origin\s*==\s*(no|false)/);
    if (noMatch) {
      return context.humanOrigin.value === 'NO';
    }
    const unavailMatch = trimmed.match(/human_origin\s*==\s*unavailable/);
    if (unavailMatch) {
      return context.humanOrigin.value === 'UNAVAILABLE';
    }
    const notYesMatch = trimmed.match(/human_origin\s*!=\s*(yes|true)/);
    if (notYesMatch) {
      return context.humanOrigin.value !== 'YES';
    }
  }

  // Integrity checks
  if (trimmed === 'integrity_ok' || trimmed === 'integrity_ok == true') {
    return (
      context.integrity.payload_hash_ok &&
      context.integrity.manifest_signature_ok &&
      context.integrity.event_chain_ok
    );
  }
  if (trimmed === '!integrity_ok' || trimmed === 'integrity_ok == false') {
    return !(
      context.integrity.payload_hash_ok &&
      context.integrity.manifest_signature_ok &&
      context.integrity.event_chain_ok
    );
  }

  // Log checks
  if (trimmed === 'has_log' || trimmed === 'has_log == true') {
    return context.hasLogProof;
  }
  if (trimmed === '!has_log' || trimmed === 'has_log == false') {
    return !context.hasLogProof;
  }
  if (trimmed === 'log_ok' || trimmed === 'log_ok == true') {
    return context.logProofValid === true;
  }
  if (trimmed === '!log_ok' || trimmed === 'log_ok == false') {
    return context.logProofValid === false;
  }

  // Unknown condition - don't match
  console.warn(`Unknown condition: ${condition}`);
  return false;
}

// ============================================================================
// Policy Evaluation
// ============================================================================

/**
 * Evaluate a policy against a context
 * @param policy - The policy to evaluate
 * @param context - The evaluation context
 * @returns Policy decision
 */
export function evaluatePolicy(
  policy: WorkflowPolicy,
  context: PolicyContext
): ContextPolicyDecision {
  const matchedRules: string[] = [];

  // Check hard requirements first

  // If integrity is broken, always block
  const integrityOk =
    context.integrity.payload_hash_ok &&
    context.integrity.manifest_signature_ok &&
    context.integrity.event_chain_ok;

  if (!integrityOk) {
    return {
      workflow: policy.workflow_name,
      decision: 'BLOCK',
      policy_version: policy.version,
      rationale: 'Cryptographic integrity check failed',
      matched_rules: ['integrity_failure'],
    };
  }

  // Check human origin requirement
  if (policy.require_human_origin && context.humanOrigin.value !== 'YES') {
    return {
      workflow: policy.workflow_name,
      decision: 'REQUIRE_EXTRA_VERIFICATION',
      policy_version: policy.version,
      rationale: `Workflow requires human origin proof but got: ${context.humanOrigin.value}`,
      matched_rules: ['require_human_origin'],
    };
  }

  // Check transparency log requirement
  if (policy.require_transparency_log && !context.hasLogProof) {
    return {
      workflow: policy.workflow_name,
      decision: 'WARN',
      policy_version: policy.version,
      rationale: 'Workflow requires transparency log but no log proof present',
      matched_rules: ['require_transparency_log'],
    };
  }

  if (policy.require_transparency_log && context.logProofValid === false) {
    return {
      workflow: policy.workflow_name,
      decision: 'REQUIRE_EXTRA_VERIFICATION',
      policy_version: policy.version,
      rationale: 'Transparency log proof is invalid',
      matched_rules: ['invalid_log_proof'],
    };
  }

  // Evaluate decision rules in order (custom rules take precedence over min_confidence)
  for (const rule of policy.decision_rules) {
    if (evaluateCondition(rule.condition, context)) {
      matchedRules.push(rule.id);
      return {
        workflow: policy.workflow_name,
        decision: rule.decision,
        policy_version: policy.version,
        rationale: rule.rationale,
        matched_rules: matchedRules,
      };
    }
  }

  // Check minimum confidence (fallback when no custom rules matched)
  if (context.confidence.score < policy.min_confidence) {
    return {
      workflow: policy.workflow_name,
      decision: 'WARN',
      policy_version: policy.version,
      rationale: `Confidence score ${context.confidence.score} is below minimum ${policy.min_confidence}`,
      matched_rules: ['min_confidence'],
    };
  }

  // Default: ALLOW if all requirements met
  return {
    workflow: policy.workflow_name,
    decision: 'ALLOW',
    policy_version: policy.version,
    rationale: 'All requirements satisfied',
    matched_rules: ['default_allow'],
  };
}

// ============================================================================
// Default Policy
// ============================================================================

/**
 * Default policy for unknown workflows
 */
export const defaultPolicy: WorkflowPolicy = {
  workflow_name: 'default',
  description: 'Default policy for unspecified workflows',
  version: '1.0',
  min_confidence: 50,
  require_human_origin: false,
  require_transparency_log: false,
  decision_rules: [
    {
      id: 'critical_failure',
      condition: 'confidence < 20',
      decision: 'BLOCK',
      rationale: 'Confidence too low for any use',
    },
    {
      id: 'low_confidence',
      condition: 'confidence < 50',
      decision: 'WARN',
      rationale: 'Below minimum confidence threshold',
    },
    {
      id: 'allow',
      condition: 'default',
      decision: 'ALLOW',
      rationale: 'Default allow for acceptable confidence',
    },
  ],
};
