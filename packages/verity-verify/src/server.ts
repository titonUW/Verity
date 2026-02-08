/**
 * Verity Verify HTTP Server
 * Express server exposing the verification API
 */

import express, { Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { readContainer } from '@verity/file';
import { VerityVerifyEngine } from './engine.js';
import type { TrustReport } from './types.js';

export interface VerifyServerConfig {
  /** Port to listen on */
  port: number;
  /** Path to policies directory */
  policyDir?: string;
  /** Trusted capture key IDs */
  trustedCaptureKeyIds?: string[];
  /** Log public key for verification */
  logPublicKey?: string;
}

/**
 * Create the Express app for the verify server
 */
export function createVerifyServer(
  engine: VerityVerifyEngine
): express.Application {
  const app = express();

  // For JSON body (small payloads)
  app.use(express.json({ limit: '10mb' }));

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'verity-verify' });
  });

  // POST /verify - Verify a container (multipart form or JSON with base64)
  app.post('/verify', async (req: Request, res: Response, next: NextFunction) => {
    try {
      // For now, expect JSON with base64-encoded container
      const body = req.body as {
        container_base64?: string;
        workflow?: string;
      };

      if (!body.container_base64) {
        res.status(400).json({ error: 'Missing container_base64' });
        return;
      }

      // Decode and write to temp file
      const containerBuffer = Buffer.from(body.container_base64, 'base64');
      const tempPath = path.join(os.tmpdir(), `verity-verify-${Date.now()}.verity`);

      try {
        await fs.promises.writeFile(tempPath, containerBuffer);

        // Read and verify
        const container = await readContainer(tempPath);
        const report = await engine.verify(container, {
          workflow: body.workflow,
        });

        res.json({ trust_report: report });
      } finally {
        // Clean up temp file
        await fs.promises.unlink(tempPath).catch(() => {});
      }
    } catch (err) {
      next(err);
    }
  });

  // POST /verify/report - Get trust report for an already-read container
  app.post('/verify/report', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as {
        manifest: unknown;
        events: unknown;
        signatures: unknown;
        log_proof?: unknown;
        payload_sha256: string;
        workflow?: string;
      };

      // Minimal validation
      if (!body.manifest || !body.events || !body.signatures) {
        res.status(400).json({ error: 'Missing manifest, events, or signatures' });
        return;
      }

      // Note: This endpoint cannot verify payload hash since payload isn't sent
      // It's mainly for getting policy evaluation without sending full file

      res.status(501).json({ error: 'Not implemented - use /verify with full container' });
    } catch (err) {
      next(err);
    }
  });

  // Error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Verify server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

/**
 * Start the verify server
 */
export async function startVerifyServer(config: VerifyServerConfig): Promise<{
  app: express.Application;
  engine: VerityVerifyEngine;
  close: () => void;
}> {
  // Create engine
  const engine = new VerityVerifyEngine({
    trustedCaptureKeyIds: config.trustedCaptureKeyIds
      ? new Set(config.trustedCaptureKeyIds)
      : undefined,
    logPublicKey: config.logPublicKey,
  });

  // Load policies
  if (config.policyDir) {
    engine.loadPolicies(config.policyDir);
  }

  // Create and start server
  const app = createVerifyServer(engine);

  return new Promise((resolve) => {
    const server = app.listen(config.port, () => {
      console.log(`Verity Verify server listening on port ${config.port}`);
      resolve({
        app,
        engine,
        close: () => server.close(),
      });
    });
  });
}

// CLI entry point
if (process.argv[1]?.endsWith('server.js')) {
  const port = parseInt(process.env.PORT ?? '3002', 10);
  const policyDir = process.env.POLICY_DIR;
  const logPublicKey = process.env.LOG_PUBLIC_KEY;
  const trustedKeys = process.env.TRUSTED_CAPTURE_KEYS?.split(',').filter(Boolean);

  startVerifyServer({
    port,
    policyDir,
    logPublicKey,
    trustedCaptureKeyIds: trustedKeys,
  }).catch((err) => {
    console.error('Failed to start verify server:', err);
    process.exit(1);
  });
}
