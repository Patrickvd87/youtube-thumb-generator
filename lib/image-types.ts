export type GeneratedImage = {
  id: string;
  mimeType: string;
  data: string;
};

export const VARIATIONS = [
  "Variation A: bold close-up, face on the right, high-contrast title on the left.",
  "Variation B: cinematic lighting, face on the left, dramatic shadows, title on the right.",
  "Variation C: energetic livestream energy, neon accent lighting, punchy short title.",
  "Variation D: clean graphic layout, strong title treatment, face centered-left.",
];

export function variationsForCount(count: number): string[] {
  return VARIATIONS.slice(0, count);
}

export function buildPrompt(userPrompt: string, variation: string): string {
  return [
    "Create a YouTube thumbnail, 16:9 landscape, about 1280x720.",
    "Use the attached reference photo as the streamer's exact likeness.",
    "Keep the face large and recognizable in a small feed preview.",
    "Use bold, short, highly readable text. High contrast. No watermarks.",
    "Do not add extra logos. Photorealistic face.",
    "",
    userPrompt.trim(),
    "",
    variation,
  ].join("\n");
}

export function firstSettledError(
  results: PromiseSettledResult<GeneratedImage>[],
): string {
  const firstError = results.find((result) => result.status === "rejected");
  if (firstError && firstError.status === "rejected") {
    return firstError.reason instanceof Error
      ? firstError.reason.message
      : "All generations failed";
  }
  return "All generations failed";
}
