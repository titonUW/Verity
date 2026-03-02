/**
 * Verity API Server
 *
 * Main entry point for the Fastify API server.
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import formbody from '@fastify/formbody';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { getConfig, isDevelopment } from './config.js';
import { authPlugin } from './plugins/auth.js';
import { prismaPlugin } from './plugins/prisma.js';
import { redisPlugin } from './plugins/redis.js';
import { inferencePlugin } from './plugins/inference.js';

// Routes
import { systemRoutes } from './routes/system.js';
import { v1DetectRoutes } from './routes/v1/detect.js';
import { v1JobsRoutes } from './routes/v1/jobs.js';
import { v1KeysRoutes } from './routes/v1/keys.js';
import { v2ImageRoutes } from './routes/v2/image.js';
import { v2VideoRoutes } from './routes/v2/video.js';
import { v2TextRoutes } from './routes/v2/text.js';
import { compatReportsRoutes } from './routes/compat/reports.js';

async function main() {
  const config = getConfig();

  // Create Fastify instance
  const app = Fastify({
    logger: {
      level: isDevelopment() ? 'debug' : 'info',
      transport: isDevelopment()
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
    requestIdHeader: 'x-request-id',
    genReqId: () => crypto.randomUUID(),
  });

  // Register core plugins
  await app.register(cors, {
    origin: isDevelopment() ? true : ['https://verity.ai'],
    credentials: true,
  });

  await app.register(helmet, {
    contentSecurityPolicy: isDevelopment() ? false : undefined,
  });

  await app.register(formbody);

  await app.register(multipart, {
    limits: {
      fileSize: config.MAX_FILE_SIZE_MB * 1024 * 1024,
    },
  });

  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW_MS,
    redis: undefined, // Will be set up with redis plugin
  });

  // Swagger documentation
  if (config.ENABLE_SWAGGER) {
    await app.register(swagger, {
      openapi: {
        info: {
          title: 'Verity API',
          description: 'AI Content Authenticity Detection API',
          version: '1.0.0',
        },
        servers: [
          { url: 'http://localhost:3000', description: 'Development' },
          { url: 'https://api.verity.ai', description: 'Production' },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              description: 'API key authentication',
            },
          },
        },
        tags: [
          { name: 'system', description: 'System endpoints' },
          { name: 'detect', description: 'Detection endpoints' },
          { name: 'jobs', description: 'Async job management' },
          { name: 'keys', description: 'API key management' },
          { name: 'compat', description: 'Compatibility endpoints' },
        ],
      },
    });

    await app.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: true,
      },
    });
  }

  // Register custom plugins
  await app.register(prismaPlugin);
  await app.register(redisPlugin);
  await app.register(authPlugin);
  await app.register(inferencePlugin);

  // Register routes
  await app.register(systemRoutes);
  await app.register(v1DetectRoutes, { prefix: '/api/v1' });
  await app.register(v1JobsRoutes, { prefix: '/api/v1' });
  await app.register(v1KeysRoutes, { prefix: '/api/v1' });
  await app.register(v2ImageRoutes, { prefix: '/v2' });
  await app.register(v2VideoRoutes, { prefix: '/v2' });
  await app.register(v2TextRoutes, { prefix: '/v2' });
  await app.register(compatReportsRoutes, { prefix: '/v1' });

  // Error handler
  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);

    if (error.validation) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request',
          details: error.validation,
        },
      });
    }

    const statusCode = error.statusCode || 500;
    return reply.status(statusCode).send({
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: isDevelopment() ? error.message : 'An error occurred',
        request_id: request.id,
      },
    });
  });

  // Start server
  try {
    await app.listen({ port: config.PORT, host: config.HOST });
    app.log.info(`Server listening on ${config.HOST}:${config.PORT}`);

    if (config.ENABLE_SWAGGER) {
      app.log.info(`API documentation available at http://${config.HOST}:${config.PORT}/docs`);
    }
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
