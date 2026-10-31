const bytes = (value: Uint8Array, start: number, expected: number[]) =>
  expected.every((byte, index) => value[start + index] === byte);

const textAt = (value: Uint8Array, start: number, text: string) =>
  bytes(value, start, [...text].map((character) => character.charCodeAt(0)));

export const allowedMessageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "audio/mpeg",
  "audio/ogg",
  "audio/webm",
]);

export const allowedPublicMediaMimeTypes = new Set([
  "video/mp4",
  "video/webm",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

export function hasAllowedUploadSize(request: Request, maximumBytes: number): boolean {
  const value = request.headers.get("content-length");
  if (!value) return true;
  const length = Number(value);
  return Number.isSafeInteger(length) && length > 0 && length <= maximumBytes + 1_048_576;
}

export function hasMatchingFileSignature(mimeType: string, value: Uint8Array): boolean {
  if (value.length < 4) return false;
  switch (mimeType) {
    case "image/jpeg":
      return bytes(value, 0, [0xff, 0xd8, 0xff]);
    case "image/png":
      return bytes(value, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/webp":
      return textAt(value, 0, "RIFF") && textAt(value, 8, "WEBP");
    case "image/avif":
      return textAt(value, 4, "ftyp") && (textAt(value, 8, "avif") || textAt(value, 8, "avis"));
    case "application/pdf":
      return textAt(value, 0, "%PDF-");
    case "audio/mpeg":
      return textAt(value, 0, "ID3") || (value[0] === 0xff && (value[1] ?? 0) >= 0xe0);
    case "audio/ogg":
      return textAt(value, 0, "OggS");
    case "audio/webm":
    case "video/webm":
      return bytes(value, 0, [0x1a, 0x45, 0xdf, 0xa3]);
    case "video/mp4":
      return textAt(value, 4, "ftyp");
    default:
      return false;
  }
}

export async function isVerifiedUpload(file: File, mimeTypes: ReadonlySet<string>): Promise<boolean> {
  if (!mimeTypes.has(file.type)) return false;
  const signature = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  return hasMatchingFileSignature(file.type, signature);
}
