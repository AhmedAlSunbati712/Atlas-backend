import { Router } from "express";
import { userRouter } from "./user";
import { healthRouter } from "./health";
import { documentRouter } from "./document";
import { uploadRouter } from "./upload";

export const apiRouter = Router();

apiRouter.use("/user", userRouter);
apiRouter.use("/health", healthRouter);
apiRouter.use("/document", documentRouter);
apiRouter.use("/upload", uploadRouter);