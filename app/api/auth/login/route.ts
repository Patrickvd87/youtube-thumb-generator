import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  passwordsMatch,
  sessionCookieOptions,
  signSession,
} from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  const password = body?.password ?? "";

  if (!process.env.APP_PASSWORD || !process.env.AUTH_SECRET) {
    return NextResponse.json(
      { error: "APP_PASSWORD and AUTH_SECRET must be set" },
      { status: 500 },
    );
  }

  if (!passwordsMatch(password)) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, signSession(), sessionCookieOptions());
  return response;
}
