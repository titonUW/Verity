/**
 * AIorNot Compatibility Routes - Reports
 *
 * POST /v1/reports/voice - Voice detection
 * POST /v1/reports/music - Music detection
 */

import { FastifyPluginAsync } from 'fastify';
import { v4 as uuidv4 } from 'uuid';

export const compatReportsRoutes: FastifyPluginAsync = async (fastify) => {
  // Authenticate all routes
  fastify.addHook('preHandler', fastify.authenticate);

  // Voice detection
  fastify.post('/reports/voice', {
    schema: {
      tags: ['compat'],
      description: 'AIorNot-compatible voice detection endpoint',
      security: [{ bearerAuth: [] }],
      consumes: ['multipart/form-data'],
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            verdict: { type: 'string', enum: ['ai', 'human', 'uncertain'] },
            confidence: { type: 'number' },
            duration: { type: 'number' },
            hash: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: { code: 'NO_FILE', message: 'No audio file uploaded' } });
    }

    const buffer = await data.toBuffer();
    const id = uuidv4();

    // Call inference service with only voice detector
    const result = await fastify.inference.detectAudio(
      buffer,
      data.filename,
      data.mimetype,
      { only: ['ai_voice'] }
    );

    const voiceSignal = result.signals.find(s => s.name === 'ai_voice');

    let verdict = 'uncertain';
    if (voiceSignal?.verdict === 'ai' && voiceSignal.confidence >= 0.7) {
      verdict = 'ai';
    } else if (voiceSignal?.verdict === 'human' && voiceSignal.confidence >= 0.7) {
      verdict = 'human';
    }

    return {
      id,
      verdict,
      confidence: voiceSignal?.confidence || 0.5,
      duration: voiceSignal?.metadata?.duration_seconds || 0,
      hash: result.media_hash,
    };
  });

  // Music detection
  fastify.post('/reports/music', {
    schema: {
      tags: ['compat'],
      description: 'AIorNot-compatible music detection endpoint',
      security: [{ bearerAuth: [] }],
      consumes: ['multipart/form-data'],
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            verdict: { type: 'string', enum: ['ai', 'human', 'uncertain'] },
            confidence: { type: 'number' },
            duration: { type: 'number' },
            hash: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: { code: 'NO_FILE', message: 'No audio file uploaded' } });
    }

    const buffer = await data.toBuffer();
    const id = uuidv4();

    // Call inference service with only music detector
    const result = await fastify.inference.detectAudio(
      buffer,
      data.filename,
      data.mimetype,
      { only: ['ai_music'] }
    );

    const musicSignal = result.signals.find(s => s.name === 'ai_music');

    let verdict = 'uncertain';
    if (musicSignal?.verdict === 'ai' && musicSignal.confidence >= 0.7) {
      verdict = 'ai';
    } else if (musicSignal?.verdict === 'human' && musicSignal.confidence >= 0.7) {
      verdict = 'human';
    }

    return {
      id,
      verdict,
      confidence: musicSignal?.confidence || 0.5,
      duration: musicSignal?.metadata?.duration_seconds || 0,
      hash: result.media_hash,
    };
  });
};
