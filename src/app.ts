import express, { Express } from "express";
import cors from "cors";
import morgan from "morgan";
import { env } from "./config/env.js";
import { apiRouter } from "./routes/routers.js";

export function buildApp(): Express {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(
    cors({
      origin: env.NODE_ENV === "production" ? false : true,
      credentials: true,
    })
  );

  // Logging
  if (env.NODE_ENV === "development") {
    app.use(morgan("dev"));
  }

  // Routes
    app.use("/api/v1", apiRouter);

  return app;
}
