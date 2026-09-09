import { NextResponse } from "next/server";
import { generateThumbnails, parseVariantCount } from "@/lib/generate";

export const maxDuration = 60;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    prompt?: string;
    photoId?: string;
    count?: number;
  } | null;

  const prompt = body?.prompt?.trim() ?? "";
  const photoId = body?.photoId?.trim() ?? "";
  const count = parseVariantCount(body?.count);

  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  if (!photoId) {
    return NextResponse.json({ error: "Choose a streamer photo" }, { status: 400 });
  }

  try {
    const images = await generateThumbnails(prompt, photoId, count);
    return NextResponse.json({ images });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 },
    );
  }
}
