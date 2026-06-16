import {Queue, Job} from 'bullmq';
import {connection} from "./connection";
import { logger } from "@repo/logger";

// Create DLQ queues for each worker
export const videoDLQ = new Queue("video-processing-dlq", { connection });
export const transcriptDLQ = new Queue("transcript-processing-dlq", { connection });
export const summarizationDLQ = new Queue("summarization-processing-dlq", { connection });

export interface DLQJobData {
    originalJobId: string;
    originalQueue: string;
    failureReason: string;
    failedAt: Date;
    attemptsMade: number;
    originalData: any;
    errorStack?: string;
  }


  export async function moveJobToDLQ(
    job: Job,
    dlqQueue: Queue,
    originalQueue: string
  ) : Promise<void> {
    try {
        const dlqData: DLQJobData = {
            originalJobId: job.id!,
            originalQueue,
            failureReason: job.failedReason || "Unknown error",
            failedAt: new Date(),
            attemptsMade: job.attemptsMade,
            originalData: job.data,
            errorStack: job.stacktrace?.join("\n"),
          };

          await dlqQueue.add(`dlq-${job.id}`, dlqData, {
            // DLQ jobs don't need retries
            attempts: 1,
            removeOnComplete: false, 
            removeOnFail: false, 
          });
    logger.info(`Job ${job.id} moved to DLQ:  ${dlqQueue.name}`, {
                  jobId: job.id,
                  queue: originalQueue,
                  reason: job.failedReason,
                });
    } catch (error) {
        logger.error(`Failed to move job ${job.id} to DLQ`,
            {
                  error: error instanceof Error ? error.message : "Unknown error",
                  jobId: job.id,
                  queue: originalQueue,
                });
    }
  }

export async function getDLQJobs(dlqQueue: Queue): 
  Promise<Job[]> {
    const jobs = await dlqQueue.getJobs(["completed", "failed", "waiting"]);
    return jobs;
  }


  export async function replayJobFromDLQ(
    dlqJob: Job,
    originalQueue: Queue
  ): Promise<void> {
    const dlqData = dlqJob.data as DLQJobData;

    await originalQueue.add(
      `replay-${dlqData.originalJobId}`,
      dlqData.originalData,
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
      }
    );

    // Remove from DLQ after successful replay
    await dlqJob.remove();

    logger.info(`Job ${dlqData.originalJobId} replayed from DLQ to ${originalQueue.name}`);
  }

  export async function clearDLQ(dlqQueue: Queue): 
  Promise<void> {
    await dlqQueue.obliterate({ force: true });
    logger.warn(`DLQ cleared: ${dlqQueue.name}`);
  }