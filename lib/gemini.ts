import { GoogleGenAI } from "@google/genai";
import { readPhoto } from "./photos";
import {
  buildPrompt,
  firstSettledError,
  variationsForCount,
  type GeneratedImage,
} from "./image-types";

const MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";

function extractImage(response: {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: { data?: string; mimeType?: string };
      }>;
    };
  }>;
}): GeneratedImage {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return {
        id: crypto.randomUUID(),
        mimeType: part.inlineData.mimeType || "image/png",
        data: part.inlineData.data,
      };
    }
  }

  throw new Error("Gemini returned no image");
}

function rewriteGeminiError(error: unknown): Error {
  const raw = error instanceof Error ? error.message : String(error);
  if (
    raw.includes("RESOURCE_EXHAUSTED") ||
    raw.includes("free_tier") ||
    raw.includes("limit: 0")
  ) {
    return new Error(
      "Gemini image models have no free API quota (limit 0). Add CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN for free generation, or enable Gemini billing and set IMAGE_PROVIDER=gemini.",
    );
  }
  return error instanceof Error ? error : new Error(raw);
}

export async function generateWithGemini(
  prompt: string,
  photoId: string,
  count = 1,
): Promise<GeneratedImage[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "No image provider configured. Add CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (free), or GEMINI_API_KEY with billing enabled.",
    );
  }

  const photo = await readPhoto(photoId);
  const ai = new GoogleGenAI({ apiKey });

  const results = await Promise.allSettled(
    variationsForCount(count).map(async (variation) => {
      try {
        const response = await ai.models.generateContent({
          model: MODEL,
          contents: [
            {
              role: "user",
              parts: [
                { text: buildPrompt(prompt, variation) },
                {
                  inlineData: {
                    mimeType: photo.mimeType,
                    data: photo.data,
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ["TEXT", "IMAGE"],
            imageConfig: {
              aspectRatio: "16:9",
            },
          },
        });

        return extractImage(response);
      } catch (error) {
        throw rewriteGeminiError(error);
      }
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
