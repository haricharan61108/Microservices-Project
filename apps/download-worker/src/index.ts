import fs from "fs";
import path from "path";

import { Worker } from "bullmq";
import IORedis from "ioredis";

import YTDlpWrap from "yt-dlp-wrap";

import { prisma } from "@repo/database";

import WebSocket from "ws";
import { transcriptQueue } from "@repo/queue";

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

const connection = new IORedis({
    host: "localhost",
    port: 6379,
    maxRetriesPerRequest: null
  });
  
  const ytDlpWrap = new YTDlpWrap();
  
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
  
        await prisma.video.update({
          where: {
            id: videoId
          },
          data: {
            status: "FAILED"
          }
        });
        sendWebSocketMessage({
          type: "VIDEO_STATUS",
          userId,
          videoId,
          status: "FAILED"
        });
      }
    },
  
    {
      connection
    }
  );
  
  console.log("Download Worker Started");