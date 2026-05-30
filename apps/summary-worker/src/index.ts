import { Worker } from "bullmq";
import IORedis from "ioredis";
import { summarizeTranscript } from "@repo/ai";
import { prisma } from "@repo/database";
import WebSocket from "ws";

// WebSocket connection for real-time updates
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
  const delay = Math.min(1000 * Math.pow(2,
reconnectAttempts), MAX_RECONNECT_DELAY);
  reconnectAttempts++;
  console.log(`Reconnecting in ${delay}ms (attempt 
${reconnectAttempts})...`);
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

// Redis connection
const connection = new IORedis({
  host: "localhost",
  port: 6379,
  maxRetriesPerRequest: null
});



// Create Worker
const worker = new Worker(
  "summarization-processing",

  async (job) => {
    console.log("Processing Summarization Job:", job.id);

    const { videoId, userId } = job.data;

    try {
      // Update status to PROCESSING
      await prisma.video.update({
        where: { id: videoId },
        data: { summaryStatus: "PROCESSING" }
      });

      sendWebSocketMessage({
        type: "SUMMARY_STATUS",
        userId,
        videoId,
        status: "PROCESSING"
      });

      console.log("Fetching transcript for video:",
videoId);

      
      const video = await prisma.video.findUnique({
        where: { id: videoId }
      });

      if (!video) {
        throw new Error(`Video ${videoId} not found`);
      }

      if (!video.transcript) {
        throw new Error(`No transcript found for video 
${videoId}`);
      }

      const summary = await summarizeTranscript(
        video.transcript
      );

      console.log("Summary generated successfully");

      // Update database with summary
      await prisma.video.update({
        where: { id: videoId },
        data: {
          summary,
          summaryStatus: "COMPLETED",
          summaryError: null,
          status: "COMPLETED"
        }
      });

      sendWebSocketMessage({
        type: "SUMMARY_STATUS",
        userId,
        videoId,
        status: "COMPLETED",
        summary
      });

      console.log("Summary saved to database for video:",
videoId);

    } catch (error: any) {
      console.error("Summarization failed:", error);

      await prisma.video.update({
        where: { id: videoId },
        data: {
          summaryStatus: "FAILED",
          summaryError: error.message
        }
      });

      sendWebSocketMessage({
        type: "SUMMARY_STATUS",
        userId,
        videoId,
        status: "FAILED",
        error: error.message
      });
    }
  },

  {
    connection
  }
);

console.log("Summary Worker Started");