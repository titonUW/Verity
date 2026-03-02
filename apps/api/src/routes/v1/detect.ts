/**
 * Detection Routes (Native API v1)
 *
 * Clean, native detection endpoints.
 */

import { FastifyPluginAsync } from 'fastify';
import { MultipartValue } from '@fastify/multipart';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

// Helper to extract string value from multipart field
function getFieldValue(field: unknown): string | undefined {
  if (!field) return undefined;
  if (typeof field === 'object' && 'value' in (field as any)) {
    return (field as MultipartValue<string>).value;
  }
  return undefined;
}

export const v1DetectRoutes: FastifyPluginAsync = async (fastify) => {
  // Authenticate all routes
  fastify.addHook('preHandler', fastify.authenticate);

  // Detect AI in image
  fastify.post('/detect/image', {
    schema: {
      tags: ['detect'],
      description: 'Detect AI-generated content in an image',
      security: [{ bearerAuth: [] }],
      consumes: ['multipart/form-data'],
      response: {
        200: {
          type: 'object',
          properties: {
            request_id: { type: 'string' },
            timestamp: { type: 'string' },
            media_type: { type: 'string' },
            media_hash: { type: 'string' },
            verdict: { type: 'string', enum: ['ai', 'human', 'uncertain', 'unavailable'] },
            confidence: { type: 'number' },
            signals: { type: 'array' },
            provenance: { type: 'object' },
            processing_time_ms: { type: 'number' },
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
    const requestId = uuidv4();

    // Parse options from fields
    const only = getFieldValue(data.fields.only)?.split(',').filter(Boolean);
    const excluding = getFieldValue(data.fields.excluding)?.split(',').filter(Boolean);
    const externalId = getFieldValue(data.fields.external_id);

    // Call inference service
    const result = await fastify.inference.detectImage(
      buffer,
      data.filename,
      data.mimetype,
      { only, excluding, includeProvenance: true }
    );

    // Calculate aggregate verdict
    const aiSignals = result.signals.filter(s => s.verdict === 'ai');
    const humanSignals = result.signals.filter(s => s.verdict === 'human');

    let verdict = 'uncertain';
    let confidence = 0.5;

    if (aiSignals.length > humanSignals.length) {
      verdict = 'ai';
      confidence = aiSignals.reduce((sum, s) => sum + s.confidence, 0) / aiSignals.length;
    } else if (humanSignals.length > aiSignals.length) {
      verdict = 'human';
      confidence = humanSignals.reduce((sum, s) => sum + s.confidence, 0) / humanSignals.length;
    }

    // Record usage
    await recordUsage(fastify, request.apiKey!.id, 'image', true);

    return {
      request_id: requestId,
      timestamp: new Date().toISOString(),
      media_type: 'image',
      media_hash: result.media_hash,
      verdict,
      confidence,
      signals: result.signals,
      provenance: {
        verity_container: false, // TODO: Check for .verity container
        c2pa: result.provenance?.c2pa || null,
        watermark: result.provenance?.watermark || null,
      },
      processing_time_ms: result.processing_time_ms,
      external_id: externalId,
    };
  });

  // Detect AI in video
  fastify.post('/detect/video', {
    schema: {
      tags: ['detect'],
      description: 'Detect AI-generated content in a video',
      security: [{ bearerAuth: [] }],
      consumes: ['multipart/form-data'],
    },
  }, async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: { code: 'NO_FILE', message: 'No file uploaded' } });
    }

    const buffer = await data.toBuffer();
    const requestId = uuidv4();

    const only = getFieldValue(data.fields.only)?.split(',').filter(Boolean);
    const excluding = getFieldValue(data.fields.excluding)?.split(',').filter(Boolean);
    const externalId = getFieldValue(data.fields.external_id);

    const result = await fastify.inference.detectVideo(
      buffer,
      data.filename,
      data.mimetype,
      { only, excluding, includeProvenance: true }
    );

    // Calculate aggregate verdict
    const signals = result.signals.filter(s => s.verdict !== 'unavailable');
    const avgConfidence = signals.length > 0
      ? signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length
      : 0.5;

    const aiCount = signals.filter(s => s.verdict === 'ai').length;
    const verdict = aiCount > signals.length / 2 ? 'ai' : aiCount === 0 ? 'human' : 'uncertain';

    await recordUsage(fastify, request.apiKey!.id, 'video', true);

    return {
      request_id: requestId,
      timestamp: new Date().toISOString(),
      media_type: 'video',
      media_hash: result.media_hash,
      verdict,
      confidence: avgConfidence,
      signals: result.signals,
      provenance: result.provenance || null,
      processing_time_ms: result.processing_time_ms,
      external_id: externalId,
    };
  });

  // Detect AI in audio
  fastify.post('/detect/audio', {
    schema: {
      tags: ['detect'],
      description: 'Detect AI-generated content in audio',
      security: [{ bearerAuth: [] }],
      consumes: ['multipart/form-data'],
    },
  }, async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: { code: 'NO_FILE', message: 'No file uploaded' } });
    }

    const buffer = await data.toBuffer();
    const requestId = uuidv4();

    const only = getFieldValue(data.fields.only)?.split(',').filter(Boolean);
    const excluding = getFieldValue(data.fields.excluding)?.split(',').filter(Boolean);
    const externalId = getFieldValue(data.fields.external_id);

    const result = await fastify.inference.detectAudio(
      buffer,
      data.filename,
      data.mimetype,
      { only, excluding }
    );

    const signals = result.signals.filter(s => s.verdict !== 'unavailable');
    const avgConfidence = signals.length > 0
      ? signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length
      : 0.5;

    const aiCount = signals.filter(s => s.verdict === 'ai').length;
    const verdict = aiCount > signals.length / 2 ? 'ai' : aiCount === 0 ? 'human' : 'uncertain';

    await recordUsage(fastify, request.apiKey!.id, 'audio', true);

    return {
      request_id: requestId,
      timestamp: new Date().toISOString(),
      media_type: 'audio',
      media_hash: result.media_hash,
      verdict,
      confidence: avgConfidence,
      signals: result.signals,
      processing_time_ms: result.processing_time_ms,
      external_id: externalId,
    };
  });

  // Detect AI in text
  fastify.post('/detect/text', {
    schema: {
      tags: ['detect'],
      description: 'Detect AI-generated text',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['text'],
        properties: {
          text: { type: 'string', minLength: 1 },
          include_annotations: { type: 'boolean', default: false },
          external_id: { type: 'string' },
        },
      },
    },
  }, async (request) => {
    const { text, include_annotations, external_id } = request.body as {
      text: string;
      include_annotations?: boolean;
      external_id?: string;
    };

    const requestId = uuidv4();

    const result = await fastify.inference.detectText(text, {
      includeAnnotations: include_annotations,
    });

    const signal = result.signals[0];
    const verdict = signal?.verdict || 'uncertain';
    const confidence = signal?.confidence || 0.5;

    await recordUsage(fastify, request.apiKey!.id, 'text', true);

    return {
      request_id: requestId,
      timestamp: new Date().toISOString(),
      media_type: 'text',
      media_hash: result.media_hash,
      verdict,
      confidence,
      signals: result.signals,
      processing_time_ms: result.processing_time_ms,
      external_id,
    };
  });
};

async function recordUsage(
  fastify: any,
  apiKeyId: string,
  mediaType: 'image' | 'video' | 'audio' | 'text',
  success: boolean
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await fastify.prisma.usageRecord.upsert({
    where: {
      apiKeyId_date: {
        apiKeyId,
        date: today,
      },
    },
    create: {
      apiKeyId,
      date: today,
      requestCount: 1,
      successCount: success ? 1 : 0,
      failureCount: success ? 0 : 1,
      [`${mediaType}Count`]: 1,
    },
    update: {
      requestCount: { increment: 1 },
      successCount: success ? { increment: 1 } : undefined,
      failureCount: success ? undefined : { increment: 1 },
      [`${mediaType}Count`]: { increment: 1 },
    },
  });
}
