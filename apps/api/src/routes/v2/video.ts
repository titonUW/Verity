/**
 * AIorNot Compatibility Routes - Video
 *
 * POST /v2/video/sync - Multi-report video detection
 */

import { FastifyPluginAsync } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { getConfig } from '../../config.js';

export const v2VideoRoutes: FastifyPluginAsync = async (fastify) => {
  const config = getConfig();

  // Authenticate all routes
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.post('/video/sync', {
    schema: {
      tags: ['compat'],
      description: 'AIorNot-compatible video detection endpoint. For large files, may return 202 with job_id.',
      security: [{ bearerAuth: [] }],
      consumes: ['multipart/form-data'],
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            created_at: { type: 'string' },
            report: {
              type: 'object',
              properties: {
                ai_video: {
                  type: 'object',
                  properties: {
                    is_detected: { type: 'boolean' },
                    confidence: { type: 'number' },
                  },
                },
                ai_voice: {
                  type: 'object',
                  properties: {
                    is_detected: { type: 'boolean' },
                    confidence: { type: 'number' },
                  },
                },
                ai_music: {
                  type: 'object',
                  properties: {
                    is_detected: { type: 'boolean' },
                    confidence: { type: 'number' },
                  },
                },
                deepfake_video: {
                  type: 'object',
                  properties: {
                    is_detected: { type: 'boolean' },
                    confidence: { type: 'number' },
                  },
                },
              },
            },
            duration: { type: 'number' },
            hash: { type: 'string' },
            external_id: { type: 'string' },
          },
        },
        202: {
          type: 'object',
          properties: {
            job_id: { type: 'string' },
            status: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: { code: 'NO_FILE', message: 'No video uploaded' } });
    }

    const buffer = await data.toBuffer();
    const id = uuidv4();

    // Check file size - use async for large files
    const asyncThreshold = 50 * 1024 * 1024; // 50MB
    if (buffer.length > asyncThreshold) {
      // Create async job
      const crypto = await import('crypto');
      const mediaHash = crypto.createHash('sha256').update(buffer).digest('hex');

      const job = await fastify.prisma.detectionJob.create({
        data: {
          id,
          userId: request.user?.id,
          apiKeyId: request.apiKey?.id,
          externalId: data.fields.external_id?.value,
          status: 'PENDING',
          mediaType: 'VIDEO',
          mediaHash,
          mediaSize: buffer.length,
          mimeType: data.mimetype,
        },
      });

      // Store file in Redis
      await fastify.redis.setex(`job:file:${id}`, 3600, buffer.toString('base64'));

      return reply.status(202).send({
        job_id: id,
        status: 'pending',
        message: 'File is too large for sync processing. Use GET /api/v1/jobs/:id to poll for results.',
      });
    }

    // Parse options
    const only = data.fields.only?.value?.split(',').filter(Boolean);
    const excluding = data.fields.excluding?.value?.split(',').filter(Boolean);
    const externalId = data.fields.external_id?.value;

    // Call inference service
    const result = await fastify.inference.detectVideo(
      buffer,
      data.filename,
      data.mimetype,
      { only, excluding, includeProvenance: true }
    );

    // Transform to AIorNot format
    const aiVideoSignal = result.signals.find(s => s.name === 'ai_video');
    const aiVoiceSignal = result.signals.find(s => s.name === 'ai_voice');
    const aiMusicSignal = result.signals.find(s => s.name === 'ai_music');
    const deepfakeSignal = result.signals.find(s => s.name === 'deepfake_video');

    return {
      id,
      created_at: new Date().toISOString(),
      report: {
        ai_video: {
          is_detected: aiVideoSignal?.verdict === 'ai',
          confidence: aiVideoSignal?.confidence || 0,
        },
        ai_voice: {
          is_detected: aiVoiceSignal?.verdict === 'ai',
          confidence: aiVoiceSignal?.confidence || 0,
        },
        ai_music: {
          is_detected: aiMusicSignal?.verdict === 'ai',
          confidence: aiMusicSignal?.confidence || 0,
        },
        deepfake_video: {
          is_detected: deepfakeSignal?.verdict === 'ai',
          confidence: deepfakeSignal?.confidence || 0,
        },
      },
      duration: aiVideoSignal?.metadata?.duration_seconds || 0,
      hash: result.media_hash,
      external_id: externalId,
    };
  });
};
