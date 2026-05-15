import fs from "fs";
import path from "path";

import { Worker } from "bullmq";
import IORedis from "ioredis";

import YTDlpWrap from "yt-dlp-wrap";

import { prisma } from "@repo/database";

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
  
      const { videoId, url } = job.data;
  
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
      }
    },
  
    {
      connection
    }
  );
  
  console.log("Download Worker Started");