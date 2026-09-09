import { NextResponse } from "next/server";
import { isYouTubeConnected } from "@/lib/youtube";

export async function GET() {
  return NextResponse.json({ connected: await isYouTubeConnected() });
}
