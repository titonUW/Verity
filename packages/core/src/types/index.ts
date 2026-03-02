/**
 * Type Exports
 * Re-export all inferred types from schemas
 */

// Detection types
export type {
  Verdict,
  MediaType,
  JobStatus,
  SignalResult,
  BoundingBox,
  DeepfakeResult,
  QualityResult,
  ReverseSearchMatch,
  ReverseSearchResult,
  TextAnnotation,
  TextResult,
  AudioResult,
  VerityProvenance,
  C2PAManifest,
  WatermarkResult,
  ProvenanceResult,
  DetectionOptions,
  DetectionResponse,
  JobCreateRequest,
  JobResponse,
  CompatReport,
  CompatImageResponse,
  CompatVideoResponse,
  CompatTextResponse,
  CompatVoiceResponse,
  ErrorResponse,
} from '../schemas/detection.js';

// Auth types
export type {
  ApiKeyScope,
  RateLimitTier,
  ApiKeyCreateRequest,
  ApiKeyResponse,
  ApiKeyWithSecret,
  ApiKeyListResponse,
  UsageStat,
  UsageResponse,
  UserRole,
  RegisterRequest,
  LoginRequest,
  UserResponse,
  SessionResponse,
} from '../schemas/auth.js';
