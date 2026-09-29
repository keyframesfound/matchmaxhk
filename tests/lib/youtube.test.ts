import { describe, expect, it } from "vitest";

import { parseYouTubeUrl } from "@/lib/youtube";

describe("parseYouTubeUrl", () => {
  it("parses standard watch URLs", () => {
    const info = parseYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(info).not.toBeNull();
    expect(info?.id).toBe("dQw4w9WgXcQ");
    expect(info?.embedUrl).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0");
    expect(info?.thumbnailUrl).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  });

  it("parses watch URLs with extra query params", () => {
    expect(parseYouTubeUrl("https://www.youtube.com/watch?t=30s&v=abc123XYZ_-")?.id).toBe(
      "abc123XYZ_-",
    );
  });

  it("parses short, shorts, embed, and live URLs", () => {
    expect(parseYouTubeUrl("https://youtu.be/dQw4w9WgXcQ")?.id).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ")?.id).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeUrl("https://www.youtube.com/embed/dQw4w9WgXcQ")?.id).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeUrl("https://www.youtube.com/live/dQw4w9WgXcQ")?.id).toBe("dQw4w9WgXcQ");
  });

  it("trims surrounding whitespace", () => {
    expect(parseYouTubeUrl("  https://youtu.be/dQw4w9WgXcQ  ")?.id).toBe("dQw4w9WgXcQ");
  });

  it("returns null for empty, null, and undefined input", () => {
    expect(parseYouTubeUrl(null)).toBeNull();
    expect(parseYouTubeUrl(undefined)).toBeNull();
    expect(parseYouTubeUrl("")).toBeNull();
    expect(parseYouTubeUrl("   ")).toBeNull();
  });

  it("returns null for non-YouTube URLs and bare text", () => {
    expect(parseYouTubeUrl("https://vimeo.com/12345")).toBeNull();
    expect(parseYouTubeUrl("not a url")).toBeNull();
    expect(parseYouTubeUrl("https://www.youtube.com/playlist?list=PL1234")).toBeNull();
  });
});
