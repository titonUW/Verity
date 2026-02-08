/**
 * Verity Verification Engine
 * Core engine that produces Trust Reports
 */

import {
  verifyContainer,
  verifyPayloadAgainstManifest,
  validateEventChain,
  verifySignatures,
  generateId,
  computeContentHash,
  type VerityContainer,
  type TrustReport,
  type HumanOriginProof,
  type IntegrityResult,
} from '@verity/file';
import { verifyLogProof } from '@verity/log';
import { defaultSignals, computeConfidence } from './signals.js';
import { loadPolicies, evaluatePolicy, defaultPolicy } from './policy.js';
import type {
  SignalPlugin,
  WorkflowPolicy,
  VerifyEngineConfig,
  VerifyOptions,
  SignalContext,
  PolicyContext,
} from './types.js';

const ENGINE_VERSION = '0.1.0';

/**
 * Verity Verification Engine
 */
export class VerityVerifyEngine {
  private signals: SignalPlugin[];
  private trustedCaptureKeyIds: Set<string>;
  private trustedSignerKeyIds: Set<string>;
  private logPublicKey?: string;
  private policies: Map<string, WorkflowPolicy>;

  constructor(config: VerifyEngineConfig = {}) {
    this.signals = config.signals ?? defaultSignals;
    this.trustedCaptureKeyIds = config.trustedCaptureKeyIds ?? new Set();
    this.trustedSignerKeyIds = config.trustedSignerKeyIds ?? new Set();
    this.logPublicKey = config.logPublicKey;
    this.policies = new Map();
  }

  /**
   * Load policies from a directory
   * @param policyDir - Path to policies directory
   */
  loadPolicies(policyDir: string): void {
    const loaded = loadPolicies(policyDir);
    for (const [name, policy] of loaded) {
      this.policies.set(name, policy);
    }
  }

  /**
   * Add a trusted capture device key ID
   * @param keyId - Key ID to trust
   */
  addTrustedCaptureKey(keyId: string): void {
    this.trustedCaptureKeyIds.add(keyId);
  }

  /**
   * Set the log public key for verification
   * @param publicKey - Log's public key (hex)
   */
  setLogPublicKey(publicKey: string): void {
    this.logPublicKey = publicKey;
  }

  /**
   * Generate a complete Trust Report for a container
   * @param container - The container to verify
   * @param options - Verification options
   * @returns Trust Report
   */
  async verify(container: VerityContainer, options: VerifyOptions = {}): Promise<TrustReport> {
    // 1. Verify integrity
    const integrity = await this.verifyIntegrity(container);

    // 2. Determine human origin
    const humanOrigin = await this.determineHumanOrigin(container, integrity);

    // 3. Run signal plugins
    const signalContext: SignalContext = {
      container,
      integrity,
      trustedCaptureKeyIds: this.trustedCaptureKeyIds,
      trustedSignerKeyIds: this.trustedSignerKeyIds,
    };

    const signalResults = await Promise.all(
      this.signals.map((signal) => signal.analyze(signalContext))
    );

    // 4. Compute confidence
    const confidence = computeConfidence(signalResults);

    // 5. Evaluate policy
    const policyContext: PolicyContext = {
      humanOrigin,
      confidence,
      integrity,
      hasLogProof: !!container.logProof,
      logProofValid: integrity.transparency_log_ok,
    };

    const workflow = options.workflow ?? container.manifest.workflow_hint ?? 'default';
    const policy = this.policies.get(workflow) ?? defaultPolicy;
    const contextDecision = evaluatePolicy(policy, policyContext);

    // 6. Build Trust Report
    const report: TrustReport = {
      report_id: generateId(),
      schema_version: '1.0',
      generated_at: new Date().toISOString(),
      container_hash: '', // Will be set if container path is known
      human_origin_proof: humanOrigin,
      reality_confidence: confidence,
      context_decision: contextDecision,
      integrity,
      engine_version: ENGINE_VERSION,
    };

    return report;
  }

