import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAccessAuthenticated } from "@/lib/access";

const PUBLIC_PATHS = ["/api/youtube/callback"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }

  if (await isAccessAuthenticated(request)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return new NextResponse(
    "Cloudflare Access required. Enable Access on this Worker and set TEAM_DOMAIN.",
    { status: 403 },
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
