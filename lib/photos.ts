import { mkdir, readdir, readFile, writeFile } from "fs/promises";
import path from "path";

export type PhotoSource = "default" | "upload";

export type Photo = {
  id: string;
  url: string;
  label: string;
  source: PhotoSource;
};

const PUBLIC_DIR = path.join(process.cwd(), "public");
const STREAMERS_DIR = path.join(PUBLIC_DIR, "streamers");
const UPLOADS_DIR = path.join(PUBLIC_DIR, "uploads");
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

function toLabel(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

async function listImages(dir: string, source: PhotoSource): Promise<Photo[]> {
  try {
    const files = await readdir(dir);
    return files
      .filter((file) => IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()))
      .sort()
      .map((file) => {
        const folder = source === "default" ? "streamers" : "uploads";
        return {
          id: `${folder}/${file}`,
          url: `/${folder}/${file}`,
          label: toLabel(file),
          source,
        };
      });
  } catch {
    return [];
  }
}

export async function listPhotos(): Promise<Photo[]> {
  const [defaults, uploads] = await Promise.all([
    listImages(STREAMERS_DIR, "default"),
    listImages(UPLOADS_DIR, "upload"),
  ]);
  return [...defaults, ...uploads];
}

export function resolvePhotoPath(photoId: string): string {
  const normalized = photoId.replace(/^\/+/, "");
  if (!normalized.startsWith("streamers/") && !normalized.startsWith("uploads/")) {
    throw new Error("Invalid photo");
  }

  if (normalized.includes("..") || path.isAbsolute(normalized)) {
    throw new Error("Invalid photo");
  }

  return path.join(PUBLIC_DIR, normalized);
}

export async function readPhotoFile(photoId: string): Promise<{
  buffer: Buffer;
  mimeType: string;
}> {
  const filePath = resolvePhotoPath(photoId);
  const buffer = await readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mimeType =
    ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";

  return { buffer, mimeType };
}

export async function readPhoto(photoId: string): Promise<{
  mimeType: string;
  data: string;
}> {
  const photo = await readPhotoFile(photoId);
  return {
    mimeType: photo.mimeType,
    data: photo.buffer.toString("base64"),
  };
}

export async function saveUploadedPhoto(
  filename: string,
  bytes: Buffer,
): Promise<Photo> {
  const ext = path.extname(filename).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(ext)) {
    throw new Error("Only PNG, JPG, and WebP uploads are allowed");
  }

  const safeName = `${Date.now()}-${filename
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/-+/g, "-")}`;

  await mkdir(UPLOADS_DIR, { recursive: true });
  await writeFile(path.join(UPLOADS_DIR, safeName), bytes);

  return {
    id: `uploads/${safeName}`,
    url: `/uploads/${safeName}`,
    label: toLabel(safeName),
    source: "upload",
  };
}
