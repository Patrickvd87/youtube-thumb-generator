import { Workspace } from "@/components/workspace";
import { listPhotos } from "@/lib/photos";
import { getDefaultPrompt } from "@/lib/prompt";
import { isYouTubeConnected } from "@/lib/youtube";

type HomePageProps = {
  searchParams: Promise<{ error?: string; youtube?: string }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const [photos, defaultPrompt, youtubeConnected] = await Promise.all([
    listPhotos(),
    getDefaultPrompt(),
    isYouTubeConnected(),
  ]);

  return (
    <Workspace
      photos={photos}
      defaultPrompt={defaultPrompt}
      youtubeConnected={youtubeConnected}
      initialError={params.error}
      youtubeJustConnected={params.youtube === "connected"}
    />
  );
}
