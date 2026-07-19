import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { randomUUID } from "crypto";
import path from "path";
import s3Client from "../configs/aws.js";

/**
 * Uploads a file to AWS S3.
 * @param {Buffer|ReadableStream} file - The file content.
 * @param {string} fileName - The name of the file.
 * @param {string} folder - The folder in S3 (e.g., 'posts', 'profiles').
 * @returns {Promise<Object>} - S3 upload response containing the Key.
 */
export const uploadToS3 = async (file, fileName, folder = "", contentType) => {
    if (!process.env.AWS_BUCKET_NAME) {
        throw new Error("AWS_BUCKET_NAME is not configured");
    }

    const safeName = path.basename(fileName || "upload").replace(/[^A-Za-z0-9._-]/g, "-");
    const objectName = `${Date.now()}-${randomUUID()}-${safeName}`;
    const key = folder ? `${folder}/${objectName}` : objectName;
    
    const parallelUploads3 = new Upload({
        client: s3Client,
        params: {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: key,
            Body: file,
            ...(contentType ? { ContentType: contentType } : {}),
        },
    });

    await parallelUploads3.done();
    return { key };
};

/**
 * Deletes an object from AWS S3.
 * @param {string} s3Key - The key of the object to delete.
 */
export const deleteFromS3 = async (s3Key) => {
    if (!s3Key || !process.env.AWS_BUCKET_NAME) return;
    try {
        const command = new DeleteObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: s3Key,
        });
        await s3Client.send(command);
    } catch (error) {
        console.error("Error deleting from S3:", error.message);
    }
};

/**
 * Extracts the S3 Key from an ImageKit or S3 URL.
 * Assumes the path after the domain is the S3 Key.
 * @param {string} url - The full URL.
 * @returns {string|null} - The S3 Key.
 */
export const extractS3Key = (url) => {
    if (!url) return null;
    try {
        const parsedUrl = new URL(url);
        // ImageKit URL: https://ik.imagekit.io/mq4ehklmc/path/to/file.jpg
        // S3 URL: https://bucket.s3.region.amazonaws.com/path/to/file.jpg
        const pathParts = parsedUrl.pathname.split('/');
        
        // Skip the first part if it's the ImageKit ID (mq4ehklmc)
        if (parsedUrl.host === 'ik.imagekit.io') {
            return pathParts.slice(2).join('/');
        }
        
        // For S3 or other formats, take everything after the first slash
        return pathParts.slice(1).join('/');
    } catch (_e) {
        return null;
    }
};
