import express from "express";
import cors from "cors";
import axios from "axios";
import {
    LoginRequest,
    LoginResponse
  } from "@repo/shared-types";

const app = express();

app.use(cors());
app.use(express.json());

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
    console.log("Gateway running on port 3000");
});