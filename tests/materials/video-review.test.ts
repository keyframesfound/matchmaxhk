import { describe, expect, it } from "vitest";

import { decideModeration, isVideoAttachment } from "../../src/features/materials/note-moderation";

describe("#784 §2.4 AC-738-1 video needs admin review", () => {
  const clean = { regexFlags: [], ai: null, uncheckable: false };

  it("a clean PDF-only listing still auto-publishes", () => {
    expect(decideModeration(clean).status).toBe("published");
  });

  it("a listing with video waits for staff", () => {
    expect(decideModeration({ ...clean, containsVideo: true })).toEqual({
      status: "pending_review",
      reason: "video_requires_admin_review",
    });
  });

  it("a hard rejection stays a rejection even with video", () => {
    expect(
      decideModeration({ ...clean, regexFlags: ["contact_details"], containsVideo: true }).status,
    ).toBe("rejected");
  });

  it("spots video files and video-host links", () => {
    expect(isVideoAttachment({ format: "video" })).toBe(true);
    expect(isVideoAttachment({ mime_type: "video/mp4" })).toBe(true);
    expect(isVideoAttachment({ url: "https://youtu.be/abc" })).toBe(true);
    expect(isVideoAttachment({ format: "pdf", mime_type: "application/pdf" })).toBe(false);
  });
});
