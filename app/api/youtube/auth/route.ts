import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { buildAuthUrl, getOAuthStateCookieName } from "@/lib/youtube";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;

  try {
    const state = randomBytes(16).toString("hex");
    const response = NextResponse.redirect(buildAuthUrl(state));
    response.cookies.set(getOAuthStateCookieName(), state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10,
    });
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "YouTube OAuth is not configured";
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(message)}`, origin));
  }
}
