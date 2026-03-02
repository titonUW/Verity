/**
 * AIorNot Compatibility Routes - Text
 *
 * POST /v2/text/sync - AI text detection
 */

import { FastifyPluginAsync } from 'fastify';
import { v4 as uuidv4 } from 'uuid';

export const v2TextRoutes: FastifyPluginAsync = async (fastify) => {
  // Authenticate all routes
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.post('/text/sync', {
    schema: {
      tags: ['compat'],
      description: 'AIorNot-compatible text detection endpoint',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['text'],
        properties: {
          text: { type: 'string', minLength: 1 },
          external_id: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            created_at: { type: 'string' },
            report: {
              type: 'object',
              properties: {
                ai_text: {
                  type: 'object',
                  properties: {
                    is_detected: { type: 'boolean' },
                    confidence: { type: 'number' },
                  },
                },
                annotations: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      start: { type: 'number' },
                      end: { type: 'number' },
                      ai: { type: 'boolean' },
                      confidence: { type: 'number' },
                    },
                  },
                },
              },
            },
            external_id: { type: 'string' },
          },
        },
      },
    },
  }, async (request) => {
    const { text, external_id } = request.body as {
      text: string;
      external_id?: string;
    };

    const id = uuidv4();

    // Call inference service
    const result = await fastify.inference.detectText(text, {
      includeAnnotations: true,
    });

    // Transform to AIorNot format
    const aiTextSignal = result.signals.find(s => s.name === 'ai_text');

    // Transform annotations
    const annotations = (aiTextSignal?.metadata?.annotations || []).map((a: any) => ({
      start: a.start,
      end: a.end,
      ai: a.ai || a.verdict === 'ai',
      confidence: a.confidence,
    }));

    return {
      id,
      created_at: new Date().toISOString(),
      report: {
        ai_text: {
          is_detected: aiTextSignal?.verdict === 'ai',
          confidence: aiTextSignal?.confidence || 0,
        },
        annotations,
      },
      external_id,
    };
  });
};
