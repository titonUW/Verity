/**
 * @verity/log
 *
 * Verity transparency log service providing Certificate Transparency-style
 * Merkle tree with signed checkpoints for external verifiability.
 */

// Types
export type {
  LogCheckpoint,
  LogInclusionProof,
  VerityLogProof,
  LogEntry,
  AddEntryRequest,
  AddEntryResponse,
  GetCheckpointResponse,
  GetProofResponse,
  GetEntryResponse,
  LogStore,
  LogServerConfig,
} from './types.js';

// Merkle tree
export {
  computeLeafHash,
  computeNodeHash,
  computeMerkleRoot,
  computeInclusionProof,
  verifyInclusionProof,
  computeRootAtSize,
} from './merkle.js';

// Store
export { SqliteLogStore, InMemoryLogStore } from './store.js';

// Log service
export { VerityLogService, verifyCheckpoint, verifyLogProof } from './log.js';

// Server
export { createLogServer, startLogServer, createInMemoryLogServer } from './server.js';

// Client
export { VerityLogClient, type LogClientConfig } from './client.js';
