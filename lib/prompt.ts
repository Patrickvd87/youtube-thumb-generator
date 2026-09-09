import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const PROMPT_PATH = path.join(process.cwd(), "data", "default-prompt.txt");

const FALLBACK_PROMPT = `YouTube livestream thumbnail of this streamer.

Use the reference photo as the person's exact likeness. Keep the face large and readable on a small preview.

Layout: 16:9 landscape, high contrast, bold short title text, dark cinematic background.

Title text: LIVE TONIGHT

Style: energetic livestream energy, dramatic lighting, no watermarks, no extra logos.`;

export async function getDefaultPrompt(): Promise<string> {
  try {
    return (await readFile(PROMPT_PATH, "utf8")).trim();
  } catch {
    return FALLBACK_PROMPT;
  }
}

export async function saveDefaultPrompt(prompt: string): Promise<void> {
  const trimmed = prompt.trim();
  if (!trimmed) {
    throw new Error("Prompt cannot be empty");
  }

  await mkdir(path.dirname(PROMPT_PATH), { recursive: true });
  await writeFile(PROMPT_PATH, `${trimmed}\n`, "utf8");
}
