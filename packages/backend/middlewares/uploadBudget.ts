import type { RequestHandler } from "express";

/**
 * A ceiling on the bytes multipart uploads may hold in this process at once.
 *
 * The multipart routes (post, story, message photo, profile pictures) read
 * whole files into memory (`multer.memoryStorage()`); a post alone may carry
 * four 20 MB files. Nothing bounded how many ran together, so a dozen
 * concurrent uploads were enough to push the API past its container's memory
 * limit and have it killed with every request it was serving. Clients upload
 * large media straight to object storage (presigned URLs); these routes are the
 * fallback, and refusing a burst of them with a 503 is far cheaper than an
 * out-of-memory restart.
 *
 * A request reserves what its `Content-Length` declares (the route's maximum
 * when it declares none) before the body is read, and releases it when the
 * response ends either way.
 */
export const UPLOAD_MEMORY_BUDGET_BYTES = 192 * 1024 * 1024;
let reservedBytes = 0;

export const uploadBytesInFlight = (): number => reservedBytes;

export const reserveUploadMemory = (maxRequestBytes: number): RequestHandler => (request, response, next) => {
  const declared = Number.parseInt(request.get("content-length") ?? "", 10);
  if (Number.isFinite(declared) && declared > maxRequestBytes) {
    return void response.status(413).json({ success: false, message: "Request is too large" });
  }
  const cost = Number.isFinite(declared) && declared > 0 ? declared : maxRequestBytes;
  if (reservedBytes + cost > UPLOAD_MEMORY_BUDGET_BYTES) {
    response.set("Retry-After", "5");
    return void response.status(503).json({ success: false, message: "Uploads are busy; please try again in a moment" });
  }
  reservedBytes += cost;
  let released = false;
  const release = (): void => {
    if (released) return;
    released = true;
    reservedBytes -= cost;
  };
  response.once("finish", release);
  response.once("close", release);
  next();
};
