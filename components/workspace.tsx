"use client";

import { FormEvent, useMemo, useState } from "react";
import type { Photo } from "@/lib/photos";
import type { GeneratedImage } from "@/lib/generate";

type WorkspaceProps = {
  photos: Photo[];
  defaultPrompt: string;
  youtubeConnected: boolean;
  initialError?: string;
  youtubeJustConnected?: boolean;
};

export function Workspace({
  photos: initialPhotos,
  defaultPrompt,
  youtubeConnected,
  initialError,
  youtubeJustConnected,
}: WorkspaceProps) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [photoId, setPhotoId] = useState(initialPhotos[0]?.id ?? "");
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [count, setCount] = useState(1);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [videoId, setVideoId] = useState("");
  const [busy, setBusy] = useState<"generate" | "upload" | "save" | "set" | null>(null);
  const [message, setMessage] = useState(
    initialError || (youtubeJustConnected ? "YouTube connected." : ""),
  );
  const [messageTone, setMessageTone] = useState<"error" | "ok">(
    initialError ? "error" : "ok",
  );

  const selectedImage = useMemo(
    () => images.find((image) => image.id === selectedId) ?? null,
    [images, selectedId],
  );

  function show(text: string, tone: "error" | "ok" = "error") {
    setMessage(text);
    setMessageTone(tone);
  }

  async function onUpload(file: File | undefined) {
    if (!file) {
      return;
    }

    setBusy("upload");
    const formData = new FormData();
    formData.set("file", file);

    const response = await fetch("/api/photos/upload", {
      method: "POST",
      body: formData,
    });
    const data = (await response.json()) as { photo?: Photo; error?: string };
    setBusy(null);

    if (!response.ok || !data.photo) {
      show(data.error || "Upload failed");
      return;
    }

    setPhotos((current) => [...current, data.photo!]);
    setPhotoId(data.photo.id);
    show("Photo uploaded.", "ok");
  }

  async function savePrompt() {
    setBusy("save");
    const response = await fetch("/api/prompt", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const data = (await response.json()) as { error?: string };
    setBusy(null);

    if (!response.ok) {
      show(data.error || "Could not save prompt");
      return;
    }

    show("Default prompt saved.", "ok");
  }

  async function generate(event: FormEvent) {
    event.preventDefault();
    setBusy("generate");
    setMessage("");
    setImages([]);
    setSelectedId(null);

    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, photoId, count }),
    });
    const data = (await response.json()) as {
      images?: GeneratedImage[];
      error?: string;
    };
    setBusy(null);

    if (!response.ok || !data.images?.length) {
      show(data.error || "Generation failed");
      return;
    }

    setImages(data.images);
    setSelectedId(data.images[0].id);
    show(`Generated ${data.images.length} options. Pick one.`, "ok");
  }

  async function setOnYouTube() {
    if (!selectedImage) {
      show("Select a thumbnail first");
      return;
    }

    if (!youtubeConnected) {
      show("Connect YouTube first");
      return;
    }

    setBusy("set");
    const response = await fetch("/api/youtube/set-thumbnail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoId,
        imageBase64: selectedImage.data,
        mimeType: selectedImage.mimeType,
      }),
    });
    const data = (await response.json()) as { error?: string };
    setBusy(null);

    if (!response.ok) {
      show(data.error || "Could not set thumbnail");
      return;
    }

    show("Thumbnail set on YouTube.", "ok");
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <p className="text-[11px] tracking-[0.22em] text-accent uppercase">Live desk</p>
          <h1 className="text-xl font-semibold tracking-tight">Thumb Desk</h1>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {youtubeConnected ? (
            <span className="text-success">YouTube connected</span>
          ) : (
            <a href="/api/youtube/auth" className="text-muted underline-offset-2 hover:underline">
              Connect YouTube
            </a>
          )}
          <a
            href="/api/auth/logout"
            className="rounded-md border border-border px-3 py-1.5 text-muted hover:text-foreground"
          >
            Log out
          </a>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-8">
        {message ? (
          <p className={messageTone === "error" ? "text-accent" : "text-success"}>{message}</p>
        ) : null}

        <form onSubmit={generate} className="grid gap-10 lg:grid-cols-[280px_minmax(0,1fr)]">
          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-medium tracking-wide uppercase">Streamer photo</h2>
            <div className="grid grid-cols-2 gap-3">
              {photos.map((photo) => {
                const selected = photo.id === photoId;
                return (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => setPhotoId(photo.id)}
                    className={`overflow-hidden rounded-md border text-left ${
                      selected ? "border-accent" : "border-border"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url} alt={photo.label} className="aspect-square w-full object-cover" />
                    <span className="block px-2 py-1.5 text-xs text-muted">{photo.label}</span>
                  </button>
                );
              })}
            </div>
            <label className="text-sm text-muted">
              Upload a photo
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="mt-2 block w-full text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-surface-raised file:px-3 file:py-1.5"
                onChange={(event) => onUpload(event.target.files?.[0])}
                disabled={busy === "upload"}
              />
            </label>
          </section>

          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-sm font-medium tracking-wide uppercase">Prompt</h2>
              <button
                type="button"
                onClick={savePrompt}
                disabled={busy === "save"}
                className="text-sm text-muted underline-offset-2 hover:underline"
              >
                Save as default
              </button>
            </div>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={10}
              className="min-h-48 w-full resize-y rounded-md border border-border bg-surface px-3 py-3 leading-6 outline-none focus:border-accent"
            />
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-muted">Variants</span>
                <select
                  value={count}
                  onChange={(event) => setCount(Number(event.target.value))}
                  className="rounded-md border border-border bg-surface px-3 py-2 outline-none focus:border-accent"
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                </select>
              </label>
              <button
                type="submit"
                disabled={busy === "generate" || !photoId}
                className="rounded-md bg-accent px-5 py-2.5 font-medium text-white hover:bg-accent-hover disabled:opacity-60"
              >
                {busy === "generate"
                  ? `Generating ${count}…`
                  : count === 1
                    ? "Generate thumbnail"
                    : `Generate ${count} thumbnails`}
              </button>
            </div>
          </section>
        </form>

        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-medium tracking-wide uppercase">Preview</h2>
          {images.length === 0 ? (
            <p className="text-muted">Generate to preview options here.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {images.map((image, index) => {
                const selected = image.id === selectedId;
                return (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => setSelectedId(image.id)}
                    className={`overflow-hidden rounded-md border ${
                      selected ? "border-accent" : "border-border"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`data:${image.mimeType};base64,${image.data}`}
                      alt={`Thumbnail option ${index + 1}`}
                      className="aspect-video w-full object-cover"
                    />
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-4 border-t border-border pt-8">
          <h2 className="text-sm font-medium tracking-wide uppercase">Set on YouTube</h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={videoId}
              onChange={(event) => setVideoId(event.target.value)}
              placeholder="Video ID or YouTube URL"
              className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-2 outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={setOnYouTube}
              disabled={busy === "set" || !selectedImage || !videoId.trim()}
              className="rounded-md bg-foreground px-5 py-2.5 font-medium text-background hover:opacity-90 disabled:opacity-50"
            >
              {busy === "set"
                ? "Uploading…"
                : youtubeConnected
                  ? "Set selected thumbnail"
                  : "Connect YouTube first"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
