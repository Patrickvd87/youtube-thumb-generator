import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const TOKEN_PATH = path.join(process.cwd(), "data", "youtube-tokens.json");
const YOUTUBE_SCOPE = "https://www.googleapis.com/auth/youtube.upload";
const OAUTH_STATE_COOKIE = "yt_oauth_state";

type StoredTokens = {
  refreshToken: string;
};

function encryptionKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set");
  }
  return createHash("sha256").update(secret).digest();
}

function encrypt(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

function decrypt(value: string): string {
  const buffer = Buffer.from(value, "base64");
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

export function getRedirectUri(): string {
  return (
    process.env.GOOGLE_REDIRECT_URI ||
    "http://localhost:3000/api/youtube/callback"
  );
}

export function getOAuthStateCookieName(): string {
  return OAUTH_STATE_COOKIE;
}

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: requiredEnv("GOOGLE_CLIENT_ID"),
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: YOUTUBE_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function readStoredRefreshToken(): Promise<string | null> {
  if (process.env.YOUTUBE_REFRESH_TOKEN) {
    return process.env.YOUTUBE_REFRESH_TOKEN;
  }

  try {
    const raw = await readFile(TOKEN_PATH, "utf8");
    const parsed = JSON.parse(raw) as { refreshToken?: string };
    if (!parsed.refreshToken) {
      return null;
    }
    return decrypt(parsed.refreshToken);
  } catch {
    return null;
  }
}

export async function isYouTubeConnected(): Promise<boolean> {
  return Boolean(await readStoredRefreshToken());
}

export async function saveRefreshToken(refreshToken: string): Promise<void> {
  const payload: StoredTokens = {
    refreshToken: encrypt(refreshToken),
  };
  await mkdir(path.dirname(TOKEN_PATH), { recursive: true });
  await writeFile(TOKEN_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export async function exchangeCodeForTokens(code: string): Promise<void> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: requiredEnv("GOOGLE_CLIENT_ID"),
      client_secret: requiredEnv("GOOGLE_CLIENT_SECRET"),
      redirect_uri: getRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  const data = (await response.json()) as {
    refresh_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !data.refresh_token) {
    throw new Error(
      data.error_description || data.error || "YouTube OAuth exchange failed",
    );
  }

  await saveRefreshToken(data.refresh_token);
}

async function getAccessToken(): Promise<string> {
  const refreshToken = await readStoredRefreshToken();
  if (!refreshToken) {
    throw new Error("YouTube is not connected");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: requiredEnv("GOOGLE_CLIENT_ID"),
      client_secret: requiredEnv("GOOGLE_CLIENT_SECRET"),
      grant_type: "refresh_token",
    }),
  });

  const data = (await response.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error || "Could not refresh YouTube token",
    );
  }

  return data.access_token;
}

export function extractVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    if (url.hostname.includes("youtu.be")) {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }

    const fromQuery = url.searchParams.get("v");
    if (fromQuery && /^[A-Za-z0-9_-]{11}$/.test(fromQuery)) {
      return fromQuery;
    }

    const parts = url.pathname.split("/").filter(Boolean);
    const liveIndex = parts.indexOf("live");
    if (liveIndex >= 0) {
      const id = parts[liveIndex + 1];
      return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }
  } catch {
    return null;
  }

  return null;
}

export async function setYouTubeThumbnail(options: {
  videoId: string;
  imageBase64: string;
  mimeType: string;
}): Promise<void> {
  const videoId = extractVideoId(options.videoId);
  if (!videoId) {
    throw new Error("Enter a valid YouTube video ID or URL");
  }

  const accessToken = await getAccessToken();
  const image = Buffer.from(options.imageBase64, "base64");

  if (image.byteLength > 2 * 1024 * 1024) {
    throw new Error("Thumbnail must be under 2 MB for YouTube");
  }

  const response = await fetch(
    `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(videoId)}&uploadType=media`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": options.mimeType || "image/jpeg",
      },
      body: image,
    },
  );

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string; errors?: Array<{ reason?: string }> };
    } | null;
    const reason = body?.error?.errors?.[0]?.reason;
    if (reason === "uploadRateLimitExceeded") {
      throw new Error("YouTube thumbnail rate limit hit. Try again later.");
    }
    if (reason === "forbidden") {
      throw new Error(
        "This channel cannot set custom thumbnails, or the connected account lacks permission.",
      );
    }
    throw new Error(body?.error?.message || "YouTube rejected the thumbnail");
  }
}
