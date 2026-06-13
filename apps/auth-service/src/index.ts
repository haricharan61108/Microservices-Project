import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { logger, HealthCheck } from "@repo/logger";

import { prisma } from "@repo/database";

const app = express();
const healthCheck = new HealthCheck("auth-service");

app.use(cors());
app.use(express.json());

app.get("/health",
  healthCheck.handler.bind(healthCheck));
  app.get("/ready",
  healthCheck.readinessHandler.bind(healthCheck));
  app.get("/live",
  healthCheck.livenessHandler.bind(healthCheck));


app.post("/register", async (req, res) => {

  try {

    const { email, password } = req.body;

    const existingUser = await prisma.user.findUnique({
      where: {
        email
      }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword
      }
    });

    return res.json({
      success: true,
      user
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
});

app.post("/login", async (req, res) => {

  try {

    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: {
        email
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const isPasswordCorrect = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email
      },
      process.env.JWT_SECRET!,
      {
        expiresIn: "7d"
      }
    );

    return res.json({
      success: true,
      token
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
});

app.listen(3001, () => {
  logger.info("Auth Service running on port 3001");
});