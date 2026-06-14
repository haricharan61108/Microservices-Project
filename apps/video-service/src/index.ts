import express from "express";
import cors from "cors";

import { prisma } from "@repo/database";
import  { authMiddleware } from "./middleware/authMiddleware";
import type { AuthRequest } from "./middleware/authMiddleware";
import { videoQueue } from "@repo/queue";
import { logger, HealthCheck } from "@repo/logger";

const app = express();
const healthCheck = new HealthCheck("video-service");

app.use(cors());
app.use(express.json());

app.get("/health", healthCheck.handler.bind(healthCheck));
app.get("/ready", healthCheck.readinessHandler.bind(healthCheck));
app.get("/live", healthCheck.livenessHandler.bind(healthCheck));

app.post("/videos", authMiddleware, async (req: AuthRequest, res) => {
    try {
        const { url } = req.body;

      const userId = req.user!.userId;

      const video = await prisma.video.create({
        data: {
          url,
          userId,
          status: "PENDING"
        }
      });

      await videoQueue.add(
        "download-video",
        {
          videoId: video.id,
          url,
          userId
        }
      );

      return res.json({
        success: true,
        videoId: video.id
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        success: false,
        message: "Internal Server Error"
      });
    }
})

app.listen(3002, () => {
    logger.info("Video Service running on port 3002");
  });