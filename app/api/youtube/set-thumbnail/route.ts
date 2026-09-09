import { NextResponse } from "next/server";
import { isYouTubeConnected, setYouTubeThumbnail } from "@/lib/youtube";

export async function POST(request: Request) {
  if (!(await isYouTubeConnected())) {
    return NextResponse.json({ error: "YouTube is not connected" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    videoId?: string;
    imageBase64?: string;
    mimeType?: string;
  } | null;

  if (!body?.videoId || !body.imageBase64) {
    return NextResponse.json(
      { error: "Select a thumbnail and enter a video ID" },
      { status: 400 },
    );
  }

  try {
    await setYouTubeThumbnail({
      videoId: body.videoId,
      imageBase64: body.imageBase64,
      mimeType: body.mimeType || "image/jpeg",
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not set thumbnail" },
      { status: 400 },
    );
  }
}
