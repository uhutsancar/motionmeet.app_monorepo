interface MediaFile { buffer?: unknown; mimetype?: unknown }
const startsWith = (buffer: Buffer, bytes: number[]): boolean => buffer.length >= bytes.length && bytes.every((byte, index) => buffer[index] === byte);
const ascii = (buffer: Buffer, start: number, end: number): string => buffer.subarray(start, end).toString("ascii");
export const hasValidMediaSignature = (candidate: MediaFile): boolean => {
  const buffer = candidate?.buffer; const mimetype = candidate?.mimetype;
  if (!Buffer.isBuffer(buffer) || buffer.length < 12 || typeof mimetype !== "string") return false;
  switch (mimetype) {
    case "image/jpeg": case "image/jpg": return startsWith(buffer, [0xff, 0xd8, 0xff]);
    case "image/png": return startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/gif": return ["GIF87a", "GIF89a"].includes(ascii(buffer, 0, 6));
    case "image/webp": return ascii(buffer, 0, 4) === "RIFF" && ascii(buffer, 8, 12) === "WEBP";
    case "image/heic": case "image/heif": return ascii(buffer, 4, 8) === "ftyp" && /^(heic|heix|hevc|hevx|heim|heis|heif|mif1|msf1)$/.test(ascii(buffer, 8, 12));
    case "video/mp4": case "video/quicktime": return ascii(buffer, 4, 8) === "ftyp";
    case "video/webm": return startsWith(buffer, [0x1a, 0x45, 0xdf, 0xa3]);
    default: return false;
  }
};
