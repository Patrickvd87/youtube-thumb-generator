import { createRemoteJWKSet, jwtVerify } from "jose";
import type { NextRequest } from "next/server";

const ACCESS_HEADER = "cf-access-jwt-assertion";

function teamDomain(): string | null {
  const raw = process.env.TEAM_DOMAIN?.trim();
  if (!raw) {
    return null;
  }
  return raw.replace(/\/$/, "");
}

function audience(): string | null {
  return process.env.POLICY_AUD?.trim() || null;
}

function jwksFor(domain: string) {
  return createRemoteJWKSet(new URL(`${domain}/cdn-cgi/access/certs`));
}

export function isLocalDev(): boolean {
  return process.env.NODE_ENV !== "production";
}

export function accessLogoutUrl(): string | null {
  const domain = teamDomain();
  return domain ? `${domain}/cdn-cgi/access/logout` : null;
}

export async function verifyAccessToken(token: string | undefined): Promise<boolean> {
  const domain = teamDomain();
  const aud = audience();
  if (!domain || !aud || !token) {
    return false;
  }

  try {
    await jwtVerify(token, jwksFor(domain), {
      issuer: domain,
      audience: aud,
    });
    return true;
  } catch {
    return false;
  }
}

export async function isAccessAuthenticated(request: NextRequest): Promise<boolean> {
  if (isLocalDev()) {
    return true;
  }

  return verifyAccessToken(request.headers.get(ACCESS_HEADER) ?? undefined);
}
