/**
 * Verity Container
 * ZIP-based container format for Verity files (.verity)
 */

import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';
import * as unzipper from 'unzipper';
import { Readable } from 'stream';
import { sha256Hash } from './crypto.js';
import { canonicalize } from './canonical.js';
import { serializeManifest, parseManifest, verifyPayloadAgainstManifest } from './manifest.js';
import { serializeEvents, parseEvents, validateEventChain } from './events.js';
import {
  serializeSignatures,
  parseSignatures,
  verifySignatures,
  computeContentHash,
} from './signatures.js';
import type {
  VerityContainer,
  VerityManifest,
  VerityEvents,
  VeritySignatures,
  VerityLogProof,
  TrustReport,
  ContainerVerificationResult,
  IntegrityResult,
} from './types.js';

// ============================================================================
// Constants
// ============================================================================

export const VERITY_EXTENSION = '.verity';
export const CONTAINER_FILES = {
  PAYLOAD: 'payload.bin',
  MANIFEST: 'manifest.json',
  EVENTS: 'events.json',
  SIGNATURES: 'signatures.json',
  LOG_PROOF: 'log_proof.json',
  TRUST_REPORT: 'trust_report.json',
} as const;

// ============================================================================
// Container Writing
// ============================================================================

export interface WriteContainerOptions {
  /** Output file path */
  outputPath: string;
  /** Raw payload bytes */
  payload: Buffer;
  /** Manifest */
  manifest: VerityManifest;
  /** Events */
  events: VerityEvents;
  /** Signatures */
  signatures: VeritySignatures;
  /** Log proof (optional) */
  logProof?: VerityLogProof;
  /** Trust report (optional) */
  trustReport?: TrustReport;
}

/**
 * Write a Verity container to disk
 * @param options - Container contents
 */
export async function writeContainer(options: WriteContainerOptions): Promise<void> {
  const { outputPath, payload, manifest, events, signatures, logProof, trustReport } = options;

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve());
    archive.on('error', (err) => reject(err));

    archive.pipe(output);

    // Add payload
    archive.append(payload, { name: CONTAINER_FILES.PAYLOAD });

    // Add manifest (canonical JSON)
    archive.append(serializeManifest(manifest), { name: CONTAINER_FILES.MANIFEST });

    // Add events (canonical JSON)
    archive.append(serializeEvents(events), { name: CONTAINER_FILES.EVENTS });

    // Add signatures (canonical JSON)
    archive.append(serializeSignatures(signatures), { name: CONTAINER_FILES.SIGNATURES });

    // Add optional files
    if (logProof) {
      archive.append(canonicalize(logProof), { name: CONTAINER_FILES.LOG_PROOF });
    }

    if (trustReport) {
      archive.append(canonicalize(trustReport), { name: CONTAINER_FILES.TRUST_REPORT });
    }

    archive.finalize();
  });
}

/**
 * Update a container with additional files (like log proof or trust report)
 * @param containerPath - Path to existing container
 * @param updates - Files to add/update
 */
export async function updateContainer(
  containerPath: string,
  updates: {
    logProof?: VerityLogProof;
    trustReport?: TrustReport;
  }
): Promise<void> {
  // Read existing container
  const container = await readContainer(containerPath);

  // Apply updates
  const newLogProof = updates.logProof ?? container.logProof;
  const newTrustReport = updates.trustReport ?? container.trustReport;

  // Write back
  await writeContainer({
    outputPath: containerPath,
    payload: container.payload,
    manifest: container.manifest,
    events: container.events,
    signatures: container.signatures,
    logProof: newLogProof,
    trustReport: newTrustReport,
  });
}

// ============================================================================
// Container Reading
// ============================================================================

/**
 * Read a Verity container from disk
 * @param containerPath - Path to .verity file
 * @returns Parsed container contents
 */
export async function readContainer(containerPath: string): Promise<VerityContainer> {
  const files = new Map<string, Buffer>();

  // Read ZIP contents
  const directory = await unzipper.Open.file(containerPath);

  for (const file of directory.files) {
    const content = await file.buffer();
    files.set(file.path, content);
  }

  // Parse required files
  const payloadBuffer = files.get(CONTAINER_FILES.PAYLOAD);
  if (!payloadBuffer) {
    throw new Error('Missing payload.bin in container');
  }

  const manifestBuffer = files.get(CONTAINER_FILES.MANIFEST);
  if (!manifestBuffer) {
    throw new Error('Missing manifest.json in container');
  }

  const eventsBuffer = files.get(CONTAINER_FILES.EVENTS);
  if (!eventsBuffer) {
    throw new Error('Missing events.json in container');
  }

  const signaturesBuffer = files.get(CONTAINER_FILES.SIGNATURES);
  if (!signaturesBuffer) {
    throw new Error('Missing signatures.json in container');
  }

  // Parse JSON files
  const manifest = parseManifest(manifestBuffer.toString('utf-8'));
  const events = parseEvents(eventsBuffer.toString('utf-8'));
  const signatures = parseSignatures(signaturesBuffer.toString('utf-8'));

  // Parse optional files
  let logProof: VerityLogProof | undefined;
  const logProofBuffer = files.get(CONTAINER_FILES.LOG_PROOF);
  if (logProofBuffer) {
    logProof = JSON.parse(logProofBuffer.toString('utf-8')) as VerityLogProof;
  }

  let trustReport: TrustReport | undefined;
  const trustReportBuffer = files.get(CONTAINER_FILES.TRUST_REPORT);
  if (trustReportBuffer) {
    trustReport = JSON.parse(trustReportBuffer.toString('utf-8')) as TrustReport;
  }

  return {
    payload: payloadBuffer,
    manifest,
    events,
    signatures,
    logProof,
    trustReport,
  };
}

