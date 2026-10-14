import { describe, expect, it } from "vitest";

import { hasAllowedUploadSize, hasMatchingFileSignature } from "./upload-validation";

describe("upload validation", () => {
  it("accepts only matching binary signatures", () => {
    expect(hasMatchingFileSignature("image/png", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
    expect(hasMatchingFileSignature("application/pdf", new TextEncoder().encode("%PDF-1.7"))).toBe(true);
    expect(hasMatchingFileSignature("image/png", new TextEncoder().encode("<script>alert(1)</script>"))).toBe(false);
    expect(hasMatchingFileSignature("video/mp4", new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]))).toBe(true);
  });

  it("rejects clearly oversized multipart requests before parsing them", () => {
    expect(hasAllowedUploadSize(new Request("https://example.test", { headers: { "content-length": "10485761" } }), 10 * 1024 * 1024)).toBe(true);
    expect(hasAllowedUploadSize(new Request("https://example.test", { headers: { "content-length": "11534337" } }), 10 * 1024 * 1024)).toBe(false);
  });
});
