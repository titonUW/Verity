/**
 * Policy Engine Tests
 */

import { describe, it, expect } from 'vitest';
import { evaluateCondition, evaluatePolicy, defaultPolicy } from './policy.js';
import type { PolicyContext, WorkflowPolicy } from './types.js';

describe('Policy Engine', () => {
  describe('evaluateCondition', () => {
    const baseContext: PolicyContext = {
      humanOrigin: {
        value: 'YES',
        reason: 'test',
        evidence: {
          has_capture_event: true,
          capture_key_trusted: true,
          has_ai_edit_event: false,
          event_chain_valid: true,
        },
      },
      confidence: {
        score: 75,
        reasons: [],
        limitations: 'test',
      },
      integrity: {
        payload_hash_ok: true,
        manifest_signature_ok: true,
        event_chain_ok: true,
        transparency_log_ok: true,
        errors: [],
      },
      hasLogProof: true,
      logProofValid: true,
    };

    it('should evaluate true/default conditions', () => {
      expect(evaluateCondition('true', baseContext)).toBe(true);
      expect(evaluateCondition('default', baseContext)).toBe(true);
    });

    it('should evaluate confidence comparisons', () => {
      expect(evaluateCondition('confidence >= 70', baseContext)).toBe(true);
      expect(evaluateCondition('confidence >= 80', baseContext)).toBe(false);
      expect(evaluateCondition('confidence < 80', baseContext)).toBe(true);
      expect(evaluateCondition('confidence < 70', baseContext)).toBe(false);
      expect(evaluateCondition('confidence == 75', baseContext)).toBe(true);
      expect(evaluateCondition('confidence != 75', baseContext)).toBe(false);
    });

    it('should evaluate human_origin conditions', () => {
      expect(evaluateCondition('human_origin == YES', baseContext)).toBe(true);
      expect(evaluateCondition('human_origin == NO', baseContext)).toBe(false);

      const noOriginContext = {
        ...baseContext,
        humanOrigin: { ...baseContext.humanOrigin, value: 'NO' as const },
      };
      expect(evaluateCondition('human_origin == NO', noOriginContext)).toBe(true);
      expect(evaluateCondition('human_origin != YES', noOriginContext)).toBe(true);
    });

    it('should evaluate integrity_ok conditions', () => {
      expect(evaluateCondition('integrity_ok', baseContext)).toBe(true);

      const brokenContext = {
        ...baseContext,
        integrity: { ...baseContext.integrity, payload_hash_ok: false },
      };
      expect(evaluateCondition('integrity_ok', brokenContext)).toBe(false);
      expect(evaluateCondition('!integrity_ok', brokenContext)).toBe(true);
    });

    it('should evaluate has_log conditions', () => {
      expect(evaluateCondition('has_log', baseContext)).toBe(true);
      expect(evaluateCondition('!has_log', baseContext)).toBe(false);

      const noLogContext = { ...baseContext, hasLogProof: false };
      expect(evaluateCondition('has_log', noLogContext)).toBe(false);
      expect(evaluateCondition('!has_log', noLogContext)).toBe(true);
    });

    it('should evaluate compound AND conditions', () => {
      expect(evaluateCondition('confidence >= 70 AND has_log', baseContext)).toBe(true);
      expect(evaluateCondition('confidence >= 80 AND has_log', baseContext)).toBe(false);
    });

    it('should evaluate compound OR conditions', () => {
      expect(evaluateCondition('confidence >= 80 OR has_log', baseContext)).toBe(true);
      expect(evaluateCondition('confidence >= 80 OR !has_log', baseContext)).toBe(false);
    });
  });

  describe('evaluatePolicy', () => {
    const goodContext: PolicyContext = {
      humanOrigin: {
        value: 'YES',
        reason: 'test',
        evidence: {
          has_capture_event: true,
          capture_key_trusted: true,
          has_ai_edit_event: false,
          event_chain_valid: true,
        },
      },
      confidence: {
        score: 85,
        reasons: [],
        limitations: 'test',
      },
      integrity: {
        payload_hash_ok: true,
        manifest_signature_ok: true,
        event_chain_ok: true,
        transparency_log_ok: true,
        errors: [],
      },
      hasLogProof: true,
      logProofValid: true,
    };

    it('should BLOCK on integrity failure', () => {
      const context = {
        ...goodContext,
        integrity: { ...goodContext.integrity, payload_hash_ok: false },
      };

      const result = evaluatePolicy(defaultPolicy, context);
      expect(result.decision).toBe('BLOCK');
      expect(result.matched_rules).toContain('integrity_failure');
    });

    it('should enforce require_human_origin', () => {
      const policy: WorkflowPolicy = {
        ...defaultPolicy,
        require_human_origin: true,
      };

      const context = {
        ...goodContext,
        humanOrigin: { ...goodContext.humanOrigin, value: 'NO' as const },
      };

      const result = evaluatePolicy(policy, context);
      expect(result.decision).toBe('REQUIRE_EXTRA_VERIFICATION');
      expect(result.matched_rules).toContain('require_human_origin');
    });

    it('should enforce require_transparency_log', () => {
      const policy: WorkflowPolicy = {
        ...defaultPolicy,
        require_transparency_log: true,
      };

      const context = {
        ...goodContext,
        hasLogProof: false,
      };

      const result = evaluatePolicy(policy, context);
      expect(result.decision).toBe('WARN');
      expect(result.matched_rules).toContain('require_transparency_log');
    });

    it('should enforce min_confidence', () => {
      // Policy without catch-all rule, so min_confidence acts as fallback
      const policy: WorkflowPolicy = {
        workflow_name: 'test',
        description: 'test',
        version: '1.0',
        min_confidence: 90,
        require_human_origin: false,
        require_transparency_log: false,
        decision_rules: [
          // No catch-all 'default' rule - min_confidence will trigger
        ],
      };

      const result = evaluatePolicy(policy, goodContext); // confidence: 85
      expect(result.decision).toBe('WARN');
      expect(result.matched_rules).toContain('min_confidence');
    });

    it('should ALLOW when all requirements met', () => {
      const result = evaluatePolicy(defaultPolicy, goodContext);
      expect(result.decision).toBe('ALLOW');
    });

    it('should evaluate custom decision rules', () => {
      const policy: WorkflowPolicy = {
        workflow_name: 'test',
        description: 'test',
        version: '1.0',
        min_confidence: 50,
        require_human_origin: false,
        require_transparency_log: false,
        decision_rules: [
          {
            id: 'high_confidence',
            condition: 'confidence >= 80',
            decision: 'ALLOW',
            rationale: 'High confidence',
          },
          {
            id: 'medium_confidence',
            condition: 'confidence >= 60',
            decision: 'WARN',
            rationale: 'Medium confidence',
          },
          {
            id: 'low_confidence',
            condition: 'default',
            decision: 'BLOCK',
            rationale: 'Too low',
          },
        ],
      };

      // High confidence
      const highResult = evaluatePolicy(policy, goodContext);
      expect(highResult.decision).toBe('ALLOW');
      expect(highResult.matched_rules).toContain('high_confidence');

      // Medium confidence
      const mediumContext = {
        ...goodContext,
        confidence: { ...goodContext.confidence, score: 65 },
      };
      const mediumResult = evaluatePolicy(policy, mediumContext);
      expect(mediumResult.decision).toBe('WARN');
      expect(mediumResult.matched_rules).toContain('medium_confidence');

      // Low confidence
      const lowContext = {
        ...goodContext,
        confidence: { ...goodContext.confidence, score: 40 },
      };
      const lowResult = evaluatePolicy(policy, lowContext);
      expect(lowResult.decision).toBe('BLOCK');
      expect(lowResult.matched_rules).toContain('low_confidence');
    });
  });
});
