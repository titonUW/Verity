/**
 * Verity Signatures
 * Create and verify detached signatures over manifest + events
 */

import { sign, verify, generateId, sha256Hash } from './crypto.js';
import { canonicalize, rfc3339Now } from './canonical.js';
import type {
  VerityManifest,
  VerityEvents,
  VeritySignature,
  VeritySignatures,
  KeyPair,
} from './types.js';

// ============================================================================
// Content Hash
// ============================================================================

/**
 * Compute the content hash that signatures sign
 * This is SHA-256(canonical(manifest) + canonical(events))
 *
 * @param manifest - The manifest
 * @param events - The events
 * @returns Content hash (hex)
 */
export function computeContentHash(
  manifest: VerityManifest,
  events: VerityEvents
): string {
  const canonicalManifest = canonicalize(manifest);
  const canonicalEvents = canonicalize(events);
  // Concatenate and hash
  const combined = canonicalManifest + canonicalEvents;
  return sha256Hash(combined);
}

// ============================================================================
// Signature Creation
// ============================================================================

export interface CreateSignatureOptions {
  /** Manifest to sign */
  manifest: VerityManifest;
  /** Events to sign */
  events: VerityEvents;
  /** Signer's key pair */
  signerKeyPair: KeyPair;
  /** Override signing time (for testing) */
  signedAt?: Date;
}

/**
 * Create a signature over the manifest and events
 * @param options - Signature options
 * @returns Created signature
 */
export async function createSignature(
  options: CreateSignatureOptions
): Promise<VeritySignature> {
  const { manifest, events, signerKeyPair, signedAt } = options;

  // Compute content hash
  const contentHash = computeContentHash(manifest, events);

  // Sign the content hash
  const signature = await sign(contentHash, signerKeyPair.privateKey);

  return {
    signature_id: generateId(),
    signer_key_id: signerKeyPair.keyId,
    signer_pubkey: signerKeyPair.publicKey,
    signed_content: 'manifest_and_events',
    content_hash: contentHash,
    signature,
    signed_at: (signedAt ?? new Date()).toISOString(),
    algorithm: 'ed25519',
  };
}

/**
 * Add a signature to an existing signatures object
 * @param signatures - Existing signatures
 * @param newSignature - Signature to add
 * @returns New signatures object
 */
export function addSignature(
  signatures: VeritySignatures,
  newSignature: VeritySignature
): VeritySignatures {
  return {
    signatures: [...signatures.signatures, newSignature],
  };
}

/**
 * Create an empty signatures object
 * @returns Empty signatures
 */
export function createEmptySignatures(): VeritySignatures {
  return { signatures: [] };
}

// ============================================================================
// Serialization
// ============================================================================

/**
 * Serialize signatures to canonical JSON
 * @param signatures - Signatures to serialize
 * @returns Canonical JSON string
 */
export function serializeSignatures(signatures: VeritySignatures): string {
  return canonicalize(signatures);
}

/**
 * Parse signatures from JSON string
 * @param json - JSON string
 * @returns Parsed signatures
 */
export function parseSignatures(json: string): VeritySignatures {
  return JSON.parse(json) as VeritySignatures;
}

// ============================================================================
// Signature Verification
// ============================================================================

export interface SignatureVerificationResult {
  valid: boolean;
  /** Which signatures are valid */
  validSignatures: string[];
  /** Which signatures failed */
  invalidSignatures: string[];
  errors: string[];
}

/**
 * Verify all signatures on a container
 * @param manifest - The manifest
 * @param events - The events
 * @param signatures - The signatures to verify
 * @returns Verification result
 */
export async function verifySignatures(
  manifest: VerityManifest,
  events: VerityEvents,
  signatures: VeritySignatures
): Promise<SignatureVerificationResult> {
  const validSignatures: string[] = [];
  const invalidSignatures: string[] = [];
  const errors: string[] = [];

  // Compute expected content hash
  const expectedContentHash = computeContentHash(manifest, events);

  for (const sig of signatures.signatures) {
    // Verify content hash matches
    if (sig.content_hash !== expectedContentHash) {
      errors.push(
        `Signature ${sig.signature_id}: content hash mismatch`
      );
      invalidSignatures.push(sig.signature_id);
      continue;
    }

    // Verify algorithm
    if (sig.algorithm !== 'ed25519') {
      errors.push(
        `Signature ${sig.signature_id}: unsupported algorithm ${sig.algorithm}`
      );
      invalidSignatures.push(sig.signature_id);
      continue;
    }

    // Verify the actual signature
    const isValid = await verify(
      sig.signature,
      sig.content_hash,
      sig.signer_pubkey
    );

    if (isValid) {
      validSignatures.push(sig.signature_id);
    } else {
      errors.push(
        `Signature ${sig.signature_id}: cryptographic verification failed`
      );
      invalidSignatures.push(sig.signature_id);
    }
  }

  return {
    valid: invalidSignatures.length === 0 && validSignatures.length > 0,
    validSignatures,
    invalidSignatures,
    errors,
  };
}

/**
 * Verify a single signature
 * @param manifest - The manifest
 * @param events - The events
 * @param signature - The signature to verify
 * @returns True if valid
 */
export async function verifySingleSignature(
  manifest: VerityManifest,
  events: VerityEvents,
  signature: VeritySignature
): Promise<boolean> {
  const expectedContentHash = computeContentHash(manifest, events);

  if (signature.content_hash !== expectedContentHash) {
    return false;
  }

  if (signature.algorithm !== 'ed25519') {
    return false;
  }

  return verify(signature.signature, signature.content_hash, signature.signer_pubkey);
}

/**
 * Check if a specific key has signed
 * @param signatures - Signatures object
 * @param keyId - Key ID to check for
 * @returns True if key has signed
 */
export function hasSignatureFromKey(
  signatures: VeritySignatures,
  keyId: string
): boolean {
  return signatures.signatures.some((s) => s.signer_key_id === keyId);
}

/**
 * Get all signer key IDs
 * @param signatures - Signatures object
 * @returns Array of key IDs
 */
export function getSignerKeyIds(signatures: VeritySignatures): string[] {
  return signatures.signatures.map((s) => s.signer_key_id);
}
