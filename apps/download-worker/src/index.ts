import fs from "fs";
import path from "path";

import { Worker, Job } from "bullmq";
import { connection, videoDLQ, moveJobToDLQ } from '@repo/queue';
import YTDlpWrap from "yt-dlp-wrap";

import { prisma } from "@repo/database";

import WebSocket from "ws";
import { transcriptQueue } from "@repo/queue";
import express from "express";
import { logger, HealthCheck } from "@repo/logger";

let ws: WebSocket | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000; 

function connectWebSocket() {
  try {
    ws = new WebSocket("ws://localhost:8080");

    ws.on("open", () => {
      console.log("Connected to Socket Service");
      reconnectAttempts = 0;
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error.message);
    });

    ws.on("close", () => {
      console.log("Disconnected from Socket Service. Reconnecting...");
      scheduleReconnect();
    });
  } catch (error) {
    console.error("Failed to create WebSocket:", error);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
  reconnectAttempts++;

  console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts})...`);
  setTimeout(connectWebSocket, delay);
}

function sendWebSocketMessage(message: any) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  } else {
    console.warn("WebSocket not connected. Message not sent:", message);
  }
}

connectWebSocket();

  const ytDlpWrap = new YTDlpWrap();

  // Health check setup
  const app = express();
  const healthCheck = new HealthCheck("download-worker");

  app.get("/health", healthCheck.handler.bind(healthCheck));
  app.get("/ready", healthCheck.readinessHandler.bind(healthCheck));
  app.get("/live", healthCheck.livenessHandler.bind(healthCheck));

  const HEALTH_PORT = 3004;
  app.listen(HEALTH_PORT, () => {
    logger.info(`Download Worker health check running on port ${HEALTH_PORT}`);
  });

  const worker = new Worker(
    "video-processing",
  
    async (job) => {
  
      console.log("Processing Job:", job.id);
  
      const { videoId, url, userId } = job.data;
  
      try {
  
        await prisma.video.update({
          where: {
            id: videoId
          },
          data: {
            status: "DOWNLOADING"
          }
        });

        
  
        const downloadsDir = path.join(
          process.cwd(),
          "downloads"
        );
  
        if (!fs.existsSync(downloadsDir)) {
          fs.mkdirSync(downloadsDir);
        }
  
        const outputPath = path.join(
          downloadsDir,
          `${videoId}.mp4`
        );
  
        console.log("Starting Download...");

        sendWebSocketMessage({
          type: "VIDEO_STATUS",
          userId,
          videoId,
          status: "DOWNLOADING"
        });
  
        await ytDlpWrap.execPromise([
          url,
          "-f",
          "mp4",
          "-o",
          outputPath
        ]);
  
        console.log("Download Completed");



        await prisma.video.update({
          where: {
            id: videoId
          },
          data: {
            status: "DOWNLOADED",
            localPath: outputPath
          }
        });

        sendWebSocketMessage({
          type: "VIDEO_STATUS",
          userId,
          videoId,
          status: "DOWNLOADED"
        });

        await transcriptQueue.add(
          "generate-transcript",
          {
            videoId,
            userId,
            localPath: outputPath
          }
        );
  
      } catch (error) {
  
        console.error(error);
  
        throw error;
      }
    },
  
    {
      connection,
    }
  );

  worker.on('failed' , async (job: Job | undefined, err: Error) => {
    if(!job) {
      return ;
    }

    const maxAttempts = job.opts.attempts || 3;
    if(job.attemptsMade >= maxAttempts) {
      logger.error(`Job ${job.id} exhausted all retries, moving to DLQ`, {
        jobId: job.id,
        attempts: job.attemptsMade,
        error: err.message
      });
      const { videoId, userId } = job.data;
      await prisma.video.update({
        where: { id: videoId },
        data: { status: "FAILED" }
      });

      sendWebSocketMessage({
        type: "VIDEO_STATUS",
        userId,
        videoId,
        status: "FAILED"
      });
      await moveJobToDLQ(job, videoDLQ, 'video-processing');
    }
    else {
      // Log retry attempt
      logger.warn(`Job ${job.id} failed (attempt ${job.attemptsMade}/${maxAttempts}), will retry`, {
        jobId: job.id,
        error: err.message
      });
    }
  })
  
  logger.info("Download Worker Started");