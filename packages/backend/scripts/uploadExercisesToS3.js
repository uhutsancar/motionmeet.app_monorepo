import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

// Load .env
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "eu-north-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

const BUCKET_NAME = process.env.AWS_BUCKET_NAME || "motionmeet-assets";
const DATASET_DIR = path.resolve(process.cwd(), "../../exercises-dataset-main");
const S3_PREFIX = "exercises/";

async function uploadFile(filePath, s3Key, contentType) {
  try {
    const fileStream = fs.createReadStream(filePath);
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: fileStream,
        ContentType: contentType,
        // ACL: "public-read" // Cloudflare R2 / AWS S3 if public bucket policies are set
      }
    });

    await upload.done();
    return true;
  } catch (error) {
    console.error(`Error uploading ${s3Key}:`, error.message);
    return false;
  }
}

async function syncDirectory(localDir, s3Folder) {
  if (!fs.existsSync(localDir)) {
    console.warn(`Directory not found: ${localDir}`);
    return;
  }

  const files = fs.readdirSync(localDir);
  console.log(`Found ${files.length} files in ${localDir}. Starting upload...`);
  
  let successCount = 0;
  let errorCount = 0;

  for (const file of files) {
    const filePath = path.join(localDir, file);
    if (fs.statSync(filePath).isFile()) {
      const s3Key = `${S3_PREFIX}${s3Folder}/${file}`;
      
      let contentType = "application/octet-stream";
      if (file.endsWith(".jpg") || file.endsWith(".jpeg")) contentType = "image/jpeg";
      if (file.endsWith(".png")) contentType = "image/png";
      if (file.endsWith(".gif")) contentType = "image/gif";
      if (file.endsWith(".mp4")) contentType = "video/mp4";
      
      const success = await uploadFile(filePath, s3Key, contentType);
      if (success) {
        successCount++;
      } else {
        errorCount++;
      }
      
      if ((successCount + errorCount) % 100 === 0) {
        console.log(`Progress: ${successCount + errorCount} / ${files.length} files processed in ${s3Folder}`);
      }
    }
  }

  console.log(`\nFinished ${s3Folder}: ${successCount} successful, ${errorCount} failed.`);
}

async function run() {
  console.log("Starting S3 Upload for Exercises Dataset...\n");
  
  const imagesDir = path.join(DATASET_DIR, "images");
  const videosDir = path.join(DATASET_DIR, "videos");
  
  console.log("--> Syncing Images");
  await syncDirectory(imagesDir, "images");
  
  console.log("\n--> Syncing Videos (GIFs)");
  await syncDirectory(videosDir, "videos");
  
  console.log("\nAll uploads completed!");
}

run().catch(console.error);
