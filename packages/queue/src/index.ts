import { Queue } from "bullmq";
import { connection } from "./connection";

export { connection };

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

  export {
    videoDLQ,
    transcriptDLQ,
    summarizationDLQ,
    moveJobToDLQ,
    getDLQJobs,
    replayJobFromDLQ,
    clearDLQ,
    type DLQJobData,
  } from "./dlq";