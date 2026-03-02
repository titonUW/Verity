/**
 * Jobs Routes (Async Processing)
 *
 * Manage async detection jobs for large files.
 */

import { FastifyPluginAsync } from 'fastify';
import { MultipartValue } from '@fastify/multipart';
import { v4 as uuidv4 } from 'uuid';
import { Queue } from 'bullmq';
import { getConfig } from '../../config.js';

// Helper to extract string value from multipart field
function getFieldValue(field: unknown): string | undefined {
  if (!field) return undefined;
  if (typeof field === 'object' && 'value' in (field as any)) {
    return (field as MultipartValue<string>).value;
  }
  return undefined;
}

export const v1JobsRoutes: FastifyPluginAsync = async (fastify) => {
  const config = getConfig();

  // Create job queue
  const detectionQueue = new Queue('detection', {
    connection: {
      host: new URL(config.REDIS_URL).hostname,
      port: parseInt(new URL(config.REDIS_URL).port || '6379'),
    },
  });

  // Authenticate all routes
  fastify.addHook('preHandler', fastify.authenticate);

  // Create a new detection job
  fastify.post('/jobs', {
    schema: {
      tags: ['jobs'],
      description: 'Create an async detection job for large files',
      security: [{ bearerAuth: [] }],
      consumes: ['multipart/form-data'],
      response: {
        202: {
          type: 'object',
          properties: {
            job_id: { type: 'string' },
            status: { type: 'string' },
            created_at: { type: 'string' },
            media_type: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: { code: 'NO_FILE', message: 'No file uploaded' } });
    }

    const buffer = await data.toBuffer();
    const jobId = uuidv4();

    // Determine media type from MIME
    let mediaType: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'TEXT' = 'IMAGE';
    if (data.mimetype.startsWith('video/')) mediaType = 'VIDEO';
    else if (data.mimetype.startsWith('audio/')) mediaType = 'AUDIO';
    else if (data.mimetype.startsWith('text/')) mediaType = 'TEXT';

    // Parse options
    const only = getFieldValue(data.fields.only)?.split(',').filter(Boolean);
    const excluding = getFieldValue(data.fields.excluding)?.split(',').filter(Boolean);
    const externalId = getFieldValue(data.fields.external_id);
    const webhookUrl = getFieldValue(data.fields.webhook_url);

    // Calculate hash
    const crypto = await import('crypto');
    const mediaHash = crypto.createHash('sha256').update(buffer).digest('hex');

    // Create job record
    const job = await fastify.prisma.detectionJob.create({
      data: {
        id: jobId,
        userId: request.user?.id,
        apiKeyId: request.apiKey?.id,
        externalId,
        status: 'PENDING',
        mediaType,
        mediaHash,
        mediaSize: buffer.length,
        mimeType: data.mimetype,
        options: { only, excluding },
        webhookUrl,
      },
    });

    // Store file temporarily in Redis (will be processed by worker)
    await fastify.redis.setex(
      `job:file:${jobId}`,
      3600, // 1 hour TTL
      buffer.toString('base64')
    );

    // Queue job for processing
    await detectionQueue.add('detect', {
      jobId,
      mediaType: mediaType.toLowerCase(),
      mimeType: data.mimetype,
      filename: data.filename,
      only,
      excluding,
    });

    return reply.status(202).send({
      job_id: jobId,
      status: 'pending',
      created_at: job.createdAt.toISOString(),
      media_type: mediaType.toLowerCase(),
    });
  });

  // Get job status
  fastify.get('/jobs/:id', {
    schema: {
      tags: ['jobs'],
      description: 'Get the status and results of a detection job',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            job_id: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'processing', 'completed', 'failed'] },
            created_at: { type: 'string' },
            updated_at: { type: 'string' },
            started_at: { type: 'string' },
            completed_at: { type: 'string' },
            media_type: { type: 'string' },
            media_hash: { type: 'string' },
            progress: { type: 'number' },
            result: { type: 'object' },
            error: { type: 'string' },
            external_id: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const job = await fastify.prisma.detectionJob.findUnique({
      where: { id },
      include: {
        results: true,
      },
    });

    if (!job) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Job not found' } });
    }

    // Verify ownership
    if (job.apiKeyId !== request.apiKey?.id && job.userId !== request.user?.id) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    // Build response
    const response: Record<string, unknown> = {
      job_id: job.id,
      status: job.status.toLowerCase(),
      created_at: job.createdAt.toISOString(),
      updated_at: job.updatedAt.toISOString(),
      media_type: job.mediaType.toLowerCase(),
      media_hash: job.mediaHash,
      progress: job.progress,
      external_id: job.externalId,
    };

    if (job.startedAt) {
      response.started_at = job.startedAt.toISOString();
    }

    if (job.completedAt) {
      response.completed_at = job.completedAt.toISOString();
    }

    if (job.status === 'COMPLETED' && job.results.length > 0) {
      // Build result object
      const signals = job.results.map(r => ({
        name: r.signalName,
        verdict: r.verdict.toLowerCase(),
        confidence: r.confidence,
        model_version: r.modelVersion,
        processing_time_ms: r.processingMs,
        error: r.error,
        metadata: r.metadata,
      }));

      // Calculate aggregate verdict
      const aiSignals = signals.filter(s => s.verdict === 'ai');
      const humanSignals = signals.filter(s => s.verdict === 'human');

      let verdict = 'uncertain';
      let confidence = 0.5;

      if (aiSignals.length > humanSignals.length) {
        verdict = 'ai';
        confidence = aiSignals.reduce((sum, s) => sum + s.confidence, 0) / aiSignals.length;
      } else if (humanSignals.length > aiSignals.length) {
        verdict = 'human';
        confidence = humanSignals.reduce((sum, s) => sum + s.confidence, 0) / humanSignals.length;
      }

      response.result = {
        verdict,
        confidence,
        signals,
      };
    }

    if (job.status === 'FAILED') {
      response.error = job.error;
    }

    return response;
  });

  // List jobs
  fastify.get('/jobs', {
    schema: {
      tags: ['jobs'],
      description: 'List detection jobs',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'processing', 'completed', 'failed'] },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          offset: { type: 'integer', minimum: 0, default: 0 },
        },
      },
    },
  }, async (request) => {
    const { status, limit = 20, offset = 0 } = request.query as {
      status?: string;
      limit?: number;
      offset?: number;
    };

    const where: Record<string, unknown> = {
      apiKeyId: request.apiKey?.id,
    };

    if (status) {
      where.status = status.toUpperCase();
    }

    const [jobs, total] = await Promise.all([
      fastify.prisma.detectionJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          status: true,
          mediaType: true,
          mediaHash: true,
          createdAt: true,
          completedAt: true,
          externalId: true,
        },
      }),
      fastify.prisma.detectionJob.count({ where }),
    ]);

    return {
      jobs: jobs.map(j => ({
        job_id: j.id,
        status: j.status.toLowerCase(),
        media_type: j.mediaType.toLowerCase(),
        media_hash: j.mediaHash,
        created_at: j.createdAt.toISOString(),
        completed_at: j.completedAt?.toISOString(),
        external_id: j.externalId,
      })),
      total,
      limit,
      offset,
    };
  });

  // Cancel a job
  fastify.delete('/jobs/:id', {
    schema: {
      tags: ['jobs'],
      description: 'Cancel a pending or processing job',
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

    const job = await fastify.prisma.detectionJob.findUnique({
      where: { id },
    });

    if (!job) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Job not found' } });
    }

    if (job.apiKeyId !== request.apiKey?.id) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    if (job.status === 'COMPLETED' || job.status === 'FAILED') {
      return reply.status(400).send({
        error: { code: 'INVALID_STATE', message: 'Job already completed' },
      });
    }

    // Update job status
    await fastify.prisma.detectionJob.update({
      where: { id },
      data: {
        status: 'FAILED',
        error: 'Cancelled by user',
        completedAt: new Date(),
      },
    });

    // Remove file from Redis
    await fastify.redis.del(`job:file:${id}`);

    return { message: 'Job cancelled' };
  });
};
