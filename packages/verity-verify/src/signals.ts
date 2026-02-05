/**
 * Verity Confidence Signals
 * Plugin-based scoring system for reality confidence
 */

import type { ConfidenceSignal } from '@verity/file';
import type { SignalPlugin, SignalContext } from './types.js';

// ============================================================================
// Built-in Signal Plugins
// ============================================================================

/**
 * Signal 1: Payload Hash Verification
 * Critical - if this fails, the file is tampered
 */
export const payloadHashSignal: SignalPlugin = {
  name: 'payload_hash',
  description: 'Verifies payload matches manifest hash',
  async analyze(context: SignalContext): Promise<ConfidenceSignal> {
    const { integrity } = context;

    if (!integrity.payload_hash_ok) {
      return {
        name: 'payload_hash',
        score_delta: -100,
        severity: 'critical',
        explanation: 'Payload has been modified since signing - file is tampered',
        evidence: { payload_hash_ok: false },
      };
    }

    return {
      name: 'payload_hash',
      score_delta: 20,
      severity: 'info',
      explanation: 'Payload hash matches manifest - file is unmodified',
      evidence: { payload_hash_ok: true },
    };
  },
};

/**
 * Signal 2: Signature Verification
 * Critical - if this fails, provenance cannot be trusted
 */
export const signatureSignal: SignalPlugin = {
  name: 'signature',
  description: 'Verifies cryptographic signatures',
  async analyze(context: SignalContext): Promise<ConfidenceSignal> {
    const { integrity, container } = context;

    if (!integrity.manifest_signature_ok) {
      return {
        name: 'signature',
        score_delta: -100,
        severity: 'critical',
        explanation: 'Signature verification failed - provenance cannot be trusted',
        evidence: { manifest_signature_ok: false },
      };
    }

    const signatureCount = container.signatures.signatures.length;
    const bonus = Math.min(signatureCount * 5, 15); // Up to 15 bonus for multiple signatures

    return {
      name: 'signature',
      score_delta: 15 + bonus,
      severity: 'info',
      explanation: `${signatureCount} valid signature(s) verified`,
      evidence: {
        manifest_signature_ok: true,
        signature_count: signatureCount,
      },
    };
  },
};

/**
 * Signal 3: Event Chain Verification
 * High severity - broken chain indicates tampering or corruption
 */
export const eventChainSignal: SignalPlugin = {
  name: 'event_chain',
  description: 'Verifies provenance event chain integrity',
  async analyze(context: SignalContext): Promise<ConfidenceSignal> {
    const { integrity, container } = context;

    if (!integrity.event_chain_ok) {
      return {
        name: 'event_chain',
        score_delta: -50,
        severity: 'high',
        explanation: 'Event chain verification failed - provenance is broken',
        evidence: { event_chain_ok: false },
      };
    }

    const eventCount = container.events.events.length;

    if (eventCount === 0) {
      return {
        name: 'event_chain',
        score_delta: 0,
        severity: 'medium',
        explanation: 'No provenance events recorded',
        evidence: { event_chain_ok: true, event_count: 0 },
      };
    }

    return {
      name: 'event_chain',
      score_delta: 10,
      severity: 'info',
      explanation: `Event chain with ${eventCount} events verified`,
      evidence: {
        event_chain_ok: true,
        event_count: eventCount,
      },
    };
  },
};

/**
 * Signal 4: Capture Event Presence
 * Important for human origin determination
 */
