/**
 * Verity Log HTTP Server
 * Express server exposing the transparency log API
 */

import express, { Request, Response, NextFunction } from 'express';
import { VerityLogService } from './log.js';
import { SqliteLogStore, InMemoryLogStore } from './store.js';
import type {
  AddEntryRequest,
  AddEntryResponse,
  GetCheckpointResponse,
  GetProofResponse,
  GetEntryResponse,
  LogServerConfig,
} from './types.js';

/**
 * Create the Express app for the log server
 */
export function createLogServer(logService: VerityLogService): express.Application {
  const app = express();
  app.use(express.json());

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'verity-log' });
  });

  // POST /entries - Add a new entry
  app.post('/entries', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as AddEntryRequest;

      if (!body.leaf_hash || typeof body.leaf_hash !== 'string') {
        res.status(400).json({ error: 'Missing or invalid leaf_hash' });
        return;
      }

      // Validate hex format
      if (!/^[a-f0-9]{64}$/i.test(body.leaf_hash)) {
        res.status(400).json({ error: 'leaf_hash must be 64-character hex string' });
        return;
      }

      const result = await logService.addLeaf(body.leaf_hash);

      const response: AddEntryResponse = {
        leaf_index: result.leafIndex,
        leaf_hash: result.leafHash,
        checkpoint: result.checkpoint,
      };

      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  });

  // GET /checkpoint - Get current checkpoint
  app.get('/checkpoint', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const checkpoint = await logService.getCheckpoint();
      const response: GetCheckpointResponse = { checkpoint };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  // GET /proof/:index - Get inclusion proof
  app.get('/proof/:index', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const index = parseInt(req.params.index, 10);

      if (isNaN(index) || index < 0) {
        res.status(400).json({ error: 'Invalid index' });
        return;
      }

      const { inclusionProof, checkpoint } = await logService.getInclusionProof(index);

      const response: GetProofResponse = {
        inclusion_proof: inclusionProof,
        checkpoint,
      };

      res.json(response);
    } catch (err) {
      if ((err as Error).message.includes('not found')) {
        res.status(404).json({ error: 'Entry not found' });
        return;
      }
      next(err);
    }
  });

  // GET /entry/:index - Get entry data
  app.get('/entry/:index', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const index = parseInt(req.params.index, 10);

      if (isNaN(index) || index < 0) {
        res.status(400).json({ error: 'Invalid index' });
        return;
      }

      const entry = await logService.getEntry(index);

      if (!entry) {
        res.status(404).json({ error: 'Entry not found' });
        return;
      }

      const response: GetEntryResponse = { entry };
      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  // GET /size - Get current tree size
  app.get('/size', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const size = await logService.getTreeSize();
      res.json({ tree_size: size });
    } catch (err) {
      next(err);
    }
  });

  // Error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Log server error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

/**
 * Start the log server
 */
export async function startLogServer(config: LogServerConfig): Promise<{
  app: express.Application;
  service: VerityLogService;
  close: () => Promise<void>;
}> {
  // Create store
  const store = new SqliteLogStore(config.dbPath);

  // Create log service
  const service = new VerityLogService(store, {
    privateKey: config.logPrivateKey,
    publicKey: config.logPublicKey,
    keyId: config.logKeyId,
  });

  // Create and start server
  const app = createLogServer(service);

  return new Promise((resolve) => {
    const server = app.listen(config.port, () => {
      console.log(`Verity Log server listening on port ${config.port}`);
      resolve({
        app,
        service,
        close: async () => {
          server.close();
          await service.close();
        },
      });
    });
  });
}

/**
 * Create an in-memory log server for testing
 */
export function createInMemoryLogServer(config: {
  privateKey: string;
  publicKey: string;
  keyId: string;
}): { app: express.Application; service: VerityLogService } {
  const store = new InMemoryLogStore();
  const service = new VerityLogService(store, config);
  const app = createLogServer(service);
  return { app, service };
}

// CLI entry point
if (process.argv[1]?.endsWith('server.js')) {
  const port = parseInt(process.env.PORT ?? '3001', 10);
  const dbPath = process.env.DB_PATH ?? './verity-log.db';
  const logPrivateKey = process.env.LOG_PRIVATE_KEY;
  const logPublicKey = process.env.LOG_PUBLIC_KEY;
  const logKeyId = process.env.LOG_KEY_ID ?? 'verity-log-key';

  if (!logPrivateKey || !logPublicKey) {
    console.error('LOG_PRIVATE_KEY and LOG_PUBLIC_KEY environment variables required');
    process.exit(1);
  }

  startLogServer({
    port,
    dbPath,
    logPrivateKey,
    logPublicKey,
    logKeyId,
  }).catch((err) => {
    console.error('Failed to start log server:', err);
    process.exit(1);
  });
}
