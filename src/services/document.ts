import { prisma } from "../db/client";
import type { Document, DocumentMember, Annotation, DocumentType } from "@prisma/client";
import { getPresignedUploadUrl, getPresignedDownloadUrl } from "../utils/s3";

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

const getDocuments = async (query: Partial<Document>): Promise<Document[]> => {
    try {
        const documents = await prisma.document.findMany({
            where: {
                ...query,
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
                ownerId: userId,
            }
        })
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