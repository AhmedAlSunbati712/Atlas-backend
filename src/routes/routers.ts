import { Router } from "express";
import { userRouter } from "./user";
import { healthRouter } from "./health";

export const apiRouter = Router();

apiRouter.use("/user", userRouter);
apiRouter.use("/health", healthRouter);

