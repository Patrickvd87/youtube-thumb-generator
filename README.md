# Thumb Desk

Internal editor tool for livestream thumbnails. Generate four options from a streamer photo and prompt, pick one, then set it on a YouTube video.

## Setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Local dev does not require Cloudflare Access.

### Environment

| Variable | Purpose |
| --- | --- |
| `TEAM_DOMAIN` | Cloudflare Access team URL, e.g. `https://your-team.cloudflareaccess.com` |
| `POLICY_AUD` | Access application AUD tag |
| `AUTH_SECRET` | Encrypts a locally stored YouTube refresh token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account id for free Workers AI image generation |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with Workers AI access |
| `CLOUDFLARE_IMAGE_MODEL` | Optional. Default `@cf/black-forest-labs/flux-2-klein-4b` |
| `IMAGE_PROVIDER` | Optional. `cloudflare` (default when CF creds exist) or `gemini` |
| `GEMINI_API_KEY` | Paid Gemini image API only — free-tier quota is 0 |
| `GOOGLE_CLIENT_ID` | OAuth client for YouTube |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret |
| `GOOGLE_REDIRECT_URI` | Must match the OAuth client, default `http://localhost:3000/api/youtube/callback` |
| `YOUTUBE_REFRESH_TOKEN` | Optional. Use this instead of the local token file |

### Image generation (free)

Gemini’s image models (`gemini-2.5-flash-image` and similar) have **no free API quota** (`limit: 0`). Use Cloudflare Workers AI instead:

1. Open the [Cloudflare dashboard](https://dash.cloudflare.com/) and copy your Account ID.
2. Create an API token with **Workers AI** permission.
3. Put both in `.env.local` as `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`.
4. Restart `npm run dev`.

The app sends the selected streamer photo as `input_image_0` and generates four 1280×720 variants.

To use Gemini after enabling billing, set `GEMINI_API_KEY` and `IMAGE_PROVIDER=gemini`.

### YouTube OAuth

1. In Google Cloud, create a project and enable **YouTube Data API v3**.
2. Create an OAuth 2.0 **Web application** client.
3. Add authorized redirect URIs:
   - `http://localhost:3000/api/youtube/callback`
   - `https://youtube-thumb-generator.patrickvd87.workers.dev/api/youtube/callback`
4. Copy the client id and secret into `.env.local`.
5. Sign in to Thumb Desk, click **Connect YouTube**, and approve access with the channel owner account.
6. The channel must be allowed to set custom thumbnails (usually after YouTube verification).

After connect, paste a video ID or watch/live URL, select a generated thumbnail, and click **Set selected thumbnail**.

## Defaults

- Streamer photos live in `public/streamers/`. Replace the sample portraits with the real streamer.
- Extra uploads go to `public/uploads/` (gitignored).
- The starting prompt is `data/default-prompt.txt`. Use **Save as default** in the UI to update it.

## Host on Cloudflare (no domain needed)

Live URL (no custom domain):

[https://youtube-thumb-generator.patrickvd87.workers.dev](https://youtube-thumb-generator.patrickvd87.workers.dev)

Protect the live URL with [one-click Access](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/):

1. Worker → **Settings** → **Domains & Routes**
2. On the `workers.dev` route, click **Enable Cloudflare Access**
3. **Manage Cloudflare Access** and allow your email
4. Optional: copy the application **AUD** tag into `POLICY_AUD`
5. `TEAM_DOMAIN` is already set to `https://patrickvd87.cloudflareaccess.com`

Login is Cloudflare’s email / one-time PIN screen. There is no app password.

```bash
npx wrangler login
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put GOOGLE_REDIRECT_URI
# value: https://youtube-thumb-generator.patrickvd87.workers.dev/api/youtube/callback
```

Add that same callback URL in the Google OAuth client. After the first YouTube connect, also:

```bash
npx wrangler secret put YOUTUBE_REFRESH_TOKEN
```

Workers AI is bound as `AI` in `wrangler.jsonc`, so the deployed app does not need `CLOUDFLARE_API_TOKEN`.

Notes:

- Use Node 22+ for Wrangler 4 (`npm run deploy`).
- Commit real streamer photos under `public/streamers/`. Uploads and “save as default” do not persist on Workers.
- Free Workers CPU is 10 ms per request. Next.js plus four image jobs can exceed that. If generate fails with a CPU/time limit, the $5/month Workers Paid plan lifts it. Vercel Hobby (`*.vercel.app`) is the other free no-domain host; keep Workers AI via REST from there.

## Deploy notes (Vercel)

Local disk writes (uploads, saved prompt, YouTube token file) work on your machine. On Vercel those writes are ephemeral, so:

- Commit real streamer photos under `public/streamers/`
- Keep the default prompt in git
- Store `YOUTUBE_REFRESH_TOKEN` in Vercel env after the first local OAuth connect
- Set `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` so image generation still uses Workers AI

