import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCodeForTokens, getOAuthStateCookieName } from "@/lib/youtube";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const store = await cookies();
  const expectedState = store.get(getOAuthStateCookieName())?.value;

  const redirectWith = (query: string) => {
    const response = NextResponse.redirect(new URL(`/${query}`, origin));
    response.cookies.set(getOAuthStateCookieName(), "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
    return response;
  };

  if (oauthError) {
    return redirectWith(`?error=${encodeURIComponent("YouTube access was denied")}`);
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectWith(`?error=${encodeURIComponent("Invalid YouTube OAuth state")}`);
  }

  try {
    await exchangeCodeForTokens(code);
    return redirectWith("?youtube=connected");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "YouTube connect failed";
    return redirectWith(`?error=${encodeURIComponent(message)}`);
  }
}
