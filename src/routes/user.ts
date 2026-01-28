import { Router } from "express";
import userController from "../controllers/user";

export const userRouter = Router();

userRouter.post("/signup", userController.signUp);
userRouter.post("/login", userController.logIn);