import { NextResponse } from "next/server";
import { getDefaultPrompt, saveDefaultPrompt } from "@/lib/prompt";

export async function GET() {
  return NextResponse.json({ prompt: await getDefaultPrompt() });
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as { prompt?: string } | null;
  const prompt = body?.prompt?.trim() ?? "";

  if (!prompt) {
    return NextResponse.json({ error: "Prompt cannot be empty" }, { status: 400 });
  }

  try {
    await saveDefaultPrompt(prompt);
    return NextResponse.json({ prompt });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save prompt" },
      { status: 500 },
    );
  }
}
