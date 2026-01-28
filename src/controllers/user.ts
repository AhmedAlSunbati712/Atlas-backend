import userService from "../services/user";
import { CreateUserInput } from "../services/user";
import { Request, Response } from "express";
import { verifyPassword, generateAccessToken } from "../utils/auth";

const signUp = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = req.body;
        const user = await userService.createUser(data as CreateUserInput);
        res.status(201).json(user);
    } catch (error) {
        console.error("Error creating user:", error);
        res.status(500).json({ error: "Failed to create user" });
    }
}

const logIn = async (req: Request, res: Response): Promise<void> => {
    try {
        const userData = req.body;
        const users = await userService.getUsers({
            email: userData.email,
        });
        if (users.length === 0) {
            res.status(401).json({ error: "Invalid credentials" });
            return;
        }
        const user = users[0];
        const isPasswordValid = await verifyPassword(userData.password, user.passwordHash);
        if (!isPasswordValid) {
            res.status(401).json({ error: "Invalid credentials" });
            return;
        }
        const token = generateAccessToken(user.id);
        res.status(200).json({ token });
    } catch (error) {
        console.error("Error logging in:", error);
        res.status(500).json({ error: "Failed to log in" });
    }
}

const userController = {
    signUp,
    logIn,
}

export default userController;