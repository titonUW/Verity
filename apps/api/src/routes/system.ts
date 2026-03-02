/**
 * System Routes
 *
 * Health checks, system status, and compatibility endpoints.
 */

import { FastifyPluginAsync } from 'fastify';

export const systemRoutes: FastifyPluginAsync = async (fastify) => {
  // Health check
  fastify.get('/healthz', {
    schema: {
      tags: ['system'],
      description: 'Kubernetes-style health check',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
          },
        },
      },
    },
  }, async () => {
    return { status: 'ok' };
  });

  // Readiness check
  fastify.get('/readyz', {
    schema: {
      tags: ['system'],
      description: 'Readiness check - verifies all dependencies',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            checks: {
              type: 'object',
              properties: {
                database: { type: 'boolean' },
                redis: { type: 'boolean' },
                inference: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
  }, async () => {
    // Check database
    let dbOk = false;
    try {
      await fastify.prisma.$queryRaw`SELECT 1`;
      dbOk = true;
    } catch {
      dbOk = false;
    }

    // Check Redis
    let redisOk = false;
    try {
      await fastify.redis.ping();
      redisOk = true;
    } catch {
      redisOk = false;
    }

    // Check inference service
    const inferenceOk = await fastify.inference.healthCheck();

    const allOk = dbOk && redisOk && inferenceOk;

    return {
      status: allOk ? 'ready' : 'degraded',
      checks: {
        database: dbOk,
        redis: redisOk,
        inference: inferenceOk,
      },
    };
  });

  // AIorNot compatibility: system live check
  fastify.get('/v1/system/live', {
    schema: {
      tags: ['compat'],
      description: 'AIorNot compatibility - system live check',
      response: {
        200: {
          type: 'object',
          properties: {
            is_live: { type: 'boolean' },
          },
        },
      },
    },
  }, async () => {
    return { is_live: true };
  });

  // API info
  fastify.get('/', {
    schema: {
      tags: ['system'],
      description: 'API information',
      response: {
        200: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            version: { type: 'string' },
            docs: { type: 'string' },
          },
        },
      },
    },
  }, async () => {
    return {
      name: 'Verity API',
      version: '1.0.0',
      docs: '/docs',
    };
  });
};