export const captureEventSignal: SignalPlugin = {
  name: 'capture_event',
  description: 'Checks for CAPTURE event in provenance chain',
  async analyze(context: SignalContext): Promise<ConfidenceSignal> {
    const { container, trustedCaptureKeyIds } = context;
    const events = container.events.events;

    const captureEvent = events.find((e) => e.event_type === 'CAPTURE');

    if (!captureEvent) {
      return {
        name: 'capture_event',
        score_delta: -10,
        severity: 'medium',
        explanation: 'No CAPTURE event found - origin cannot be verified',
        evidence: { has_capture_event: false },
      };
    }

    // Check if first event
    const isFirst = events[0]?.event_id === captureEvent.event_id;
    if (!isFirst) {
      return {
        name: 'capture_event',
        score_delta: -5,
        severity: 'medium',
        explanation: 'CAPTURE event is not the first event in chain',
        evidence: { has_capture_event: true, is_first: false },
      };
    }

    // Check if trusted
    const isTrusted = trustedCaptureKeyIds?.has(captureEvent.actor_key_id) ?? false;

    if (isTrusted) {
      return {
        name: 'capture_event',
        score_delta: 20,
        severity: 'info',
        explanation: 'CAPTURE event from trusted device verified',
        evidence: {
          has_capture_event: true,
          is_first: true,
          is_trusted: true,
          key_id: captureEvent.actor_key_id,
        },
      };
    }

    return {
      name: 'capture_event',
      score_delta: 10,
      severity: 'low',
      explanation: 'CAPTURE event present but device not in trusted list',
      evidence: {
        has_capture_event: true,
        is_first: true,
        is_trusted: false,
        key_id: captureEvent.actor_key_id,
      },
    };
  },
};

/**
 * Signal 5: AI Edit Detection
 * High severity - AI edits may compromise authenticity
 */
export const aiEditSignal: SignalPlugin = {
  name: 'ai_edit',
  description: 'Detects AI_EDIT events in provenance chain',
  async analyze(context: SignalContext): Promise<ConfidenceSignal> {
    const { container } = context;
    const aiEditEvents = container.events.events.filter((e) => e.event_type === 'AI_EDIT');

    if (aiEditEvents.length > 0) {
      return {
        name: 'ai_edit',
        score_delta: -30,
        severity: 'high',
        explanation: `${aiEditEvents.length} AI edit event(s) detected - content may be AI-modified`,
        evidence: {
          has_ai_edit: true,
          ai_edit_count: aiEditEvents.length,
        },
      };
    }

    return {
      name: 'ai_edit',
      score_delta: 5,
      severity: 'info',
      explanation: 'No AI edit events detected',
      evidence: { has_ai_edit: false },
    };
  },
};

/**
 * Signal 6: Timestamp Sanity
 * Medium severity - future timestamps are suspicious
 */
export const timestampSignal: SignalPlugin = {
  name: 'timestamp',
  description: 'Verifies timestamps are sane',
  async analyze(context: SignalContext): Promise<ConfidenceSignal> {
    const { container } = context;
    const now = Date.now();
    const tolerance = 5 * 60 * 1000; // 5 minutes

    // Check manifest timestamp
    const createdAt = new Date(container.manifest.created_at).getTime();
    if (createdAt > now + tolerance) {
      return {
        name: 'timestamp',
        score_delta: -15,
        severity: 'medium',
        explanation: 'Container creation timestamp is in the future',
        evidence: {
          created_at: container.manifest.created_at,
          is_future: true,
        },
      };
    }

    // Check event timestamps
    const futureEvents = container.events.events.filter((e) => {
      const eventTime = new Date(e.event_time).getTime();
      return eventTime > now + tolerance;
    });

    if (futureEvents.length > 0) {
      return {
        name: 'timestamp',
        score_delta: -10,
        severity: 'medium',
        explanation: `${futureEvents.length} event(s) have future timestamps`,
        evidence: {
          future_event_count: futureEvents.length,
        },
      };
    }

    // Check timestamp ordering
    const events = container.events.events;
    for (let i = 1; i < events.length; i++) {
      const prevTime = new Date(events[i - 1].event_time).getTime();
      const currTime = new Date(events[i].event_time).getTime();
      if (currTime < prevTime) {
        return {
          name: 'timestamp',
          score_delta: -5,
          severity: 'low',
          explanation: 'Events are not in chronological order',
          evidence: { out_of_order: true },
        };
      }
    }

    return {
      name: 'timestamp',
      score_delta: 5,
      severity: 'info',
      explanation: 'All timestamps are valid and in order',
      evidence: { timestamps_valid: true },
    };
  },
};

