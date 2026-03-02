/**
 * API Server Configuration
 */

import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.string().default('3000').transform(Number),
  HOST: z.string().default('0.0.0.0'),

  // Database
  DATABASE_URL: z.string(),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Inference service
  INFERENCE_URL: z.string().default('http://localhost:8000'),

  // Security
  JWT_SECRET: z.string().min(32),
  API_KEY_SALT: z.string().min(16),

  // Rate limiting
  RATE_LIMIT_MAX: z.string().default('100').transform(Number),
  RATE_LIMIT_WINDOW_MS: z.string().default('60000').transform(Number),

  // File limits
  MAX_FILE_SIZE_MB: z.string().default('100').transform(Number),

  // Features
  ENABLE_SWAGGER: z.string().default('true').transform(v => v === 'true'),
});

export type Config = z.infer<typeof envSchema>;

let config: Config | null = null;

export function getConfig(): Config {
  if (!config) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      console.error('Invalid environment configuration:');
      console.error(result.error.format());
      throw new Error('Invalid configuration');
    }
    config = result.data;
  }
  return config;
}

export function isDevelopment(): boolean {
  return getConfig().NODE_ENV === 'development';
}

export function isProduction(): boolean {
  return getConfig().NODE_ENV === 'production';
}
