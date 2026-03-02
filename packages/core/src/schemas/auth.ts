/**
 * Authentication and API Key Schemas
 */

import { z } from 'zod';

// ============================================================================
// API Key Management
// ============================================================================

export const ApiKeyScopeSchema = z.enum([
  'detect:image',
  'detect:video',
  'detect:audio',
  'detect:text',
  'detect:*',
  'jobs:read',
  'jobs:write',
  'usage:read',
]);
export type ApiKeyScope = z.infer<typeof ApiKeyScopeSchema>;

export const RateLimitTierSchema = z.enum(['free', 'basic', 'pro', 'enterprise']);
export type RateLimitTier = z.infer<typeof RateLimitTierSchema>;

export const ApiKeyCreateRequestSchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(ApiKeyScopeSchema).min(1),
  expires_at: z.string().datetime().optional(),
  rate_limit_tier: RateLimitTierSchema.default('basic'),
  metadata: z.record(z.string()).optional(),
});
export type ApiKeyCreateRequest = z.infer<typeof ApiKeyCreateRequestSchema>;

export const ApiKeyResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  prefix: z.string(), // e.g., "vty_abc123..."
  scopes: z.array(ApiKeyScopeSchema),
  rate_limit_tier: RateLimitTierSchema,
  created_at: z.string().datetime(),
  expires_at: z.string().datetime().nullable(),
  last_used_at: z.string().datetime().nullable(),
  is_active: z.boolean(),
  metadata: z.record(z.string()).optional(),
});
export type ApiKeyResponse = z.infer<typeof ApiKeyResponseSchema>;

// Only returned on creation
export const ApiKeyWithSecretSchema = ApiKeyResponseSchema.extend({
  key: z.string(), // Full key, only shown once
});
export type ApiKeyWithSecret = z.infer<typeof ApiKeyWithSecretSchema>;

export const ApiKeyListResponseSchema = z.object({
  keys: z.array(ApiKeyResponseSchema),
  total: z.number(),
  has_more: z.boolean(),
});
export type ApiKeyListResponse = z.infer<typeof ApiKeyListResponseSchema>;

// ============================================================================
// Usage Stats
// ============================================================================

export const UsageStatSchema = z.object({
  date: z.string(),
  requests: z.number(),
  successful: z.number(),
  failed: z.number(),
  by_media_type: z.object({
    image: z.number(),
    video: z.number(),
    audio: z.number(),
    text: z.number(),
  }),
});
export type UsageStat = z.infer<typeof UsageStatSchema>;

export const UsageResponseSchema = z.object({
  api_key_id: z.string().uuid(),
  period_start: z.string().datetime(),
  period_end: z.string().datetime(),
  total_requests: z.number(),
  total_successful: z.number(),
  total_failed: z.number(),
  daily_stats: z.array(UsageStatSchema),
  rate_limit: z.object({
    tier: RateLimitTierSchema,
    requests_per_minute: z.number(),
    requests_per_day: z.number(),
    current_minute_usage: z.number(),
    current_day_usage: z.number(),
  }),
});
export type UsageResponse = z.infer<typeof UsageResponseSchema>;

// ============================================================================
// User Authentication
// ============================================================================

export const UserRoleSchema = z.enum(['user', 'developer', 'admin']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const RegisterRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100).optional(),
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const UserResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().nullable(),
  role: UserRoleSchema,
  created_at: z.string().datetime(),
  email_verified: z.boolean(),
});
export type UserResponse = z.infer<typeof UserResponseSchema>;

export const SessionResponseSchema = z.object({
  user: UserResponseSchema,
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_at: z.string().datetime(),
});
export type SessionResponse = z.infer<typeof SessionResponseSchema>;

// ============================================================================
// Rate Limit Configurations
// ============================================================================

export const RATE_LIMITS = {
  free: {
    requests_per_minute: 5,
    requests_per_day: 50,
    max_file_size_mb: 5,
  },
  basic: {
    requests_per_minute: 20,
    requests_per_day: 500,
    max_file_size_mb: 25,
  },
  pro: {
    requests_per_minute: 60,
    requests_per_day: 5000,
    max_file_size_mb: 100,
  },
  enterprise: {
    requests_per_minute: 200,
    requests_per_day: 50000,
    max_file_size_mb: 500,
  },
} as const;
