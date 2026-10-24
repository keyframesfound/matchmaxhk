import { parseYouTubeUrl } from "./youtube";

/**
 * Issue #392: Vimeo is the second EMBED-ONLY video host for course lessons.
 * Tutors paste an UNLISTED Vimeo link; the app parses it into a
 * player.vimeo.com embed. No video file upload path exists or may be added
 * (CEO hosting pivot 2026-10-21: bandwidth stays off MatchMax), and every
 * other host (Google Drive, Loom, …) is rejected at validation time.
 */

export type VimeoVideoInfo = {
  provider: "vimeo";
  videoId: string;
  embedUrl: string;
};

/**
 * Accepts ONLY:
 *   - https://vimeo.com/<digits>
 *   - https://player.vimeo.com/video/<digits>
 * (trailing slash / query string tolerated). Album, channel, showcase,
 * review and private links carry path segments that are not a bare numeric
 * video id and are rejected, those URLs do not embed as a plain video.
 */
const VIMEO_PATTERNS = [
  /(?:^|\/\/)(?:www\.)?vimeo\.com\/(\d{4,15})(?:[/?#]|$)/i,
  /(?:^|\/\/)player\.vimeo\.com\/video\/(\d{4,15})(?:[/?#]|$)/i,
];

export function parseVimeoUrl(raw: string | null | undefined): VimeoVideoInfo | null {
  if (!raw) return null;
  const url = raw.trim();
  if (!url) return null;
  for (const pattern of VIMEO_PATTERNS) {
    const match = url.match(pattern);
    if (match) {
      const videoId = match[1];
      return {
        provider: "vimeo",
        videoId,
        embedUrl: `https://player.vimeo.com/video/${videoId}`,
      };
    }
  }
  return null;
}

/**
 * The single course-video validator used everywhere (editor paste check,
 * submit gate, buyer access, admin review embeds). YouTube first (watch /
 * youtu.be / shorts / embed / live via parseYouTubeUrl → youtube-nocookie),
 * then Vimeo. Anything else, Google Drive, Loom, a bare MP4 URL, returns
 * null and the caller must reject it.
 */
export type CourseVideoInfo = {
  provider: "youtube" | "vimeo";
  videoId: string;
  embedUrl: string;
};

export function validateCourseVideoUrl(raw: string | null | undefined): CourseVideoInfo | null {
  const youtube = parseYouTubeUrl(raw);
  if (youtube) {
    return {
      provider: "youtube",
      videoId: youtube.id,
      embedUrl: youtube.embedUrl,
    };
  }
  const vimeo = parseVimeoUrl(raw);
  if (vimeo) return vimeo;
  return null;
}
