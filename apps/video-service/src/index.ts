import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { exec } from "child_process";

import { prisma } from "@repo/database";
import  { authMiddleware } from "./middleware/authMiddleware";
import type { AuthRequest } from "./middleware/authMiddleware";

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
          status: "DOWNLOADING"
        }
      });

      const outputDir = path.join(process.cwd(), "downloads");

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
      }

      const outputPath = path.join(
        outputDir,
        `${video.id}.mp4`
      );

      const command = `yt-dlp -f mp4 -o "${outputPath}" "${url}"`;

      exec(command, async (error) => {

        if (error) {

          console.error(error);

          await prisma.video.update({
            where: {
              id: video.id
            },
            data: {
              status: "FAILED"
            }
          });

          return;
        }

        await prisma.video.update({
          where: {
            id: video.id
          },
          data: {
            status: "DOWNLOADED",
            localPath: outputPath
          }
        });
      });

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