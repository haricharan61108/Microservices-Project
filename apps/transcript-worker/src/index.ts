import { Worker } from "bullmq";
import IORedis from "ioredis";
import path from "path";
import { summarizationQueue } from "@repo/queue";

import { exec } from "child_process";

import { prisma } from "@repo/database";

const connection = new IORedis({
  host: "localhost",
  port: 6379,
  maxRetriesPerRequest: null
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

      exec(command, async (error, stdout) => {

        if (error) {

          console.error(error);

          await prisma.video.update({
            where: {
              id: videoId
            },
            data: {
              status: "FAILED"
            }
          });

          return;
        }

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

        console.log(
          "Transcript Generated"
        );

        // Add to summarization queue AFTER saving transcript
        console.log("Adding video to summarization queue:", videoId);

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
        console.log("Added to summarization queue");
      });
    } catch (error) {

      console.error(error);
    }
  },

  {
    connection
  }
);

console.log(
  "Transcript Worker Started"
);