  /**
   * Verify container integrity
   */
  private async verifyIntegrity(container: VerityContainer): Promise<IntegrityResult> {
    const errors: string[] = [];

    // Payload hash
    const payloadResult = verifyPayloadAgainstManifest(container.payload, container.manifest);
    const payloadHashOk = payloadResult.valid;
    if (!payloadResult.valid) {
      errors.push(payloadResult.error!);
    }

    // Signatures
    const sigResult = await verifySignatures(
      container.manifest,
      container.events,
      container.signatures
    );
    const manifestSignatureOk = sigResult.valid;
    if (!sigResult.valid) {
      errors.push(...sigResult.errors);
    }

    // Event chain
    const eventResult = await validateEventChain(container.events);
    const eventChainOk = eventResult.valid;
    if (!eventResult.valid) {
      errors.push(...eventResult.errors);
    }

    // Transparency log
    let transparencyLogOk: boolean | null = null;
    if (container.logProof && this.logPublicKey) {
      // Compute the content hash that should have been logged
      const contentHash = computeContentHash(container.manifest, container.events);
      const logResult = await verifyLogProof(
        contentHash,
        container.logProof,
        this.logPublicKey
      );
      transparencyLogOk = logResult.valid;
      if (!logResult.valid) {
        errors.push(...logResult.errors);
      }
    } else if (container.logProof) {
      // Log proof present but no key to verify
      transparencyLogOk = null;
    }

    return {
      payload_hash_ok: payloadHashOk,
      manifest_signature_ok: manifestSignatureOk,
      event_chain_ok: eventChainOk,
      transparency_log_ok: transparencyLogOk,
      errors,
    };
  }

  /**
   * Determine human origin proof
   */
  private async determineHumanOrigin(
    container: VerityContainer,
    integrity: IntegrityResult
  ): Promise<HumanOriginProof> {
    const events = container.events.events;

    // Find CAPTURE event
    const captureEvent = events.find((e) => e.event_type === 'CAPTURE');
    const hasCaptureEvent = !!captureEvent;
    const captureIsFirst = events[0]?.event_type === 'CAPTURE';

    // Check if capture key is trusted
    const captureKeyTrusted = captureEvent
      ? this.trustedCaptureKeyIds.has(captureEvent.actor_key_id)
      : false;

    // Check for AI edits
    const hasAiEditEvent = events.some((e) => e.event_type === 'AI_EDIT');

    // Event chain validity
    const eventChainValid = integrity.event_chain_ok;

    // Determine human origin value
    let value: 'YES' | 'NO' | 'UNAVAILABLE';
    let reason: string;

    if (!hasCaptureEvent) {
      value = 'UNAVAILABLE';
      reason = 'No CAPTURE event in provenance chain';
    } else if (!captureIsFirst) {
      value = 'UNAVAILABLE';
      reason = 'CAPTURE event is not the first event';
    } else if (!eventChainValid) {
      value = 'NO';
      reason = 'Event chain integrity verification failed';
    } else if (hasAiEditEvent) {
      value = 'NO';
      reason = 'AI_EDIT event detected in provenance chain';
    } else if (!captureKeyTrusted) {
      value = 'UNAVAILABLE';
      reason = 'Capture device key is not in the trusted set';
    } else {
      value = 'YES';
      reason = 'Verified human capture with no AI modifications';
    }

    return {
      value,
      reason,
      evidence: {
        has_capture_event: hasCaptureEvent,
        capture_key_trusted: captureKeyTrusted,
        has_ai_edit_event: hasAiEditEvent,
        event_chain_valid: eventChainValid,
      },
    };
  }
}

/**
 * Create a configured verify engine
 */
export function createVerifyEngine(config: VerifyEngineConfig = {}): VerityVerifyEngine {
  return new VerityVerifyEngine(config);
}
