import { prisma } from "../db/client";
import type { Document, DocumentMember, Annotation, DocumentType } from "@prisma/client";
import { getPresignedUploadUrl, getPresignedDownloadUrl } from "../utils/s3";


/**
 * Helpers
 */

const generateS3Key = (ownerId: string, title: string, type: string): string => {
    return `${ownerId}/${title}-${type}-${Date.now()}`;
}
interface CreateDocumentInput {
    ownerId: string;
    title: string;
    type: DocumentType;
    mimeType: string;
    size: number;
    s3Key: string;
}

interface UploadDocumentInput {
    userId: string;
    filename: string;
    mimetype: string;
    size: number;
}


const getUploadUrl = async (data: UploadDocumentInput): Promise<{url: string, s3Key: string}> => {
    try {
        const s3Key = generateS3Key(data.userId, data.filename, data.mimetype);
        const url = await getPresignedUploadUrl(s3Key, data.mimetype);
        return { url, s3Key }; 
    } catch (error) {
        console.error("Error getting presigned upload URL and key:", error);
        throw new Error("Failed to get presigned upload URL and key");
    }
}

const getDownloadUrl = async (s3Key: string): Promise<string> => {
    try {
        const url = await getPresignedDownloadUrl(s3Key);
        return url;
    } catch (error) {
        console.error("Error getting presigned download URL:", error);
        throw new Error("Failed to get presigned download URL");
    }
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



export { createDocument };