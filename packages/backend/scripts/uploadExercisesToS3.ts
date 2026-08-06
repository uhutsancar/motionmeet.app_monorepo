import "dotenv/config";
import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { Upload } from "@aws-sdk/lib-storage";
import { getS3Client } from "../configs/aws.js";
const bucket = process.env.AWS_BUCKET_NAME; if (!bucket) throw new Error("AWS_BUCKET_NAME is required");
const datasetDirectory = path.resolve(process.cwd(), "../../exercises-dataset-main");
const contentType = (file: string): string => ({ ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".mp4": "video/mp4" })[path.extname(file).toLowerCase()] ?? "application/octet-stream";
const syncDirectory = async (localDirectory: string, targetFolder: string): Promise<void> => {
  const files = await readdir(localDirectory); let completed = 0;
  const s3Client = await getS3Client();
  for (const file of files) {
    const filePath = path.join(localDirectory, file); if (!(await stat(filePath)).isFile()) continue;
    await new Upload({ client: s3Client, params: { Bucket: bucket, Key: `exercises/${targetFolder}/${file}`, Body: createReadStream(filePath), ContentType: contentType(file) } }).done();
    completed += 1; if (completed % 100 === 0) console.log(`${targetFolder}: ${completed}/${files.length}`);
  }
  console.log(`${targetFolder}: ${completed} uploaded`);
};
try { await syncDirectory(path.join(datasetDirectory, "images"), "images"); await syncDirectory(path.join(datasetDirectory, "videos"), "videos"); }
catch (error: unknown) { console.error("Exercise media upload failed:", error instanceof Error ? error.message : error); process.exitCode = 1; }
