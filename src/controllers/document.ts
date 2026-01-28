import { Request, Response } from "express";
import documentService from "../services/document";


const createDocument = async (req: Request & { userId: string }, res: Response) => {
    try {
        const data = req.body;
        if (data.ownerId != req.userId) {
            return res.status(403).json({ error: "Forbidden" });
        }
        const document = await documentService.createDocument(data);
        res.status(201).json(document);
    } catch (error) {
        console.error("Error creating document:", error);
        res.status(500).json({ error: "Failed to create document" });
    }
}


const getDocuments = async (req: Request & { userId: string }, res: Response) => {
    try {
        if (!req.userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const documents = await documentService.getDocuments(req.query, req.userId);
        res.status(200).json(documents);
    } catch (error) {
        console.error("Error getting documents:", error);
        res.status(500).json({ error: "Failed to get documents" });
    }
}

const getUserDocuments = async (req: Request & { userId: string }, res: Response) => {
    try {
        if (!req.userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const documents = await documentService.getUserDocuments(req.userId);
        res.status(200).json(documents);
    } catch (error) {
        console.error("Error getting user documents:", error);
        res.status(500).json({ error: "Failed to get user documents" });
    }
}


const documentController = {
    createDocument,
    getDocuments,
    getUserDocuments,
}

export default documentController;