/**
 * Signal 7: Transparency Log Presence
 * Important for external verifiability
 */
export const transparencyLogSignal: SignalPlugin = {
  name: 'transparency_log',
  description: 'Checks for transparency log proof',
  async analyze(context: SignalContext): Promise<ConfidenceSignal> {
    const { container, integrity } = context;

    if (!container.logProof) {
      return {
        name: 'transparency_log',
        score_delta: 0,
        severity: 'low',
        explanation: 'No transparency log proof present',
        evidence: { has_log_proof: false },
      };
    }

    if (integrity.transparency_log_ok === false) {
      return {
        name: 'transparency_log',
        score_delta: -20,
        severity: 'high',
        explanation: 'Transparency log proof is invalid',
        evidence: {
          has_log_proof: true,
          log_proof_valid: false,
        },
      };
    }

    return {
      name: 'transparency_log',
      score_delta: 15,
      severity: 'info',
      explanation: 'Content is recorded in transparency log',
      evidence: {
        has_log_proof: true,
        log_proof_valid: true,
        leaf_index: container.logProof.inclusion_proof.leaf_index,
      },
    };
  },
};

/**
 * Signal 8: File Metadata Sanity
 * Basic sanity checks on file properties
 */
export const metadataSanitySignal: SignalPlugin = {
  name: 'metadata_sanity',
  description: 'Performs basic file metadata sanity checks',
  async analyze(context: SignalContext): Promise<ConfidenceSignal> {
    const { container } = context;
    const manifest = container.manifest;
    const issues: string[] = [];

    // Check file size
    if (manifest.payload_size === 0) {
      issues.push('File is empty');
    } else if (manifest.payload_size > 1024 * 1024 * 1024) {
      issues.push('File is over 1GB - unusual for verified content');
    }

    // Check MIME type
    const validMimePattern = /^[a-z]+\/[a-z0-9.+-]+$/i;
    if (!validMimePattern.test(manifest.payload_mime)) {
      issues.push('Invalid MIME type format');
    }

    if (issues.length > 0) {
      return {
        name: 'metadata_sanity',
        score_delta: -5 * issues.length,
        severity: 'low',
        explanation: `Metadata issues: ${issues.join('; ')}`,
        evidence: { issues },
      };
    }

    return {
      name: 'metadata_sanity',
      score_delta: 5,
      severity: 'info',
      explanation: 'File metadata passes sanity checks',
      evidence: {
        size: manifest.payload_size,
        mime: manifest.payload_mime,
      },
    };
  },
};

// ============================================================================
// Default Signal Set
// ============================================================================

/**
 * Default set of signal plugins
 */
export const defaultSignals: SignalPlugin[] = [
  payloadHashSignal,
  signatureSignal,
  eventChainSignal,
  captureEventSignal,
  aiEditSignal,
  timestampSignal,
  transparencyLogSignal,
  metadataSanitySignal,
];

// ============================================================================
// Scoring Functions
// ============================================================================

/**
 * Compute reality confidence from signals
 * @param signals - Array of signal results
 * @returns Reality confidence with bounded score
 */
export function computeConfidence(signals: ConfidenceSignal[]): {
  score: number;
  reasons: ConfidenceSignal[];
  limitations: string;
} {
  // Start at 50 (neutral)
  let score = 50;

  for (const signal of signals) {
    score += signal.score_delta;
  }

  // Bound to 0-100
  score = Math.max(0, Math.min(100, score));

  // Generate limitations disclaimer
  const limitations =
    'This score is based on cryptographic verification and metadata analysis. ' +
    'It cannot detect sophisticated tampering that occurred before the content was wrapped. ' +
    'Human judgment should be applied for high-stakes decisions.';

  return {
    score,
    reasons: signals,
    limitations,
  };
}
