/**
 * Detection API Schemas
 * Zod schemas for AI content detection requests and responses
 */

import { z } from 'zod';

// ============================================================================
// Common Types
// ============================================================================

export const VerdictSchema = z.enum(['ai', 'human', 'uncertain', 'unavailable']);
export type Verdict = z.infer<typeof VerdictSchema>;

export const MediaTypeSchema = z.enum(['image', 'video', 'audio', 'text']);
export type MediaType = z.infer<typeof MediaTypeSchema>;

export const JobStatusSchema = z.enum(['pending', 'processing', 'completed', 'failed']);
export type JobStatus = z.infer<typeof JobStatusSchema>;

// ============================================================================
// Signal/Detector Results
// ============================================================================

export const SignalResultSchema = z.object({
  name: z.string(),
  verdict: VerdictSchema,
  confidence: z.number().min(0).max(1),
  model_version: z.string(),
  processing_time_ms: z.number().optional(),
  error: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type SignalResult = z.infer<typeof SignalResultSchema>;

// Image-specific results
export const BoundingBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  confidence: z.number().min(0).max(1),
  label: z.string().optional(),
});
export type BoundingBox = z.infer<typeof BoundingBoxSchema>;

export const DeepfakeResultSchema = SignalResultSchema.extend({
  regions: z.array(BoundingBoxSchema).optional(),
});
export type DeepfakeResult = z.infer<typeof DeepfakeResultSchema>;

export const QualityResultSchema = SignalResultSchema.extend({
  blur_score: z.number().min(0).max(1).optional(),
  compression_artifacts: z.number().min(0).max(1).optional(),
  resolution: z.object({
    width: z.number(),
    height: z.number(),
  }).optional(),
  format: z.string().optional(),
});
export type QualityResult = z.infer<typeof QualityResultSchema>;

export const ReverseSearchMatchSchema = z.object({
  url: z.string().url(),
  domain: z.string(),
  similarity: z.number().min(0).max(1),
  earliest_seen: z.string().datetime().optional(),
  title: z.string().optional(),
});
export type ReverseSearchMatch = z.infer<typeof ReverseSearchMatchSchema>;

export const ReverseSearchResultSchema = SignalResultSchema.extend({
  matches: z.array(ReverseSearchMatchSchema),
  total_matches: z.number(),
});
export type ReverseSearchResult = z.infer<typeof ReverseSearchResultSchema>;

// Text-specific results
export const TextAnnotationSchema = z.object({
  start: z.number(),
  end: z.number(),
  verdict: VerdictSchema,
  confidence: z.number().min(0).max(1),
  reason: z.string().optional(),
});
export type TextAnnotation = z.infer<typeof TextAnnotationSchema>;

export const TextResultSchema = SignalResultSchema.extend({
  annotations: z.array(TextAnnotationSchema).optional(),
  perplexity: z.number().optional(),
  burstiness: z.number().optional(),
});
export type TextResult = z.infer<typeof TextResultSchema>;

// Audio-specific results
export const AudioResultSchema = SignalResultSchema.extend({
  duration_seconds: z.number().optional(),
  sample_rate: z.number().optional(),
});
export type AudioResult = z.infer<typeof AudioResultSchema>;

// ============================================================================
// Provenance Results
// ============================================================================

export const VerityProvenanceSchema = z.object({
  is_verity_container: z.boolean(),
  human_origin: z.enum(['YES', 'NO', 'UNAVAILABLE']).optional(),
  confidence_score: z.number().min(0).max(100).optional(),
  event_chain_valid: z.boolean().optional(),
  has_capture_event: z.boolean().optional(),
  has_ai_edit_event: z.boolean().optional(),
  transparency_log_valid: z.boolean().nullable().optional(),
  trust_report: z.record(z.unknown()).optional(),
});
export type VerityProvenance = z.infer<typeof VerityProvenanceSchema>;

export const C2PAManifestSchema = z.object({
  found: z.boolean(),
  issuer: z.string().optional(),
  claim_generator: z.string().optional(),
  signature_valid: z.boolean().optional(),
  actions: z.array(z.object({
    action: z.string(),
    when: z.string().datetime().optional(),
  })).optional(),
  ingredients: z.array(z.object({
    title: z.string().optional(),
    format: z.string().optional(),
  })).optional(),
  error: z.string().optional(),
});
export type C2PAManifest = z.infer<typeof C2PAManifestSchema>;

