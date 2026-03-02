/**
 * Utility functions for confidence calibration and verdict determination
 */

import type { Verdict, SignalResult } from './types/index.js';

/**
 * Calibrate a raw confidence score to [0, 1] range
 * Applies sigmoid transformation to handle edge cases
 */
export function calibrateConfidence(rawScore: number, options?: {
  min?: number;
  max?: number;
  steepness?: number;
}): number {
  const { min = 0, max = 1, steepness = 1 } = options ?? {};

  // Normalize to [0, 1] if not already
  let normalized = rawScore;
  if (min !== 0 || max !== 1) {
    normalized = (rawScore - min) / (max - min);
  }

  // Apply sigmoid for smoothing near edges
  if (steepness !== 1) {
    const centered = (normalized - 0.5) * steepness;
    normalized = 1 / (1 + Math.exp(-centered));
  }

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, normalized));
}

/**
 * Convert confidence score to verdict
 */
export function verdictFromConfidence(
  confidence: number,
  thresholds?: {
    aiThreshold?: number;
    humanThreshold?: number;
  }
): Verdict {
  const { aiThreshold = 0.7, humanThreshold = 0.3 } = thresholds ?? {};

  if (confidence >= aiThreshold) {
    return 'ai';
  } else if (confidence <= humanThreshold) {
    return 'human';
  } else {
    return 'uncertain';
  }
}

/**
 * Aggregate multiple signal verdicts into a final verdict
 * Uses weighted voting based on confidence
 */
export function aggregateVerdicts(signals: SignalResult[]): {
  verdict: Verdict;
  confidence: number;
} {
  if (signals.length === 0) {
    return { verdict: 'unavailable', confidence: 0 };
  }

  // Filter out unavailable signals
  const availableSignals = signals.filter(s => s.verdict !== 'unavailable');

  if (availableSignals.length === 0) {
    return { verdict: 'unavailable', confidence: 0 };
  }

  // Calculate weighted scores
  let aiScore = 0;
  let humanScore = 0;
  let totalWeight = 0;

  for (const signal of availableSignals) {
    const weight = signal.confidence;
    totalWeight += weight;

    if (signal.verdict === 'ai') {
      aiScore += weight;
    } else if (signal.verdict === 'human') {
      humanScore += weight;
    } else {
      // uncertain - split the weight
      aiScore += weight * 0.5;
      humanScore += weight * 0.5;
    }
  }

  // Normalize
  const normalizedAi = totalWeight > 0 ? aiScore / totalWeight : 0;
  const normalizedHuman = totalWeight > 0 ? humanScore / totalWeight : 0;

  // Determine final verdict
  const confidence = Math.max(normalizedAi, normalizedHuman);
  const verdict = verdictFromConfidence(normalizedAi);

  return { verdict, confidence };
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let size = bytes;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Validate media type from MIME type
 */
export function mediaTypeFromMime(mime: string): 'image' | 'video' | 'audio' | 'text' | null {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('text/') || mime === 'application/json') return 'text';
  return null;
}
