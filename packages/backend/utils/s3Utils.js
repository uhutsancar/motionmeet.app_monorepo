import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { randomUUID } from "crypto";
import path from "path";
import s3Client from "../configs/aws.js";

/**
 * @param {string} fileName - The name of the file.
 * @param {string} folder - The folder in S3 (e.g., 'posts', 'profiles').
 * @returns {string}
 */
export const createS3Key = (fileName, folder = "") => {
    const safeName = path.basename(fileName || "upload").replace(/[^A-Za-z0-9._-]/g, "-");
    const objectName = `${Date.now()}-${randomUUID()}-${safeName}`;
    return folder ? `${folder}/${objectName}` : objectName;
};

/**
 * Uploads a file to AWS S3.
 * @param {Buffer|ReadableStream} file - The file content.
 * @param {string} fileName - The name of the file.
 * @param {string} folder - The folder in S3.
 * @param {string} [contentType] - The object content type.
 * @param {string|null} [objectKey] - A pre-reserved object key.
 * @returns {Promise<{key: string}>}
 */
export const uploadToS3 = async (
    file,
    fileName,
    folder = "",
    contentType,
    objectKey = null
) => {
    if (process.env.MEDIA_UPLOADS_ENABLED === "false") {
        throw Object.assign(new Error("Media uploads are disabled"), {
            status: 503,
        });
    }
    if (!process.env.AWS_BUCKET_NAME) {
        throw Object.assign(new Error("AWS_BUCKET_NAME is not configured"), {
            status: 503,
        });
    }

    const key = objectKey || createS3Key(fileName, folder);
    
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
    if (!s3Key) return;
    if (!process.env.AWS_BUCKET_NAME) {
        throw new Error("AWS_BUCKET_NAME is not configured");
    }
    if (
        s3Key.length > 1024 ||
        s3Key.startsWith("/") ||
        s3Key.split("/").includes("..")
    ) {
        throw Object.assign(new Error("Invalid S3 object key"), {
            code: "INVALID_S3_KEY",
        });
    }
    const command = new DeleteObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: s3Key,
    });
    await s3Client.send(command);
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
        const pathParts = decodeURIComponent(parsedUrl.pathname)
            .split("/")
            .filter(Boolean);
        const knownFolders = new Set([
            "profiles",
            "covers",
            "posts",
            "stories",
            "messages",
        ]);
        const folderIndex = pathParts.findIndex((part) => knownFolders.has(part));
        if (folderIndex >= 0) return pathParts.slice(folderIndex).join("/");

        const withoutTransformations = pathParts.filter(
            (part) => !part.startsWith("tr:")
        );
        if (parsedUrl.host === "ik.imagekit.io" && withoutTransformations.length > 1) {
            return withoutTransformations.slice(1).join("/");
        }
        return withoutTransformations.join("/") || null;
    } catch (_e) {
        return null;
    }
};
