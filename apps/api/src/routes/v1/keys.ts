/**
 * API Key Management Routes
 */

import { FastifyPluginAsync } from 'fastify';
import { v4 as uuidv4 } from 'uuid';

export const v1KeysRoutes: FastifyPluginAsync = async (fastify) => {
  // All routes require authentication (with existing key or session)
  fastify.addHook('preHandler', fastify.authenticate);

  // Create new API key
  fastify.post('/keys', {
    schema: {
      tags: ['keys'],
      description: 'Create a new API key',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          scopes: {
            type: 'array',
            items: { type: 'string' },
            default: ['detect:*'],
          },
          expires_in_days: { type: 'integer', minimum: 1, maximum: 365 },
          rate_limit_tier: {
            type: 'string',
            enum: ['free', 'basic', 'pro', 'enterprise'],
            default: 'basic',
          },
          metadata: { type: 'object' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            key: { type: 'string', description: 'Full API key - shown only once!' },
            prefix: { type: 'string' },
            scopes: { type: 'array', items: { type: 'string' } },
            rate_limit_tier: { type: 'string' },
            created_at: { type: 'string' },
            expires_at: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const {
      name,
      scopes = ['detect:*'],
      expires_in_days,
      rate_limit_tier = 'basic',
      metadata,
    } = request.body as {
      name: string;
      scopes?: string[];
      expires_in_days?: number;
      rate_limit_tier?: string;
      metadata?: Record<string, string>;
    };

    // Generate the full API key
    const fullKey = fastify.generateApiKey();
    const keyHash = await fastify.hashApiKey(fullKey);
    const keyPrefix = fullKey.slice(0, 12);

    // Calculate expiration
    let expiresAt: Date | null = null;
    if (expires_in_days) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expires_in_days);
    }

    // Create key record
    const apiKey = await fastify.prisma.apiKey.create({
      data: {
        id: uuidv4(),
        userId: request.user!.id,
        name,
        keyHash,
        keyPrefix,
        scopes,
        rateLimitTier: rate_limit_tier.toUpperCase() as any,
        expiresAt,
        metadata: metadata || undefined,
      },
    });

    // Return with full key (only time it's shown)
    return reply.status(201).send({
      id: apiKey.id,
      name: apiKey.name,
      key: fullKey, // Only shown once!
      prefix: apiKey.keyPrefix,
      scopes: apiKey.scopes,
      rate_limit_tier: apiKey.rateLimitTier.toLowerCase(),
      created_at: apiKey.createdAt.toISOString(),
      expires_at: apiKey.expiresAt?.toISOString() || null,
    });
  });

  // List API keys
  fastify.get('/keys', {
    schema: {
      tags: ['keys'],
      description: 'List all API keys for the authenticated user',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            keys: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  prefix: { type: 'string' },
                  scopes: { type: 'array', items: { type: 'string' } },
                  rate_limit_tier: { type: 'string' },
                  is_active: { type: 'boolean' },
                  created_at: { type: 'string' },
                  expires_at: { type: 'string' },
                  last_used_at: { type: 'string' },
                },
              },
            },
            total: { type: 'integer' },
          },
        },
      },
    },
  }, async (request) => {
    const keys = await fastify.prisma.apiKey.findMany({
      where: { userId: request.user!.id },
      orderBy: { createdAt: 'desc' },
    });

    return {
      keys: keys.map(k => ({
        id: k.id,
        name: k.name,
        prefix: k.keyPrefix,
        scopes: k.scopes,
        rate_limit_tier: k.rateLimitTier.toLowerCase(),
        is_active: k.isActive,
        created_at: k.createdAt.toISOString(),
        expires_at: k.expiresAt?.toISOString() || null,
        last_used_at: k.lastUsedAt?.toISOString() || null,
      })),
      total: keys.length,
    };
  });

  // Get API key details
  fastify.get('/keys/:id', {
    schema: {
      tags: ['keys'],
      description: 'Get details of a specific API key',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const key = await fastify.prisma.apiKey.findUnique({
      where: { id },
    });

    if (!key || key.userId !== request.user!.id) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'API key not found' } });
    }

    return {
      id: key.id,
      name: key.name,
      prefix: key.keyPrefix,
      scopes: key.scopes,
      rate_limit_tier: key.rateLimitTier.toLowerCase(),
      is_active: key.isActive,
      created_at: key.createdAt.toISOString(),
      expires_at: key.expiresAt?.toISOString() || null,
      last_used_at: key.lastUsedAt?.toISOString() || null,
      metadata: key.metadata,
    };
  });

  // Revoke API key
  fastify.delete('/keys/:id', {
    schema: {
      tags: ['keys'],
      description: 'Revoke an API key',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const key = await fastify.prisma.apiKey.findUnique({
      where: { id },
    });

    if (!key || key.userId !== request.user!.id) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'API key not found' } });
    }

    await fastify.prisma.apiKey.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'API key revoked' };
  });

  // Get usage stats
  fastify.get('/usage', {
    schema: {
      tags: ['keys'],
      description: 'Get usage statistics for all API keys',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          api_key_id: { type: 'string', format: 'uuid' },
          days: { type: 'integer', minimum: 1, maximum: 90, default: 30 },
        },
      },
    },
  }, async (request) => {
    const { api_key_id, days = 30 } = request.query as {
      api_key_id?: string;
      days?: number;
    };

    // Get user's API keys
    const apiKeys = await fastify.prisma.apiKey.findMany({
      where: {
        userId: request.user!.id,
        ...(api_key_id ? { id: api_key_id } : {}),
      },
      select: { id: true },
    });

    const apiKeyIds = apiKeys.map(k => k.id);

    if (apiKeyIds.length === 0) {
      return { usage: [], total_requests: 0 };
    }

    // Get usage records
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const usage = await fastify.prisma.usageRecord.findMany({
      where: {
        apiKeyId: { in: apiKeyIds },
        date: { gte: startDate },
      },
      orderBy: { date: 'desc' },
    });

    // Aggregate
    const totalRequests = usage.reduce((sum, u) => sum + u.requestCount, 0);
    const totalSuccess = usage.reduce((sum, u) => sum + u.successCount, 0);
    const totalFailure = usage.reduce((sum, u) => sum + u.failureCount, 0);

    // Group by date
    const dailyStats: Record<string, {
      date: string;
      requests: number;
      successful: number;
      failed: number;
      by_media_type: {
        image: number;
        video: number;
        audio: number;
        text: number;
      };
    }> = {};

    for (const record of usage) {
      const dateStr = record.date.toISOString().split('T')[0];
      if (!dailyStats[dateStr]) {
        dailyStats[dateStr] = {
          date: dateStr,
          requests: 0,
          successful: 0,
          failed: 0,
          by_media_type: { image: 0, video: 0, audio: 0, text: 0 },
        };
      }

      dailyStats[dateStr].requests += record.requestCount;
      dailyStats[dateStr].successful += record.successCount;
      dailyStats[dateStr].failed += record.failureCount;
      dailyStats[dateStr].by_media_type.image += record.imageCount;
      dailyStats[dateStr].by_media_type.video += record.videoCount;
      dailyStats[dateStr].by_media_type.audio += record.audioCount;
      dailyStats[dateStr].by_media_type.text += record.textCount;
    }

    return {
      period_start: startDate.toISOString(),
      period_end: new Date().toISOString(),
      total_requests: totalRequests,
      total_successful: totalSuccess,
      total_failed: totalFailure,
      daily_stats: Object.values(dailyStats),
    };
  });
};
