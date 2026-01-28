import { getPresignedUploadUrl, getPresignedDownloadUrl } from "../utils/s3";


const generateS3Key = (ownerId: string, title: string, type: string): string => {
    return `${ownerId}/${title}-${type}-${Date.now()}`;
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

const uploadService = {
    getUploadUrl,
    getDownloadUrl,
}

export default uploadService;