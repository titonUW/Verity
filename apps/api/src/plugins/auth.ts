/**
 * Authentication Plugin
 *
 * Handles API key authentication and user session management.
 */

import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import bcrypt from 'bcrypt';
import { getConfig } from '../config.js';

declare module 'fastify' {
  interface FastifyRequest {
    apiKey?: {
      id: string;
      userId: string;
      scopes: string[];
      tier: string;
    };
    user?: {
      id: string;
      email: string;
      role: string;
    };
  }

  interface FastifyInstance {
    authenticate: (request: FastifyRequest) => Promise<void>;
    authenticateOptional: (request: FastifyRequest) => Promise<void>;
    hashApiKey: (key: string) => Promise<string>;
    verifyApiKey: (key: string, hash: string) => Promise<boolean>;
    generateApiKey: () => string;
  }
}

const authPluginImpl: FastifyPluginAsync = async (fastify) => {
  const config = getConfig();

  /**
   * Hash an API key for storage
   */
  fastify.decorate('hashApiKey', async (key: string): Promise<string> => {
    return bcrypt.hash(key + config.API_KEY_SALT, 12);
  });

  /**
   * Verify an API key against its hash
   */
  fastify.decorate('verifyApiKey', async (key: string, hash: string): Promise<boolean> => {
    return bcrypt.compare(key + config.API_KEY_SALT, hash);
  });

  /**
   * Generate a new API key
   */
  fastify.decorate('generateApiKey', (): string => {
    const prefix = 'vty_';
    const randomPart = crypto.randomUUID().replace(/-/g, '') +
                       crypto.randomUUID().replace(/-/g, '');
    return prefix + randomPart.slice(0, 48);
  });

  /**
   * Authenticate request (required)
   */
  fastify.decorate('authenticate', async (request: FastifyRequest): Promise<void> => {
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw { statusCode: 401, message: 'Missing authorization header' };
    }

    const [scheme, token] = authHeader.split(' ');

    if (scheme.toLowerCase() !== 'bearer' || !token) {
      throw { statusCode: 401, message: 'Invalid authorization format. Use: Bearer <api_key>' };
    }

    // Look up API key by prefix
    const prefix = token.slice(0, 12); // "vty_" + 8 chars

    const apiKey = await fastify.prisma.apiKey.findFirst({
      where: {
        keyPrefix: prefix,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      include: {
        user: true,
      },
    });

    if (!apiKey) {
      throw { statusCode: 401, message: 'Invalid API key' };
    }

    // Verify full key
    const isValid = await fastify.verifyApiKey(token, apiKey.keyHash);
    if (!isValid) {
      throw { statusCode: 401, message: 'Invalid API key' };
    }

    // Update last used
    await fastify.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    // Set request context
    request.apiKey = {
      id: apiKey.id,
      userId: apiKey.userId,
      scopes: apiKey.scopes,
      tier: apiKey.rateLimitTier,
    };

    request.user = {
      id: apiKey.user.id,
      email: apiKey.user.email,
      role: apiKey.user.role,
    };
  });

  /**
   * Authenticate request (optional - don't fail if no auth)
   */
  fastify.decorate('authenticateOptional', async (request: FastifyRequest): Promise<void> => {
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      return; // No auth provided, continue without user context
    }

    try {
      await fastify.authenticate(request);
    } catch {
      // Ignore auth errors for optional auth
    }
  });

  /**
   * Check if request has required scope
   */
  fastify.decorateRequest('hasScope', function (this: FastifyRequest, scope: string): boolean {
    if (!this.apiKey) return false;

    // Check for wildcard scope
    if (this.apiKey.scopes.includes('*')) return true;

    // Check for category wildcard (e.g., "detect:*")
    const category = scope.split(':')[0];
    if (this.apiKey.scopes.includes(`${category}:*`)) return true;

    return this.apiKey.scopes.includes(scope);
  });
};

export const authPlugin = fp(authPluginImpl, {
  name: 'auth',
  dependencies: ['prisma'],
});
