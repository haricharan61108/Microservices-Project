import express from "express";
import cors from "cors";
import axios from "axios";
import { logger, HealthCheck } from "@repo/logger";
import {
    LoginRequest,
    LoginResponse
  } from "@repo/shared-types";

const app = express();
const healthCheck = new HealthCheck("gateway");

healthCheck.addDependency("auth-service", async () => {
  try {
    const response = await
axios.get("http://localhost:3001/health", {
      timeout: 3000
    });
    return response.status === 200;
  } catch (error) {
    return false;
  }
});

app.use(cors());
app.use(express.json());

app.get("/health",
  healthCheck.handler.bind(healthCheck));
  app.get("/ready",
  healthCheck.readinessHandler.bind(healthCheck));
  app.get("/live",
  healthCheck.livenessHandler.bind(healthCheck));

  app.get("/", (_, res) => {
    res.json({
      service: "Gateway",
      status: "running"
    });
  });

app.get("/", (_, res) => {
  res.json({
    service: "Gateway",
    status: "running"
  });
});

app.post("/auth/login", async (req, res) => {

    const body: LoginRequest = req.body;
  
    try {
  
      const response = await axios.post<LoginResponse>(
        "http://localhost:3001/login",
        body
      );
  
      return res.json(response.data);
  
    } catch (error) {
  
      return res.status(500).json({
        success: false,
        message: "Gateway Error"
      });
    }
  });

app.listen(3000, () => {
   logger.info("Gateway running on port 3000");
});