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

/**
 * forcePathStyle keeps the bucket in the path (s3.<region>.amazonaws.com/
 * <bucket>/key) instead of the subdomain. Virtual-hosted URLs put the bucket
 * name in the hostname, and resolvers that fail on it cannot reach the bucket at
 * all - a presigned upload then hangs until the socket gives up rather than
 * failing fast, which reads as a spinner that never stops. Path-style only needs
 * the plain regional endpoint to resolve, and it matches the URLs stored for
 * exercise media.
 */
/**
 * requestChecksumCalculation stays at WHEN_REQUIRED because the SDK otherwise
 * adds a CRC32 of the request body to every PutObject. Presigning passes no
 * body, so the checksum baked into the signed URL is the one for zero bytes -
 * and the client that later uploads the real file cannot satisfy it.
 */
export const getS3Client = async (): Promise<S3Client> => {
  clientPromise ??= import("@aws-sdk/client-s3").then(
    ({ S3Client: Client }) =>
      new Client({
        region: process.env.AWS_REGION || "eu-north-1",
        forcePathStyle: true,
        requestChecksumCalculation: "WHEN_REQUIRED",
      }),
  );
  return clientPromise;
};

export const loadS3Commands = (): Promise<typeof import("@aws-sdk/client-s3")> =>
  import("@aws-sdk/client-s3");

export const loadS3Upload = (): Promise<typeof import("@aws-sdk/lib-storage")> =>
  import("@aws-sdk/lib-storage");

export const loadS3Presigner = (): Promise<typeof import("@aws-sdk/s3-request-presigner")> =>
  import("@aws-sdk/s3-request-presigner");
