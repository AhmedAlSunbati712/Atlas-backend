import { prisma } from "../db/client";
import type { Document, DocumentType } from "@prisma/client";

interface CreateDocumentInput {
    ownerId: string;
    title: string;
    type: DocumentType;
    mimeType: string;
    size: number;
    s3Key: string;
}

const createDocument = async (data: CreateDocumentInput): Promise<Document> => {
    try {
        const document = await prisma.document.create({
            data,
        });
        return document;
    } catch (error) {
        console.error("Error creating document:", error);
        throw new Error("Failed to create document");
    }
}

const getDocuments = async (query: Partial<Document>, userId?: string): Promise<Document[]> => {
    try {
        const documents = await prisma.document.findMany({
            where: {
                ...query,
                OR: [
                    { ownerId: userId},
                    { members: { some: { userId } } },
                ],
            },
            include: {
                members: true,
            }
        });
        return documents;
    } catch (error) {
        console.error("Error getting documents:", error);
        throw new Error("Failed to get documents");
    }
}

const getUserDocuments = async (userId: string): Promise<Document[]> => {
    try {
        const documents = await prisma.document.findMany({
            where: {
                OR: [
                    { ownerId: userId},
                    { members: { some: { userId } } },
                ]
            },
            include: {
                members: true,
            }
        });
        return documents;
    } catch (error) {
        console.error("Error getting user documents:", error);
        throw new Error("Failed to get user documents");
    }
}

const documentService = {
    createDocument,
    getDocuments,
    getUserDocuments,
};

export default documentService;