export const WatermarkResultSchema = z.object({
  detected: z.boolean(),
  type: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  source: z.string().optional(),
});
export type WatermarkResult = z.infer<typeof WatermarkResultSchema>;

export const ProvenanceResultSchema = z.object({
  verity: VerityProvenanceSchema.nullable(),
  c2pa: C2PAManifestSchema.nullable(),
  watermark: WatermarkResultSchema.nullable(),
});
export type ProvenanceResult = z.infer<typeof ProvenanceResultSchema>;

// ============================================================================
// Detection Request/Response
// ============================================================================

export const DetectionOptionsSchema = z.object({
  only: z.array(z.string()).optional(),
  excluding: z.array(z.string()).optional(),
  include_provenance: z.boolean().default(true),
  external_id: z.string().optional(),
  webhook_url: z.string().url().optional(),
});
export type DetectionOptions = z.infer<typeof DetectionOptionsSchema>;

export const DetectionResponseSchema = z.object({
  request_id: z.string().uuid(),
  timestamp: z.string().datetime(),
  media_type: MediaTypeSchema,
  media_hash: z.string(),
  verdict: VerdictSchema,
  confidence: z.number().min(0).max(1),
  signals: z.array(SignalResultSchema),
  provenance: ProvenanceResultSchema.optional(),
  processing_time_ms: z.number(),
  external_id: z.string().optional(),
});
export type DetectionResponse = z.infer<typeof DetectionResponseSchema>;

// ============================================================================
// Async Job Schema
// ============================================================================

export const JobCreateRequestSchema = z.object({
  media_type: MediaTypeSchema,
  options: DetectionOptionsSchema.optional(),
  external_id: z.string().optional(),
  webhook_url: z.string().url().optional(),
});
export type JobCreateRequest = z.infer<typeof JobCreateRequestSchema>;

export const JobResponseSchema = z.object({
  job_id: z.string().uuid(),
  status: JobStatusSchema,
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  media_type: MediaTypeSchema.optional(),
  media_hash: z.string().optional(),
  external_id: z.string().optional(),
  result: DetectionResponseSchema.optional(),
  error: z.string().optional(),
  progress: z.number().min(0).max(100).optional(),
});
export type JobResponse = z.infer<typeof JobResponseSchema>;

// ============================================================================
// AIorNot Compatibility Schemas
// ============================================================================

export const CompatReportSchema = z.object({
  is_detected: z.boolean(),
  confidence: z.number().min(0).max(1),
});
export type CompatReport = z.infer<typeof CompatReportSchema>;

export const CompatImageResponseSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  report: z.object({
    verdict: z.string(),
    ai: CompatReportSchema,
    facet: CompatReportSchema.optional(),
    nsfw: CompatReportSchema.optional(),
    quality: z.object({
      is_detected: z.boolean(),
      blur: z.number().optional(),
      compression: z.number().optional(),
    }).optional(),
  }),
  hash: z.string().optional(),
  external_id: z.string().optional(),
});
export type CompatImageResponse = z.infer<typeof CompatImageResponseSchema>;

export const CompatVideoResponseSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  report: z.object({
    ai_video: CompatReportSchema.optional(),
    ai_voice: CompatReportSchema.optional(),
    ai_music: CompatReportSchema.optional(),
    deepfake_video: CompatReportSchema.optional(),
  }),
  duration: z.number().optional(),
  hash: z.string().optional(),
  external_id: z.string().optional(),
});
export type CompatVideoResponse = z.infer<typeof CompatVideoResponseSchema>;

export const CompatTextResponseSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  report: z.object({
    ai_text: CompatReportSchema,
    annotations: z.array(z.object({
      start: z.number(),
      end: z.number(),
      ai: z.boolean(),
      confidence: z.number(),
    })).optional(),
  }),
  external_id: z.string().optional(),
});
export type CompatTextResponse = z.infer<typeof CompatTextResponseSchema>;

export const CompatVoiceResponseSchema = z.object({
  id: z.string().uuid(),
  verdict: z.string(),
  confidence: z.number().min(0).max(1),
  duration: z.number().optional(),
  hash: z.string().optional(),
});
export type CompatVoiceResponse = z.infer<typeof CompatVoiceResponseSchema>;

// ============================================================================
// Error Response
// ============================================================================

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
  request_id: z.string().uuid().optional(),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
