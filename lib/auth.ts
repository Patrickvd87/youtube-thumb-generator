import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "thumb_session";
export const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function getSecret(): string | null {
  return process.env.AUTH_SECRET ?? null;
}

export function signSession(issuedAt = Date.now()): string {
  const secret = getSecret();
  if (!secret) {
    throw new Error("AUTH_SECRET is not set");
  }

  const payload = String(issuedAt);
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

export function verifySessionValue(value: string | undefined): boolean {
  const secret = getSecret();
  if (!secret || !value) {
    return false;
  }

  const [payload, signature] = value.split(".");
  if (!payload || !signature) {
    return false;
  }

  const issuedAt = Number(payload);
  if (!Number.isFinite(issuedAt)) {
    return false;
  }

  if (Date.now() - issuedAt > MAX_AGE_SECONDS * 1000) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(actualBuffer, expectedBuffer);
}

export function passwordsMatch(input: string): boolean {
  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    return false;
  }

  const inputBuffer = Buffer.from(input);
  const expectedBuffer = Buffer.from(expected);
  if (inputBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(inputBuffer, expectedBuffer);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  };
}

export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  return verifySessionValue(store.get(SESSION_COOKIE)?.value);
}
