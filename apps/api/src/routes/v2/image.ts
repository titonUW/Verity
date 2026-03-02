/**
 * AIorNot Compatibility Routes - Image
 *
 * POST /v2/image/sync - Multi-report image detection
 */

import { FastifyPluginAsync } from 'fastify';
import { v4 as uuidv4 } from 'uuid';

export const v2ImageRoutes: FastifyPluginAsync = async (fastify) => {
  // Authenticate all routes
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.post('/image/sync', {
    schema: {
      tags: ['compat'],
      description: 'AIorNot-compatible image detection endpoint',
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
                verdict: { type: 'string' },
                ai: {
                  type: 'object',
                  properties: {
                    is_detected: { type: 'boolean' },
                    confidence: { type: 'number' },
                  },
                },
                facet: {
                  type: 'object',
                  properties: {
                    is_detected: { type: 'boolean' },
                    confidence: { type: 'number' },
                  },
                },
                nsfw: {
                  type: 'object',
                  properties: {
                    is_detected: { type: 'boolean' },
                    confidence: { type: 'number' },
                  },
                },
                quality: {
                  type: 'object',
                  properties: {
                    is_detected: { type: 'boolean' },
                    blur: { type: 'number' },
                    compression: { type: 'number' },
                  },
                },
              },
            },
            hash: { type: 'string' },
            external_id: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: { code: 'NO_FILE', message: 'No image uploaded' } });
    }

    const buffer = await data.toBuffer();
    const id = uuidv4();

    // Parse options
    const only = data.fields.only?.value?.split(',').filter(Boolean);
    const excluding = data.fields.excluding?.value?.split(',').filter(Boolean);
    const externalId = data.fields.external_id?.value;

    // Call inference service
    const result = await fastify.inference.detectImage(
      buffer,
      data.filename,
      data.mimetype,
      { only, excluding, includeProvenance: true }
    );

    // Transform to AIorNot format
    const aiSignal = result.signals.find(s => s.name === 'ai_generated');
    const deepfakeSignal = result.signals.find(s => s.name === 'deepfake');
    const nsfwSignal = result.signals.find(s => s.name === 'nsfw');
    const qualitySignal = result.signals.find(s => s.name === 'quality');

    // Determine overall verdict
    let verdict = 'uncertain';
    if (aiSignal?.verdict === 'ai' && aiSignal.confidence >= 0.7) {
      verdict = 'ai';
    } else if (aiSignal?.verdict === 'human' && aiSignal.confidence >= 0.7) {
      verdict = 'human';
    }

    return {
      id,
      created_at: new Date().toISOString(),
      report: {
        verdict,
        ai: {
          is_detected: aiSignal?.verdict === 'ai',
          confidence: aiSignal?.confidence || 0,
        },
        facet: {
          is_detected: deepfakeSignal?.verdict === 'ai',
          confidence: deepfakeSignal?.confidence || 0,
        },
        nsfw: {
          is_detected: nsfwSignal?.verdict === 'ai',
          confidence: nsfwSignal?.confidence || 0,
        },
        quality: {
          is_detected: (qualitySignal?.confidence || 1) < 0.5,
          blur: qualitySignal?.metadata?.blur_score || 0,
          compression: qualitySignal?.metadata?.compression_score || 0,
        },
      },
      hash: result.media_hash,
      external_id: externalId,
    };
  });
};
