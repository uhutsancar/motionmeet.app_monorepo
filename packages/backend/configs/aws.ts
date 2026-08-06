import type { S3Client } from "@aws-sdk/client-s3";

/**
 * The AWS SDK is one of the heaviest dependencies in the process (~360ms to
 * load) and nothing on the boot path touches S3: exercise data, stats and the
 * feed all come from PostgreSQL. Only media - profile photos, post images,
 * story uploads and the exercise GIFs served from the bucket - needs it, so the
 * SDK is imported the first time a request actually moves an object.
 *
 * The type-only import above is erased at compile time and costs nothing.
 */

let clientPromise: Promise<S3Client> | null = null;

export const getS3Client = async (): Promise<S3Client> => {
  clientPromise ??= import("@aws-sdk/client-s3").then(
    ({ S3Client: Client }) => new Client({ region: process.env.AWS_REGION || "eu-north-1" }),
  );
  return clientPromise;
};

export const loadS3Commands = (): Promise<typeof import("@aws-sdk/client-s3")> =>
  import("@aws-sdk/client-s3");

export const loadS3Upload = (): Promise<typeof import("@aws-sdk/lib-storage")> =>
  import("@aws-sdk/lib-storage");

export const loadS3Presigner = (): Promise<typeof import("@aws-sdk/s3-request-presigner")> =>
  import("@aws-sdk/s3-request-presigner");
