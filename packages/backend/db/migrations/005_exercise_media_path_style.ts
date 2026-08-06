import { sql, type Kysely } from "kysely";
import type { Database } from "../types.js";

// Exercise media was stored as virtual-hosted S3 URLs
// (motionmeet-assets.s3.eu-north-1.amazonaws.com/exercises/...). That hostname
// puts the bucket name in the subdomain, and resolvers that fail on it - some
// home routers and captive DNS among them - cannot reach the images at all,
// while every other host in the app resolves fine. The bucket is public and the
// objects exist; only the name lookup fails, so photos and GIFs silently render
// blank on a fresh install while an older build keeps showing its disk cache.
//
// Path-style puts the bucket in the path instead (s3.<region>.amazonaws.com/
// <bucket>/...), so only the plain regional endpoint has to resolve. Same
// bucket, same objects, same permissions.
const VIRTUAL_HOSTED = "https://motionmeet-assets.s3.eu-north-1.amazonaws.com/";
const PATH_STYLE = "https://s3.eu-north-1.amazonaws.com/motionmeet-assets/";

export const up = async (db: Kysely<Database>): Promise<void> => {
  await sql`
    UPDATE exercises
       SET image_url = replace(image_url, ${VIRTUAL_HOSTED}, ${PATH_STYLE}),
           gif_url   = replace(gif_url,   ${VIRTUAL_HOSTED}, ${PATH_STYLE})
     WHERE image_url LIKE ${VIRTUAL_HOSTED + "%"}
        OR gif_url   LIKE ${VIRTUAL_HOSTED + "%"}
  `.execute(db);
};

export const down = async (db: Kysely<Database>): Promise<void> => {
  await sql`
    UPDATE exercises
       SET image_url = replace(image_url, ${PATH_STYLE}, ${VIRTUAL_HOSTED}),
           gif_url   = replace(gif_url,   ${PATH_STYLE}, ${VIRTUAL_HOSTED})
     WHERE image_url LIKE ${PATH_STYLE + "%"}
        OR gif_url   LIKE ${PATH_STYLE + "%"}
  `.execute(db);
};
