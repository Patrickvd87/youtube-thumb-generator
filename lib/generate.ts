import { generateWithCloudflare } from "./cloudflare";
import { generateWithGemini } from "./gemini";
import type { GeneratedImage } from "./image-types";

export type { GeneratedImage } from "./image-types";

export function resolveImageProvider(): "cloudflare" | "gemini" {
  const forced = process.env.IMAGE_PROVIDER?.trim().toLowerCase();
  if (forced === "cloudflare" || forced === "gemini") {
    return forced;
  }

  if (
    process.env.CLOUDFLARE_ACCOUNT_ID &&
    process.env.CLOUDFLARE_API_TOKEN
  ) {
    return "cloudflare";
  }

  // Workers AI binding is available after `wrangler login` / deploy.
  return "cloudflare";
}

export function parseVariantCount(value: unknown): number {
  const count = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(count) || count < 1 || count > 4) {
    return 1;
  }
  return count;
}

export async function generateThumbnails(
  prompt: string,
  photoId: string,
  count = 1,
): Promise<GeneratedImage[]> {
  const variants = parseVariantCount(count);
  const provider = resolveImageProvider();
  const images =
    provider === "cloudflare"
      ? await generateWithCloudflare(prompt, photoId, variants)
      : await generateWithGemini(prompt, photoId, variants);

  if (images.length === 0) {
    throw new Error("All generations failed");
  }

  return images;
}
