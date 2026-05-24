import { Queue } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis({
    host: "localhost",
    port: 6379,
    maxRetriesPerRequest: null
  });

  export const videoQueue = new Queue(
    "video-processing",
    {
        connection
    }
  )

  export const transcriptQueue = new Queue(
    "transcript-processing",
    {
      connection
    }
  )

  export const summarizationQueue = new Queue(
    "summarization-processing",
    {
      connection
    }
  )