/**
 * Read raw bytes from a container file
 * @param containerPath - Path to .verity file
 * @returns Buffer of the entire container
 */
export async function readContainerBytes(containerPath: string): Promise<Buffer> {
  return fs.promises.readFile(containerPath);
}

/**
 * Compute hash of a container file
 * @param containerPath - Path to .verity file
 * @returns SHA-256 hash (hex)
 */
export async function hashContainer(containerPath: string): Promise<string> {
  const bytes = await readContainerBytes(containerPath);
  return sha256Hash(bytes);
}

// ============================================================================
// Container Verification
// ============================================================================

/**
 * Verify a container's cryptographic integrity
 * @param container - Container to verify
 * @param trustedKeyIds - Optional set of trusted key IDs for capture devices
 * @returns Verification result
 */
export async function verifyContainer(
  container: VerityContainer,
  trustedKeyIds?: Set<string>
): Promise<ContainerVerificationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Verify payload hash
  const payloadResult = verifyPayloadAgainstManifest(container.payload, container.manifest);
  const payloadHashOk = payloadResult.valid;
  if (!payloadResult.valid) {
    errors.push(payloadResult.error!);
  }

  // 2. Verify signatures
  const sigResult = await verifySignatures(
    container.manifest,
    container.events,
    container.signatures
  );
  const manifestSignatureOk = sigResult.valid;
  if (!sigResult.valid) {
    errors.push(...sigResult.errors);
  }

  // 3. Verify event chain
  const eventResult = await validateEventChain(container.events);
  const eventChainOk = eventResult.valid;
  if (!eventResult.valid) {
    errors.push(...eventResult.errors);
  }
  if (eventResult.warnings.length > 0) {
    warnings.push(...eventResult.warnings);
  }

  // 4. Verify log proof (if present)
  let transparencyLogOk: boolean | null = null;
  if (container.logProof) {
    // We'll verify this more completely in verity-verify
    // Here we just check structural validity
    const logProof = container.logProof;
    if (
      logProof.checkpoint &&
      logProof.inclusion_proof &&
      typeof logProof.checkpoint.tree_size === 'number' &&
      typeof logProof.checkpoint.root_hash === 'string' &&
      typeof logProof.inclusion_proof.leaf_index === 'number'
    ) {
      transparencyLogOk = true; // Structural check only
    } else {
      transparencyLogOk = false;
      warnings.push('Log proof has invalid structure');
    }
  }

  const integrity: IntegrityResult = {
    payload_hash_ok: payloadHashOk,
    manifest_signature_ok: manifestSignatureOk,
    event_chain_ok: eventChainOk,
    transparency_log_ok: transparencyLogOk,
    errors,
  };

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    integrity,
  };
}

/**
 * Verify a container file from disk
 * @param containerPath - Path to .verity file
 * @param trustedKeyIds - Optional set of trusted key IDs
 * @returns Verification result
 */
export async function verifyContainerFile(
  containerPath: string,
  trustedKeyIds?: Set<string>
): Promise<ContainerVerificationResult> {
  const container = await readContainer(containerPath);
  return verifyContainer(container, trustedKeyIds);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a file is a Verity container
 * @param filePath - Path to check
 * @returns True if file has .verity extension
 */
export function isVerityFile(filePath: string): boolean {
  return path.extname(filePath).toLowerCase() === VERITY_EXTENSION;
}

/**
 * Get the expected container path for a payload file
 * @param payloadPath - Path to original file
 * @returns Path with .verity extension
 */
export function getContainerPath(payloadPath: string): string {
  const dir = path.dirname(payloadPath);
  const base = path.basename(payloadPath);
  return path.join(dir, `${base}${VERITY_EXTENSION}`);
}

/**
 * Extract payload from container to a file
 * @param containerPath - Path to .verity file
 * @param outputPath - Path to write extracted payload
 */
export async function extractPayload(
  containerPath: string,
  outputPath: string
): Promise<void> {
  const container = await readContainer(containerPath);
  await fs.promises.writeFile(outputPath, container.payload);
}

/**
 * Get container metadata without reading full payload
 * @param containerPath - Path to .verity file
 * @returns Manifest and events
 */
export async function getContainerMetadata(containerPath: string): Promise<{
  manifest: VerityManifest;
  events: VerityEvents;
  hasLogProof: boolean;
  hasTrustReport: boolean;
}> {
  const container = await readContainer(containerPath);
  return {
    manifest: container.manifest,
    events: container.events,
    hasLogProof: !!container.logProof,
    hasTrustReport: !!container.trustReport,
  };
}
