import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { logger } from "./lib/logger.js";
import { apiRouter } from "./routes/index.js";

export const app = express();

// Security
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? "*",
    credentials: true,
  }),
);

// Logging
app.use(pinoHttp({ logger }));

// Body parsing
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
app.use("/api", apiRouter);

// Global error handler (Express 5 routes async errors here automatically)
app.use(
  (
    err: Error & { status?: number },
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    req.log.error({ err }, "Unhandled error");
    const status = err.status ?? 500;
    res.status(status).json({
      error: process.env.NODE_ENV === "production" ? "Internal server error" : err.message,
    });
  },
);
