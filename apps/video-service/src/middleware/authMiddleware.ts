import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
    user? : {
        userId: string;
        email: string;
    }
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
          success: false,
          message: "No token provided"
        });
      }
    
      const token = authHeader.split(" ")[1];

      try {
        if(!token) {
          return res.status(401).json({
            success: false,
            message: "No token provided"
          });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
            userId: string;
            email: string;
        }
    
        req.user = decoded;
    
        next();
    
      } catch (error) {
    
        return res.status(401).json({
          success: false,
          message: "Invalid token"
        });
      }
}