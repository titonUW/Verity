/**
 * Verity Log Client
 * HTTP client for interacting with the log service
 */

import type {
  AddEntryResponse,
  GetCheckpointResponse,
  GetProofResponse,
  GetEntryResponse,
  LogCheckpoint,
  LogInclusionProof,
  VerityLogProof,
  LogEntry,
} from './types.js';

export interface LogClientConfig {
  /** Base URL of the log server */
  baseUrl: string;
  /** Request timeout in ms (default: 10000) */
  timeout?: number;
}

/**
 * HTTP client for the Verity Log service
 */
export class VerityLogClient {
  private baseUrl: string;
  private timeout: number;

  constructor(config: LogClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.timeout = config.timeout ?? 10000;
  }

  private async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error((error as { error: string }).error || `HTTP ${response.status}`);
      }

      return response.json() as Promise<T>;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Add an entry to the log
   * @param contentHash - Hash to add (will be leaf-hashed by the server)
   * @returns Entry details and checkpoint
   */
  async addEntry(contentHash: string): Promise<AddEntryResponse> {
    return this.fetch<AddEntryResponse>('/entries', {
      method: 'POST',
      body: JSON.stringify({ leaf_hash: contentHash }),
    });
  }

  /**
   * Get the current checkpoint
   * @returns Signed checkpoint
   */
  async getCheckpoint(): Promise<LogCheckpoint> {
    const response = await this.fetch<GetCheckpointResponse>('/checkpoint');
    return response.checkpoint;
  }

  /**
   * Get inclusion proof for an entry
   * @param index - Entry index
   * @returns Inclusion proof and checkpoint
   */
  async getProof(index: number): Promise<{
    inclusionProof: LogInclusionProof;
    checkpoint: LogCheckpoint;
  }> {
    const response = await this.fetch<GetProofResponse>(`/proof/${index}`);
    return {
      inclusionProof: response.inclusion_proof,
      checkpoint: response.checkpoint,
    };
  }

  /**
   * Get an entry by index
   * @param index - Entry index
   * @returns Log entry
   */
  async getEntry(index: number): Promise<LogEntry> {
    const response = await this.fetch<GetEntryResponse>(`/entry/${index}`);
    return response.entry;
  }

  /**
   * Get the current tree size
   * @returns Number of entries
   */
  async getTreeSize(): Promise<number> {
    const response = await this.fetch<{ tree_size: number }>('/size');
    return response.tree_size;
  }

  /**
   * Publish content to the log and get a complete proof
   * @param contentHash - Hash of content to publish
   * @returns Complete VerityLogProof for embedding in container
   */
  async publishAndGetProof(contentHash: string): Promise<VerityLogProof> {
    // Add entry
    const addResult = await this.addEntry(contentHash);

    // Get proof
    const { inclusionProof, checkpoint } = await this.getProof(addResult.leaf_index);

    return {
      obtained_at: new Date().toISOString(),
      log_url: this.baseUrl,
      checkpoint,
      inclusion_proof: inclusionProof,
    };
  }

  /**
   * Check if the log server is healthy
   * @returns True if server is responding
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.fetch<{ status: string }>('/health');
      return true;
    } catch {
      return false;
    }
  }
}
