import { Request, Response } from "express";
import logger from "./index";

interface HealthCheckDependency {
    name: string;
    check: () => Promise<boolean>;
}

export class HealthCheck {
    private serviceName: string;
    private dependencies: HealthCheckDependency[] = [];

    constructor(serviceName: string) {
      this.serviceName = serviceName;
    }
    addDependency(name: string, check: () => Promise<boolean>) {
        this.dependencies.push({ name, check });
    }

    async handler(req: Request, res: Response) {
        const startTime = Date.now();
        const healthStatus: any = {
          service: this.serviceName,
          status: "healthy",
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          dependencies: {},
        };
  
        let allHealthy = true;

        for (const dep of this.dependencies) {
            try {
              const isHealthy = await dep.check();
              healthStatus.dependencies[dep.name] = {
                status: isHealthy ? "healthy" : "unhealthy",
              };
              if (!isHealthy) allHealthy = false;
            } catch (error) {
              healthStatus.dependencies[dep.name] = {
                status: "unhealthy",
                error: error instanceof Error ? error.message : "Unknown error",
              };
              allHealthy = false;
            }
          }
    
          healthStatus.status = allHealthy ? "healthy" :  "unhealthy";
          healthStatus.responseTime = `${Date.now() - startTime}ms`;
    
          const statusCode = allHealthy ? 200 : 503;
    
          if (!allHealthy) {
            logger.warn(`Health check failed for ${this.serviceName}`, healthStatus);
          }
    
          res.status(statusCode).json(healthStatus);
        }
    
        readinessHandler(req: Request, res: Response) {
          res.status(200).send("OK");
        }
    
        livenessHandler(req: Request, res: Response) {
          res.status(200).send("OK");
        }
}