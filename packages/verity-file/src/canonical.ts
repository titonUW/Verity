/**
 * Canonical JSON Utilities
 * RFC 8785 JSON Canonicalization Scheme (JCS)
 *
 * Ensures stable, deterministic JSON serialization for cryptographic signing.
 */

import { canonicalize as jcsCanonical } from 'json-canonicalize';
import { sha256Hash } from './crypto.js';

/**
 * Serialize an object to canonical JSON (RFC 8785)
 * - Keys are sorted lexicographically
 * - No whitespace
 * - Numbers are in their minimal representation
 * - Unicode escaping is normalized
 *
 * @param obj - Object to serialize
 * @returns Canonical JSON string
 */
export function canonicalize(obj: unknown): string {
  return jcsCanonical(obj);
}

/**
 * Compute the canonical hash of an object
 * First canonicalizes, then SHA-256 hashes
 *
 * @param obj - Object to hash
 * @returns SHA-256 hash (hex)
 */
export function canonicalHash(obj: unknown): string {
  const canonical = canonicalize(obj);
  return sha256Hash(canonical);
}

/**
 * Parse JSON and re-canonicalize to ensure consistent format
 *
 * @param json - JSON string
 * @returns Canonical JSON string
 */
export function normalizeJson(json: string): string {
  const parsed = JSON.parse(json);
  return canonicalize(parsed);
}

/**
 * Check if two objects have the same canonical representation
 *
 * @param a - First object
 * @param b - Second object
 * @returns True if canonically equal
 */
export function canonicalEqual(a: unknown, b: unknown): boolean {
  return canonicalize(a) === canonicalize(b);
}

/**
 * Create a timestamped canonical object
 * Ensures consistent timestamp format (RFC3339)
 *
 * @param obj - Object to timestamp
 * @param timestamp - Optional timestamp (defaults to now)
 * @returns Object with timestamp
 */
export function withTimestamp<T extends object>(
  obj: T,
  timestamp?: Date
): T & { timestamp: string } {
  const ts = (timestamp ?? new Date()).toISOString();
  return { ...obj, timestamp: ts };
}

/**
 * Get current time in RFC3339 format
 * @returns ISO 8601 timestamp string
 */
export function rfc3339Now(): string {
  return new Date().toISOString();
}

/**
 * Validate RFC3339 timestamp format
 * @param timestamp - Timestamp string to validate
 * @returns True if valid RFC3339
 */
export function isValidRfc3339(timestamp: string): boolean {
  const date = new Date(timestamp);
  return !isNaN(date.getTime()) && date.toISOString() === timestamp;
}
