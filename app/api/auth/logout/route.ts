import { NextResponse } from "next/server";
import { accessLogoutUrl } from "@/lib/access";

export async function GET(request: Request) {
  const logoutUrl = accessLogoutUrl();
  if (logoutUrl) {
    return NextResponse.redirect(logoutUrl);
  }

  return NextResponse.redirect(new URL("/", request.url));
}

export async function POST(request: Request) {
  return GET(request);
}
