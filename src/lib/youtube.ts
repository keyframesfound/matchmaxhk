export type YouTubeVideoInfo = {
  id: string;
  embedUrl: string;
  thumbnailUrl: string;
};

const YOUTUBE_PATTERNS = [
  /(?:youtube\.com\/watch\?(?:.*&)?v=)([\w-]{6,20})/i,
  /(?:youtu\.be\/)([\w-]{6,20})/i,
  /(?:youtube\.com\/shorts\/)([\w-]{6,20})/i,
  /(?:youtube\.com\/embed\/)([\w-]{6,20})/i,
  /(?:youtube\.com\/live\/)([\w-]{6,20})/i,
];

export function parseYouTubeUrl(raw: string | null | undefined): YouTubeVideoInfo | null {
  if (!raw) return null;
  const url = raw.trim();
  if (!url) return null;
  for (const pattern of YOUTUBE_PATTERNS) {
    const match = url.match(pattern);
    if (match) {
      const id = match[1];
      return {
        id,
        embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0`,
        thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      };
    }
  }
  return null;
}
