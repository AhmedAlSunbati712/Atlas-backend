import {Request, Response, NextFunction} from "express"
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "jwt-secret";

export const veriyfyToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
        if (!decoded || !decoded.userId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        (req as Request & { userId: string }).userId = decoded.userId as string;
        next();
    } catch (error) {
        console.error("Error verifying token:", error);
        res.status(401).json({ error: "Unauthorized" });
    }
}