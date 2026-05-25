import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const ALLOWED_EXTS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export class UploadError extends Error {}

export async function validateImage(file: File): Promise<void> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new UploadError(
      `Unsupported file type "${file.type || "unknown"}". Use JPG, PNG, WEBP, or GIF.`
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError(
      `Image is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Max is 5 MB.`
    );
  }
  if (file.size === 0) {
    throw new UploadError("Image is empty.");
  }
}

/**
 * Upload a file and return its public URL.
 * - If BLOB_READ_WRITE_TOKEN is set, uploads to Vercel Blob (production).
 * - Otherwise writes to the local public/ directory (dev only).
 *
 * Path within storage: restaurants/<slug>/<kind>/<uuid>.<ext>
 */
export async function uploadImage(
  slug: string,
  file: File,
  kind: "items" | "hero" | "logo"
): Promise<string> {
  await validateImage(file);
  const ext = ALLOWED_EXTS[file.type] ?? "bin";
  const key = `restaurants/${slug}/${kind}/${randomUUID()}.${ext}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const result = await put(key, file, {
      access: "public",
      contentType: file.type,
    });
    return result.url;
  }

  // Local dev fallback
  const publicDir = path.join(process.cwd(), "public");
  const filePath = path.join(publicDir, key);
  await mkdir(path.dirname(filePath), { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);
  return `/${key}`;
}

export async function deleteImage(url: string): Promise<void> {
  if (!url) return;
  if (url.startsWith("http")) {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const { del } = await import("@vercel/blob");
        await del(url);
      } catch (e) {
        console.warn("[upload] Blob delete failed", e);
      }
    }
    return;
  }
  if (url.startsWith("/")) {
    // Local file under /public — only delete safe paths under restaurants/
    if (!url.startsWith("/restaurants/")) return;
    const filePath = path.join(process.cwd(), "public", url);
    try {
      await unlink(filePath);
    } catch {
      /* file may already be gone */
    }
  }
}
