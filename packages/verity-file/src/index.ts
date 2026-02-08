/**
 * @verity/file
 *
 * Verity container format library for creating and verifying
 * tamper-evident files with cryptographic provenance chains.
 */

// Types
export type {
  // Manifest
  VerityManifest,
  CertificateInfo,
  // Events
  EventType,
  VerityEvent,
  VerityEvents,
  // Signatures
  VeritySignature,
  VeritySignatures,
  // Log
  LogCheckpoint,
  LogInclusionProof,
  VerityLogProof,
  // Trust Report
  HumanOriginValue,
  ContextDecision,
  HumanOriginProof,
  ConfidenceSignal,
  RealityConfidence,
  ContextPolicyDecision,
  IntegrityResult,
  TrustReport,
  // Keys
  KeyPair,
  PublicKeyInfo,
  // Container
  VerityContainer,
  ContainerVerificationResult,
  ContainerBuilderOptions,
  EventBuilderOptions,
} from './types.js';

// Crypto utilities
export {
  sha256Hash,
  sha256HashBytes,
  generateKeyPair,
  loadKeyPair,
  getPublicKeyInfo,
  generateKeyId,
  sign,
  signData,
  verify,
  verifyData,
  generateId,
  bytesToHex,
  hexToBytes,
} from './crypto.js';

// Canonical JSON
export {
  canonicalize,
  canonicalHash,
  normalizeJson,
  canonicalEqual,
  withTimestamp,
  rfc3339Now,
  isValidRfc3339,
} from './canonical.js';

// Manifest
export {
  createManifest,
  serializeManifest,
  parseManifest,
  hashManifest,
  validateManifest,
  validateManifestFull,
  verifyPayloadAgainstManifest,
  type CreateManifestOptions,
  type ManifestValidationResult,
} from './manifest.js';

// Events
export {
  createEvent,
  createCaptureEvent,
  createChainedEvent,
  serializeEvents,
  parseEvents,
  hashEvents,
  verifyEvent,
  validateEventChain,
  getLastEvent,
  addEvent,
  createEmptyEvents,
  type CreateEventOptions,
  type EventChainValidationResult,
} from './events.js';

// Signatures
export {
  computeContentHash,
  createSignature,
  addSignature,
  createEmptySignatures,
  serializeSignatures,
  parseSignatures,
  verifySignatures,
  verifySingleSignature,
  hasSignatureFromKey,
  getSignerKeyIds,
  type CreateSignatureOptions,
  type SignatureVerificationResult,
} from './signatures.js';

// Container
export {
  VERITY_EXTENSION,
  CONTAINER_FILES,
  writeContainer,
  updateContainer,
  readContainer,
  readContainerBytes,
  hashContainer,
  verifyContainer,
  verifyContainerFile,
  isVerityFile,
  getContainerPath,
  extractPayload,
  getContainerMetadata,
  type WriteContainerOptions,
} from './container.js';

// Builder
export { VerityContainerBuilder, wrapFile } from './builder.js';
