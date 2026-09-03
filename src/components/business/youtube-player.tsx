import { useState } from "react";
import { Play } from "lucide-react";

import { parseYouTubeUrl } from "@/lib/youtube";

export function YouTubePlayer({ url, title }: { url: string; title: string }) {
  const [playing, setPlaying] = useState(false);
  const info = parseYouTubeUrl(url);
  if (!info) return null;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-black">
      {playing ? (
        <iframe
          src={`${info.embedUrl}&autoplay=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`Play video: ${title}`}
          className="group absolute inset-0 h-full w-full"
        >
          <img
            src={info.thumbnailUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/10">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/65 text-white shadow-md transition-transform duration-200 group-hover:scale-110">
              <Play className="ml-0.5 h-5 w-5 fill-current" />
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
