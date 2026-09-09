import { NextResponse } from "next/server";
import { listPhotos } from "@/lib/photos";

export async function GET() {
  return NextResponse.json({ photos: await listPhotos() });
}
