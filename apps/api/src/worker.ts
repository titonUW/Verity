/**
 * Detection Worker
 *
 * Processes async detection jobs from the queue.
 */

import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { request, FormData, File } from 'undici';
import { getConfig } from './config.js';

interface JobData {
  jobId: string;
  mediaType: string;
  mimeType: string;
  filename: string;
  only?: string[];
  excluding?: string[];
}

async function main() {
  const config = getConfig();

  const prisma = new PrismaClient();
  const redis = new Redis(config.REDIS_URL);

  console.log('Starting detection worker...');

  const worker = new Worker<JobData>(
    'detection',
    async (job: Job<JobData>) => {
      const { jobId, mediaType, mimeType, filename, only, excluding } = job.data;

      console.log(`Processing job ${jobId} (${mediaType})`);

      try {
        // Update job status
        await prisma.detectionJob.update({
          where: { id: jobId },
          data: {
            status: 'PROCESSING',
            startedAt: new Date(),
            progress: 10,
          },
        });

        // Get file from Redis
        const fileData = await redis.get(`job:file:${jobId}`);
        if (!fileData) {
          throw new Error('File not found in cache');
        }

        const buffer = Buffer.from(fileData, 'base64');

        // Update progress
        await prisma.detectionJob.update({
          where: { id: jobId },
          data: { progress: 30 },
        });

        // Call inference service
        const formData = new FormData();
        formData.append('file', new File([buffer], filename, { type: mimeType }));

        if (only?.length) {
          formData.append('only', only.join(','));
        }
        if (excluding?.length) {
          formData.append('excluding', excluding.join(','));
        }

        const response = await request(`${config.INFERENCE_URL}/detect/${mediaType}`, {
          method: 'POST',
          body: formData,
        });

        if (response.statusCode !== 200) {
          const body = await response.body.text();
          throw new Error(`Inference error: ${response.statusCode} - ${body}`);
        }

        const result = await response.body.json() as any;

        // Update progress
        await prisma.detectionJob.update({
          where: { id: jobId },
          data: { progress: 80 },
        });

        // Store results
        for (const signal of result.signals) {
          await prisma.detectionResult.create({
            data: {
              jobId,
              signalName: signal.name,
              verdict: signal.verdict.toUpperCase(),
              confidence: signal.confidence,
              modelVersion: signal.model_version,
              processingMs: signal.processing_time_ms,
              error: signal.error,
              metadata: signal.metadata,
            },
          });
        }

        // Mark job as completed
        await prisma.detectionJob.update({
          where: { id: jobId },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            progress: 100,
          },
        });

        // Clean up file from Redis
        await redis.del(`job:file:${jobId}`);

        // Send webhook if configured
        const job_record = await prisma.detectionJob.findUnique({
          where: { id: jobId },
        });

        if (job_record?.webhookUrl) {
          try {
            await request(job_record.webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                job_id: jobId,
                status: 'completed',
                result,
              }),
            });

            await prisma.detectionJob.update({
              where: { id: jobId },
              data: { webhookSent: true },
            });
          } catch (err) {
            console.error(`Failed to send webhook for job ${jobId}:`, err);
          }
        }

        console.log(`Job ${jobId} completed successfully`);

      } catch (error) {
        console.error(`Job ${jobId} failed:`, error);

        // Mark job as failed
        await prisma.detectionJob.update({
          where: { id: jobId },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        });

        // Clean up
        await redis.del(`job:file:${jobId}`);

        throw error;
      }
    },
    {
      connection: {
        host: new URL(config.REDIS_URL).hostname,
        port: parseInt(new URL(config.REDIS_URL).port || '6379'),
      },
      concurrency: 3,
    }
  );

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('Shutting down worker...');
    await worker.close();
    await prisma.$disconnect();
    await redis.quit();
    process.exit(0);
  });

  console.log('Worker started, waiting for jobs...');
}

main().catch((err) => {
  console.error('Worker failed to start:', err);
  process.exit(1);
});
