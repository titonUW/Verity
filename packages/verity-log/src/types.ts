/**
 * Verity Log Types
 * Type definitions for the transparency log service
 */

import type { LogCheckpoint, LogInclusionProof, VerityLogProof } from '@verity/file';

// Re-export from verity-file
export type { LogCheckpoint, LogInclusionProof, VerityLogProof };

// ============================================================================
// Log Entry Types
// ============================================================================

export interface LogEntry {
  /** Index in the log (0-based) */
  index: number;
  /** Hash of the leaf data (hex) */
  leaf_hash: string;
  /** RFC3339 timestamp when entry was added */
  added_at: string;
  /** Optional: hash of the manifest+events that was logged */
  content_hash?: string;
}

// ============================================================================
// API Types
// ============================================================================

export interface AddEntryRequest {
  /** Hash to add to the log (hex) */
  leaf_hash: string;
  /** Optional content hash for reference */
  content_hash?: string;
}

export interface AddEntryResponse {
  /** Index of the added entry */
  leaf_index: number;
  /** Hash of the leaf */
  leaf_hash: string;
  /** Current checkpoint after addition */
  checkpoint: LogCheckpoint;
}

export interface GetCheckpointResponse {
  checkpoint: LogCheckpoint;
}

export interface GetProofResponse {
  /** The inclusion proof */
  inclusion_proof: LogInclusionProof;
  /** The current checkpoint */
  checkpoint: LogCheckpoint;
}

export interface GetEntryResponse {
  entry: LogEntry;
}

// ============================================================================
// Store Types
// ============================================================================

export interface LogStore {
  /** Add a leaf to the log */
  addLeaf(leafHash: string, contentHash?: string): Promise<number>;

  /** Get an entry by index */
  getEntry(index: number): Promise<LogEntry | null>;

  /** Get the current tree size */
  getTreeSize(): Promise<number>;

  /** Get all leaf hashes (for tree computation) */
  getAllLeafHashes(): Promise<string[]>;

  /** Close the store */
  close(): Promise<void>;
}

// ============================================================================
// Server Config
// ============================================================================

export interface LogServerConfig {
  /** Port to listen on */
  port: number;
  /** Path to SQLite database */
  dbPath: string;
  /** Log private key (hex) */
  logPrivateKey: string;
  /** Log public key (hex) */
  logPublicKey: string;
  /** Log key ID */
  logKeyId: string;
}
