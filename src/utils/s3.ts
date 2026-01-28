import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env.js";

const s3Client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
});

const getPresignedUploadUrl = async (key: string, contentType: string): Promise<string> => {
    try {
        const command = new PutObjectCommand({
            Bucket: env.S3_BUCKET,
            Key: key,
            ContentType: contentType,
        })
        const url = await getSignedUrl(s3Client, command, {
            expiresIn: 60 * 15, // 15 minutes
        })
        return url;
    } catch (error) {
        console.error("Error getting presigned upload URL:", error);
        throw new Error("Failed to get presigned upload URL");
    }
}

const getPresignedDownloadUrl = async (key: string): Promise<string> => {
    try {
        const command = new GetObjectCommand({
            Bucket: env.S3_BUCKET,
            Key: key,
        })
        const url = await getSignedUrl(s3Client, command, {
            expiresIn: 60 * 60 * 24 * 30, // 30 days
        });
        return url;
    } catch (error) {
        console.error("Error getting presigned download URL:", error);
        throw new Error("Failed to get presigned download URL");
    }
}



export { getPresignedUploadUrl, getPresignedDownloadUrl };