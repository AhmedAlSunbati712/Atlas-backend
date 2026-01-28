import uploadService from "../services/upload";
import { Request, Response } from "express";

const getUploadUrl = async (req: Request & { userId: string }, res: Response) => {
    try {
        if (!req.userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const data = req.body;
        const uploadUrl = await uploadService.getUploadUrl(data);
        res.status(200).json(uploadUrl);
    } catch (error) {
        console.error("Error getting upload URL:", error);
        res.status(500).json({ error: "Failed to get upload URL" });
    }
}

const getDownloadUrl = async (req: Request & { userId: string }, res: Response) => {
    try {
        if (!req.userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const data = req.body;
        const downloadUrl = await uploadService.getDownloadUrl(data);
        res.status(200).json(downloadUrl);
    } catch (error) {
        console.error("Error getting download URL:", error);
        res.status(500).json({ error: "Failed to get download URL" });
    }
}

const uploadController = {
    getUploadUrl,
    getDownloadUrl,
}

export default uploadController;