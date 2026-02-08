/**
 * Verity Manifest
 * Create and validate manifest.json for Verity containers
 */

import { sha256Hash } from './crypto.js';
import { canonicalize, canonicalHash, rfc3339Now, isValidRfc3339 } from './canonical.js';
import type { VerityManifest, CertificateInfo, PublicKeyInfo } from './types.js';

// ============================================================================
// Manifest Creation
// ============================================================================

export interface CreateManifestOptions {
  /** Raw payload bytes */
  payload: Buffer;
  /** MIME type of the payload */
  mimeType: string;
  /** Capture device key info */
  captureDevice?: PublicKeyInfo;
  /** Certificate chain for trust verification */
  certChain?: CertificateInfo[];
  /** Original filename */
  originalFilename?: string;
  /** Workflow hint */
  workflowHint?: string;
  /** Override creation timestamp (for testing) */
  createdAt?: Date;
}

/**
 * Create a new manifest for a payload
 * @param options - Manifest creation options
 * @returns VerityManifest
 */
export function createManifest(options: CreateManifestOptions): VerityManifest {
  const {
    payload,
    mimeType,
    captureDevice,
    certChain,
    originalFilename,
    workflowHint,
    createdAt,
  } = options;

  const manifest: VerityManifest = {
    version: '1.0',
    payload_sha256: sha256Hash(payload),
    payload_mime: mimeType,
    payload_size: payload.length,
    created_at: (createdAt ?? new Date()).toISOString(),
  };

  if (captureDevice) {
    manifest.capture_device_pubkey = captureDevice.publicKey;
    manifest.capture_device_key_id = captureDevice.keyId;
  }

  if (certChain && certChain.length > 0) {
    manifest.signer_cert_chain = certChain;
  }

  if (originalFilename) {
    manifest.original_filename = originalFilename;
  }

  if (workflowHint) {
    manifest.workflow_hint = workflowHint;
  }

  return manifest;
}

// ============================================================================
// Manifest Serialization
// ============================================================================

/**
 * Serialize manifest to canonical JSON
 * @param manifest - Manifest to serialize
 * @returns Canonical JSON string
 */
export function serializeManifest(manifest: VerityManifest): string {
  return canonicalize(manifest);
}

/**
 * Parse manifest from JSON string
 * @param json - JSON string
 * @returns Parsed manifest
 * @throws Error if invalid
 */
export function parseManifest(json: string): VerityManifest {
  const parsed = JSON.parse(json) as VerityManifest;
  validateManifest(parsed);
  return parsed;
}

/**
 * Compute canonical hash of manifest
 * @param manifest - Manifest to hash
 * @returns SHA-256 hash (hex)
 */
export function hashManifest(manifest: VerityManifest): string {
  return canonicalHash(manifest);
}

// ============================================================================
// Manifest Validation
// ============================================================================

export interface ManifestValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a manifest object
 * @param manifest - Manifest to validate
 * @throws Error if invalid
 */
export function validateManifest(manifest: VerityManifest): void {
  const result = validateManifestFull(manifest);
  if (!result.valid) {
    throw new Error(`Invalid manifest: ${result.errors.join(', ')}`);
  }
}

/**
 * Validate a manifest with detailed results
 * @param manifest - Manifest to validate
 * @returns Validation result
 */
export function validateManifestFull(manifest: VerityManifest): ManifestValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (manifest.version !== '1.0') {
    errors.push(`Unsupported manifest version: ${manifest.version}`);
  }

  if (!manifest.payload_sha256 || !/^[a-f0-9]{64}$/i.test(manifest.payload_sha256)) {
    errors.push('Invalid or missing payload_sha256');
  }

  if (!manifest.payload_mime) {
    errors.push('Missing payload_mime');
  }

  if (typeof manifest.payload_size !== 'number' || manifest.payload_size < 0) {
    errors.push('Invalid or missing payload_size');
  }

  if (!manifest.created_at) {
    errors.push('Missing created_at');
  } else if (!isValidRfc3339(manifest.created_at)) {
    errors.push('created_at must be valid RFC3339 timestamp');
  } else {
    // Check for future dates (with some tolerance for clock skew)
    const createdAt = new Date(manifest.created_at);
    const now = new Date();
    const fiveMinutes = 5 * 60 * 1000;
    if (createdAt.getTime() > now.getTime() + fiveMinutes) {
      warnings.push('created_at is in the future');
    }
  }

  // Optional field validation
  if (manifest.capture_device_pubkey) {
    if (!/^[a-f0-9]{64}$/i.test(manifest.capture_device_pubkey)) {
      errors.push('Invalid capture_device_pubkey format (expected 64 hex chars)');
    }
  }

  if (manifest.capture_device_key_id) {
    if (!/^[a-f0-9]{16}$/i.test(manifest.capture_device_key_id)) {
      warnings.push('capture_device_key_id should be 16 hex characters');
    }
  }

  if (manifest.signer_cert_chain) {
    if (!Array.isArray(manifest.signer_cert_chain)) {
      errors.push('signer_cert_chain must be an array');
    } else {
      for (let i = 0; i < manifest.signer_cert_chain.length; i++) {
        const cert = manifest.signer_cert_chain[i];
        if (!cert.subject || !cert.issuer || !cert.public_key || !cert.key_id) {
          errors.push(`Certificate at index ${i} missing required fields`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Verify that payload matches manifest
 * @param payload - Raw payload bytes
 * @param manifest - Manifest to verify against
 * @returns True if payload matches
 */
export function verifyPayloadAgainstManifest(
  payload: Buffer,
  manifest: VerityManifest
): { valid: boolean; error?: string } {
  const actualHash = sha256Hash(payload);
  if (actualHash !== manifest.payload_sha256) {
    return {
      valid: false,
      error: `Payload hash mismatch. Expected: ${manifest.payload_sha256}, Got: ${actualHash}`,
    };
  }

  if (payload.length !== manifest.payload_size) {
    return {
      valid: false,
      error: `Payload size mismatch. Expected: ${manifest.payload_size}, Got: ${payload.length}`,
    };
  }

  return { valid: true };
}
