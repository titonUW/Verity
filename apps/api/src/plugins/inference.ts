/**
 * Inference Plugin
 *
 * Client for communicating with the Python inference service.
 */

import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { request, FormData, File } from 'undici';
import { getConfig } from '../config.js';

export interface InferenceResult {
  media_hash: string;
  media_type: string;
  signals: Array<{
    name: string;
    verdict: string;
    confidence: number;
    model_version: string;
    processing_time_ms?: number;
    error?: string;
    metadata?: Record<string, unknown>;
  }>;
  provenance?: {
    c2pa?: Record<string, unknown>;
    watermark?: Record<string, unknown>;
  };
  processing_time_ms: number;
}

declare module 'fastify' {
  interface FastifyInstance {
    inference: {
      detectImage: (
        file: Buffer,
        filename: string,
        contentType: string,
        options?: InferenceOptions
      ) => Promise<InferenceResult>;
      detectVideo: (
        file: Buffer,
        filename: string,
        contentType: string,
        options?: InferenceOptions
      ) => Promise<InferenceResult>;
      detectAudio: (
        file: Buffer,
        filename: string,
        contentType: string,
        options?: InferenceOptions
      ) => Promise<InferenceResult>;
      detectText: (
        text: string,
        options?: InferenceOptions
      ) => Promise<InferenceResult>;
      healthCheck: () => Promise<boolean>;
    };
  }
}

interface InferenceOptions {
  only?: string[];
  excluding?: string[];
  includeProvenance?: boolean;
  includeAnnotations?: boolean;
}

const inferencePluginImpl: FastifyPluginAsync = async (fastify) => {
  const config = getConfig();
  const baseUrl = config.INFERENCE_URL;

  async function detectMedia(
    endpoint: string,
    file: Buffer,
    filename: string,
    contentType: string,
    options: InferenceOptions = {}
  ): Promise<InferenceResult> {
    const formData = new FormData();
    formData.append('file', new File([file], filename, { type: contentType }));

    if (options.only?.length) {
      formData.append('only', options.only.join(','));
    }
    if (options.excluding?.length) {
      formData.append('excluding', options.excluding.join(','));
    }
    if (options.includeProvenance !== undefined) {
      formData.append('include_provenance', String(options.includeProvenance));
    }

    const response = await request(`${baseUrl}/detect/${endpoint}`, {
      method: 'POST',
      body: formData,
    });

    if (response.statusCode !== 200) {
      const body = await response.body.text();
      throw new Error(`Inference service error: ${response.statusCode} - ${body}`);
    }

    return response.body.json() as Promise<InferenceResult>;
  }

  fastify.decorate('inference', {
    detectImage: (file, filename, contentType, options) =>
      detectMedia('image', file, filename, contentType, options),

    detectVideo: (file, filename, contentType, options) =>
      detectMedia('video', file, filename, contentType, options),

    detectAudio: (file, filename, contentType, options) =>
      detectMedia('audio', file, filename, contentType, options),

    detectText: async (text: string, options: InferenceOptions = {}): Promise<InferenceResult> => {
      const formData = new FormData();
      formData.append('text', text);

      if (options.includeAnnotations) {
        formData.append('include_annotations', 'true');
      }

      const response = await request(`${baseUrl}/detect/text`, {
        method: 'POST',
        body: formData,
      });

      if (response.statusCode !== 200) {
        const body = await response.body.text();
        throw new Error(`Inference service error: ${response.statusCode} - ${body}`);
      }

      return response.body.json() as Promise<InferenceResult>;
    },

    healthCheck: async (): Promise<boolean> => {
      try {
        const response = await request(`${baseUrl}/health`, {
          method: 'GET',
        });
        return response.statusCode === 200;
      } catch {
        return false;
      }
    },
  });
};

export const inferencePlugin = fp(inferencePluginImpl, {
  name: 'inference',
});
