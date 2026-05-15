import express from "express";
import cors from "cors";

import { prisma } from "@repo/database";
import  { authMiddleware } from "./middleware/authMiddleware";
import type { AuthRequest } from "./middleware/authMiddleware";
import { videoQueue } from "@repo/queue";

const app = express();

app.use(cors());
app.use(express.json());

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
          url
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
    console.log("Video Service running on port 3002");
  });