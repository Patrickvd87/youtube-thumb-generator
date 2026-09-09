import { readPhotoFile } from "./photos";
import {
  buildPrompt,
  firstSettledError,
  variationsForCount,
  type GeneratedImage,
} from "./image-types";

const DEFAULT_MODEL = "@cf/black-forest-labs/flux-2-klein-4b";

type AiBinding = {
  run: (model: string, input: unknown) => Promise<unknown>;
};

async function getAiBinding(): Promise<AiBinding | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    return (env as { AI?: AiBinding }).AI ?? null;
  } catch {
    return null;
  }
}

async function referenceJpeg(photoId: string): Promise<Buffer> {
  const photo = await readPhotoFile(photoId);

  try {
    const sharp = (await import("sharp")).default;
    return await sharp(photo.buffer)
      .resize(512, 512, { fit: "cover" })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch {
    return photo.buffer;
  }
}

function parseImage(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    throw new Error("Cloudflare returned no image");
  }

  const record = payload as {
    result?: { image?: string };
    image?: string;
    errors?: Array<{ message?: string }>;
    success?: boolean;
  };

  if (record.success === false) {
    throw new Error(record.errors?.[0]?.message || "Cloudflare image generation failed");
  }

  const image = record.result?.image || record.image;
  if (!image) {
    throw new Error("Cloudflare returned no image");
  }

  return image;
}

function buildForm(prompt: string, reference: Buffer): FormData {
  const form = new FormData();
  form.set("prompt", prompt);
  form.set("width", "1280");
  form.set("height", "720");
  form.set(
    "input_image_0",
    new Blob([new Uint8Array(reference)], { type: "image/jpeg" }),
    "reference.jpg",
  );
  return form;
}

async function generateWithBinding(
  ai: AiBinding,
  model: string,
  prompt: string,
  reference: Buffer,
): Promise<GeneratedImage> {
  const form = buildForm(prompt, reference);
  const serialized = new Response(form);
  const contentType = serialized.headers.get("content-type");
  if (!contentType || !serialized.body) {
    throw new Error("Could not serialize the image request");
  }

  const payload = await ai.run(model, {
    multipart: {
      body: serialized.body,
      contentType,
    },
  });

  return {
    id: crypto.randomUUID(),
    mimeType: "image/jpeg",
    data: parseImage(payload),
  };
}

async function generateWithRest(
  accountId: string,
  token: string,
  model: string,
  prompt: string,
  reference: Buffer,
): Promise<GeneratedImage> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: buildForm(prompt, reference),
    },
  );

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object"
        ? (payload as { errors?: Array<{ message?: string }>; error?: string })
            .errors?.[0]?.message ||
          (payload as { error?: string }).error
        : null;
    throw new Error(message || `Cloudflare request failed (${response.status})`);
  }

  return {
    id: crypto.randomUUID(),
    mimeType: "image/jpeg",
    data: parseImage(payload),
  };
}

export async function generateWithCloudflare(
  prompt: string,
  photoId: string,
  count = 1,
): Promise<GeneratedImage[]> {
  const model = process.env.CLOUDFLARE_IMAGE_MODEL || DEFAULT_MODEL;
  const reference = await referenceJpeg(photoId);
  const ai = await getAiBinding();
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;

  if (!ai && (!accountId || !token)) {
    throw new Error(
      "Cloudflare is not configured. For local REST calls set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN. On Workers, the AI binding is enough.",
    );
  }

  const results = await Promise.allSettled(
    variationsForCount(count).map((variation) => {
      const text = `${buildPrompt(prompt, variation)}\nKeep the person from input_image_0 as the streamer.`;
      return ai
        ? generateWithBinding(ai, model, text, reference)
        : generateWithRest(accountId!, token!, model, text, reference);
    }),
  );

  const images = results
    .filter((result): result is PromiseFulfilledResult<GeneratedImage> => {
      return result.status === "fulfilled";
    })
    .map((result) => result.value);

  if (images.length === 0) {
    throw new Error(firstSettledError(results));
  }

  return images;
}
