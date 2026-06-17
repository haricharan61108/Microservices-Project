import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import path from "path";
import { connection,summarizationQueue,transcriptDLQ, moveJobToDLQ } from "@repo/queue";
import express from "express";
import { logger, HealthCheck } from "@repo/logger";
import { promisify } from "util";

import { exec } from "child_process";

import { prisma } from "@repo/database";

const execPromise = promisify(exec);
// Health check setup
const app = express();
const healthCheck = new HealthCheck("transcript-worker");

app.get("/health", healthCheck.handler.bind(healthCheck));
app.get("/ready", healthCheck.readinessHandler.bind(healthCheck));
app.get("/live", healthCheck.livenessHandler.bind(healthCheck));

const HEALTH_PORT = 3003;
app.listen(HEALTH_PORT, () => {
  logger.info(`Transcript Worker health check running on port ${HEALTH_PORT}`);
});

const worker = new Worker(
  "transcript-processing",

  async (job) => {

    const {
      videoId,
      localPath,
      userId
    } = job.data;

    try {

      await prisma.video.update({
        where: {
          id: videoId
        },
        data: {
          status: "TRANSCRIBING"
        }
      });

      const scriptPath = path.join(
        process.cwd(),
        "transcribe.py"
      );

      const pythonPath = path.join(
        process.cwd(),
        "venv_py313/bin/python3"
      );

      const command = `\"${pythonPath}\" \"${scriptPath}\" \"${localPath}\"`;

      const { stdout } = await execPromise(command);

      const transcript = stdout;

      await prisma.video.update({
        where: {
          id: videoId
        },
        data: {
          transcript,
          status: "TRANSCRIBED"
        }
      });

      logger.info("Transcript Generated", { videoId });
      logger.info("Adding video to summarization queue", { videoId });

      await summarizationQueue.add(
        "generate-summary",
        {
          videoId,
          userId
        },
        {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000
          }
        }
      );
      logger.info("Added to summarization queue", { videoId });
    } catch (error) {
      logger.error("Transcription failed", { videoId, error });
      throw error;
    }
  },

  {
    connection,
    settings: {
      backoffStrategy: (attemptsMade: number) => {
        return Math.min(1000 * Math.pow(2, attemptsMade), 30000);
      }
    }
  }
);


worker.on('failed', async (job: Job | undefined, err: Error) => {
  if (!job) {
    return;
  }

  const maxAttempts = job.opts.attempts || 3;

  if (job.attemptsMade >= maxAttempts) {
    // Job has exhausted all retries - move to DLQ
    logger.error(`Job ${job.id} exhausted all retries, moving to DLQ`, {
      jobId: job.id,
      attempts: job.attemptsMade,
      error: err.message
    });

    const { videoId, userId } = job.data;

    // Update video status to FAILED
    await prisma.video.update({
      where: { id: videoId },
      data: { status: "FAILED" }
    });

    // Move job to DLQ
    await moveJobToDLQ(job, transcriptDLQ, 'transcript-processing');
  } else {
    // Job will retry - just log it
    logger.warn(`Job ${job.id} failed (attempt ${job.attemptsMade}/${maxAttempts}), will retry`, {
      jobId: job.id,
      error: err.message
    });
  }
});
logger.info("Transcript Worker Started");