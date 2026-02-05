/**
 * Verity Log Store
 * SQLite-based persistent storage for the transparency log
 */

import Database from 'better-sqlite3';
import type { LogStore, LogEntry } from './types.js';

/**
 * SQLite implementation of the log store
 */
export class SqliteLogStore implements LogStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS leaves (
        idx INTEGER PRIMARY KEY,
        leaf_hash TEXT NOT NULL,
        content_hash TEXT,
        added_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_leaf_hash ON leaves(leaf_hash);
    `);
  }

  async addLeaf(leafHash: string, contentHash?: string): Promise<number> {
    const addedAt = new Date().toISOString();

    // Get next index
    const countResult = this.db.prepare('SELECT COUNT(*) as count FROM leaves').get() as {
      count: number;
    };
    const nextIndex = countResult.count;

    // Insert new leaf
    const stmt = this.db.prepare(
      'INSERT INTO leaves (idx, leaf_hash, content_hash, added_at) VALUES (?, ?, ?, ?)'
    );
    stmt.run(nextIndex, leafHash, contentHash ?? null, addedAt);

    return nextIndex;
  }

  async getEntry(index: number): Promise<LogEntry | null> {
    const stmt = this.db.prepare('SELECT * FROM leaves WHERE idx = ?');
    const row = stmt.get(index) as {
      idx: number;
      leaf_hash: string;
      content_hash: string | null;
      added_at: string;
    } | undefined;

    if (!row) {
      return null;
    }

    return {
      index: row.idx,
      leaf_hash: row.leaf_hash,
      content_hash: row.content_hash ?? undefined,
      added_at: row.added_at,
    };
  }

  async getTreeSize(): Promise<number> {
    const result = this.db.prepare('SELECT COUNT(*) as count FROM leaves').get() as {
      count: number;
    };
    return result.count;
  }

  async getAllLeafHashes(): Promise<string[]> {
    const rows = this.db
      .prepare('SELECT leaf_hash FROM leaves ORDER BY idx')
      .all() as { leaf_hash: string }[];
    return rows.map((r) => r.leaf_hash);
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

/**
 * In-memory implementation for testing
 */
export class InMemoryLogStore implements LogStore {
  private entries: LogEntry[] = [];

  async addLeaf(leafHash: string, contentHash?: string): Promise<number> {
    const index = this.entries.length;
    this.entries.push({
      index,
      leaf_hash: leafHash,
      content_hash: contentHash,
      added_at: new Date().toISOString(),
    });
    return index;
  }

  async getEntry(index: number): Promise<LogEntry | null> {
    return this.entries[index] ?? null;
  }

  async getTreeSize(): Promise<number> {
    return this.entries.length;
  }

  async getAllLeafHashes(): Promise<string[]> {
    return this.entries.map((e) => e.leaf_hash);
  }

  async close(): Promise<void> {
    // Nothing to close for in-memory
  }
}
