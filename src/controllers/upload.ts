import uploadService from "../services/upload";
import { Request, Response } from "express";

const getUploadUrl = async (req: Request & { userId: string }, res: Response) => {
    try {
        if (!req.userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const { filename, mimetype, size } = req.body;
        if (!filename || !mimetype || !size) {
            return res.status(400).json({ error: "Missing filename, mimetype, or size" });
        }
        const uploadUrl = await uploadService.getUploadUrl({ userId: req.userId, filename, mimetype, size });
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
        const data = req.query.s3Key as string;
        if (!data) {
            return res.status(400).json({ error: "Missing s3Key" });
        }
        const downloadUrl = await uploadService.getDownloadUrl(data);
        res.status(200).json({ url: downloadUrl });
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